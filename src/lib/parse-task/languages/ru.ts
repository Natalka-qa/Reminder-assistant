import {
  decimal,
  rule,
  setDaysAhead,
  setDuration,
  setMonthDay,
  setNextWeekday,
  setTime,
  setWeekly,
  type Language,
} from "@/lib/parse-task/engine";

// NEW_TASK_V2_UPDATE.md § 3.1 — Russian: its own rules with the case
// forms people actually write ("в понедельник", "по понедельникам",
// "1 октября", "в 9", "на час"), not a translation into English. "Утром"
// or "вечером" alone set no time — the spec says don't guess — and stay in
// the title.

// Every form a weekday takes here, by ISO number. Short forms stand alone;
// full ones need a preposition in a date ("в среду") — bare "среда" is as
// often "environment" as Wednesday.
const WEEKDAY_FORMS: [number, string[]][] = [
  [1, ["понедельник", "понедельника", "понедельникам", "пн"]],
  [2, ["вторник", "вторника", "вторникам", "вт"]],
  [3, ["среда", "среду", "среды", "средам", "ср"]],
  [4, ["четверг", "четверга", "четвергам", "чт"]],
  [5, ["пятница", "пятницу", "пятницы", "пятницам", "пт"]],
  [6, ["суббота", "субботу", "субботы", "субботам", "сб"]],
  [7, ["воскресенье", "воскресенья", "воскресеньям", "вс"]],
];
const WEEKDAY = WEEKDAY_FORMS.flatMap(([, forms]) => forms)
  .sort((a, b) => b.length - a.length)
  .join("|");
const weekdayOf = (word: string) =>
  WEEKDAY_FORMS.find(([, forms]) => forms.includes(word.toLowerCase()))?.[0];

const MONTHS = [
  "январ|янв",
  "феврал|фев",
  "март|мар",
  "апрел|апр",
  "ма[яй]",
  "июн",
  "июл",
  "август|авг",
  "сентябр|сент|сен",
  "октябр|окт",
  "ноябр|нояб|ноя",
  "декабр|дек",
];
const MONTH =
  "января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря|янв|фев|мар|апр|июн|июл|авг|сент|сен|окт|нояб|ноя|дек";
const monthOf = (word: string) =>
  MONTHS.findIndex((stems) => new RegExp(`^(?:${stems})`, "iu").test(word)) + 1;

const DAYPART = "утра|дня|вечера|ночи";
/** "7 вечера" → 19, "3 дня" → 15, "11 ночи" → 23, "2 ночи" → 2. */
function hourWithDaypart(hour: number, daypart: string | undefined): number {
  switch (daypart?.toLowerCase()) {
    case "утра":
      return hour === 12 ? 0 : hour;
    case "дня":
      return hour >= 1 && hour <= 6 ? hour + 12 : hour;
    case "вечера":
      return hour < 12 ? hour + 12 : hour;
    case "ночи":
      return hour === 12 ? 0 : hour >= 9 ? hour + 12 : hour;
    default:
      // § 3 — like "at 1"–"at 5": a bare "в 3" is the afternoon.
      return hour >= 1 && hour <= 5 ? hour + 12 : hour;
  }
}

export const ru: Language = {
  id: "ru",
  groups: [
    // Importance
    [
      rule(
        "срочно|срочное|срочная|срочный|важно|важное|важная|важный",
        (_, { out }) => void (out.priority = "HIGH"),
      ),
    ],
    // Repeat
    [
      rule(
        "по будням|в будни|по рабочим дням|каждый будний день|каждый рабочий день",
        (_, { out }) => setWeekly(out, [1, 2, 3, 4, 5]),
      ),
      rule(
        `(?:по|каждый|каждую|каждое) (?:${WEEKDAY})(?:\\s*(?:,|и)\\s*(?:по )?(?:${WEEKDAY}))*`,
        (match, { out }) => {
          const days = [
            ...match[0].matchAll(new RegExp(`(?:${WEEKDAY})`, "giu")),
          ].map((m) => weekdayOf(m[0]));
          return (
            days.every((day) => day !== undefined) &&
            setWeekly(out, days as number[])
          );
        },
      ),
      rule(
        "каждый день|ежедневно|каждое утро|каждый вечер|каждую ночь|по утрам|по вечерам",
        (_, { out }) => void (out.repeat = "DAILY"),
      ),
      rule(
        "каждую неделю|еженедельно",
        (_, { out }) => void (out.repeat = "WEEKLY"),
      ),
      rule(
        "каждый месяц|ежемесячно",
        (_, { out }) => void (out.repeat = "MONTHLY"),
      ),
    ],
    // Date
    [
      rule("послезавтра", (_, ctx) => setDaysAhead(ctx, 2)),
      rule("завтра", (_, ctx) => setDaysAhead(ctx, 1)),
      rule("сегодня", (_, ctx) => setDaysAhead(ctx, 0)),
      rule("через (\\d{1,3}) (?:день|дня|дней)", (match, ctx) =>
        setDaysAhead(ctx, Number(match[1])),
      ),
      rule(`(?:на )?(\\d{1,2})(?:-?го)? (${MONTH})\\.?`, (match, ctx) =>
        setMonthDay(ctx, monthOf(match[2]), Number(match[1])),
      ),
      rule(
        `(?:во?|на) (?:(?:следующ\\p{L}*|эт\\p{L}*|ближайш\\p{L}*) )?(${WEEKDAY})`,
        (match, ctx) => {
          const day = weekdayOf(match[1]);
          if (!day) return false;
          setNextWeekday(ctx, day);
        },
      ),
      rule("(пн|вт|ср|чт|пт|сб|вс)", (match, ctx) => {
        setNextWeekday(ctx, weekdayOf(match[1])!);
      }),
    ],
    // Duration — "в 9 часов" is a time, not nine hours, hence the
    // lookbehinds on the hour counts.
    [
      rule(
        "(?:на )?(\\d{1,2}) ?ч(?:ас(?:а|ов)?)? ?(\\d{1,2}) ?мин(?:ут[аыу]?)?",
        (match, { out }) =>
          setDuration(out, Number(match[1]) * 60 + Number(match[2])),
      ),
      rule("(?:на )?полчаса", (_, { out }) => setDuration(out, 30)),
      rule("(?:на )?полтора часа", (_, { out }) => setDuration(out, 90)),
      rule("на (?:один )?час", (_, { out }) => setDuration(out, 60)),
      rule(
        "(?:на )?(?<!(?<![\\p{L}\\p{N}])(?:во?|к) )(\\d{1,2}(?:[.,]\\d+)?) ?(?:часа|часов|час|ч)",
        (match, { out }) => {
          const hours = decimal(match[1]);
          return hours <= 12 && setDuration(out, hours * 60);
        },
      ),
      rule("(?:на )?(\\d{1,3}) ?(?:минут[ауы]?|мин)", (match, { out }) => {
        const minutes = Number(match[1]);
        return minutes <= 600 && setDuration(out, minutes);
      }),
    ],
    // Time
    [
      rule(
        `(?:(?:во?|к) )?(\\d{1,2})[:.](\\d{2})(?: (${DAYPART}))?`,
        (match, { out }) => {
          const hour = Number(match[1]);
          return setTime(
            out,
            match[3] ? hourWithDaypart(hour, match[3]) : hour,
            Number(match[2]),
          );
        },
      ),
      rule(
        `(?:во?|к) (\\d{1,2})(?: час(?:а|ов)?)?(?: (${DAYPART}))?`,
        (match, { out }) =>
          setTime(out, hourWithDaypart(Number(match[1]), match[2]), 0),
      ),
      rule(`(\\d{1,2})(?: час(?:а|ов)?)? (${DAYPART})`, (match, { out }) =>
        setTime(out, hourWithDaypart(Number(match[1]), match[2]), 0),
      ),
      rule("(?:в )?полдень", (_, { out }) => setTime(out, 12, 0)),
    ],
  ],
  fillers:
    /^(?:напомни(?:те)?(?: мне)?|напомнить(?: мне)?|не забыть|не забудь(?:те)?|мне нужно|мне надо|нужно|надо)\s+/iu,
  // A leading "в"/"на" is usually meant ("В аптеку"), so only
  // conjunctions are dropped at the start.
  leadingDangling: "и|а",
  trailingDangling: "в|во|на|к|и|по|через|с|до|а|каждый|каждую|каждое",
};
