import {
  countOf,
  decimal,
  monthDayDate,
  NUMERIC_DATE,
  numericDateOf,
  numberPattern,
  numericDateRule,
  rule,
  setDailyDayPart,
  setDailyInterval,
  setDayPart,
  setDaysAhead,
  setDue,
  setDuration,
  setMonthDay,
  setMonthsAhead,
  setNextWeekday,
  setNextWeeksDay,
  setPartOfDay,
  setRepeatCount,
  setRepeatUntil,
  setSearchDuration,
  setTime,
  setWeekly,
  spanRule,
  startTimeSearch,
  words,
  type Language,
} from "@/lib/parse-task/engine";

// NEW_TASK_V2_UPDATE.md § 3.1 — Russian: its own rules with the case
// forms people actually write ("в понедельник", "по понедельникам",
// "1 октября", "в 9", "на час"), not a translation into English. "Утром"
// or "вечером" alone are the part of the day's time, 09:00 or 20:00
// (2026-10-09 decision 1; before, they set nothing).

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

/** Weekday words, for splitting "Mon at 19 and Wed at 20" (split.ts). */
export const WEEKDAY_PATTERN = WEEKDAY;

// sprint-20-tasks.md п.3 — the unit of "for a month" / "на 2 недели".
const UNITS = { month: /^мес/iu, week: /^нед/iu };

// A count in digits or words: "3", "три", "трёх".
const NUM = numberPattern([
  "один",
  "одна",
  "одну",
  "одного",
  "одной",
  "два",
  "две",
  "двух",
  "три",
  "трёх",
  "трех",
  "четыре",
  "четырёх",
  "четырех",
  "пять",
  "пяти",
  "шесть",
  "шести",
  "семь",
  "семи",
  "восемь",
  "восьми",
  "девять",
  "девяти",
  "десять",
  "десяти",
]);

const SPAN_UNIT =
  "день|дня|дней|неделю|недели|недель|неделя|месяц|месяца|месяцев";

// Not how long: "через 2 дня" is a date, "каждые 3 дня" a step, "в 3 дня"
// a time, "за 2 дня" before.
const NOT_A_SPAN =
  "(?<!(?<![\\p{L}\\p{N}])(?:через|каждые|каждый|каждую|каждое|раз в|за|во?|к|до|после|с|на|этот|эту|следующий|следующую|прошлый|прошлую) )";

// The parts of the day, said once ("утром") or as a habit ("по утрам").
// "С днём рождения" isn't the afternoon.
const MORNING_HABIT = "каждое утро|по утрам|утрами";
const EVENING_HABIT = "каждый вечер|по вечерам|вечерами";

export const ru: Language = {
  id: "ru",
  searchGroups: [
    // sprint-12-tasks.md S12-04 — "найди (мне) (свободное) время/окно".
    [
      rule(
        "(?:найди(?:те)?|подбери(?:те)?|поищи(?:те)?)(?: мне)?(?: (?:свободное|свободный|свободные))?(?: (время|окно|окошко|слот))?",
        (match, ctx) => startTimeSearch(ctx, match[1] !== undefined),
      ),
    ],
    // Parts of the day, only inside a search.
    [
      rule("утром|с утра", (_, { out }) => setPartOfDay(out, "morning")),
      rule("днём|днем|после обеда", (_, { out }) =>
        setPartOfDay(out, "afternoon"),
      ),
      rule("вечером", (_, { out }) => setPartOfDay(out, "evening")),
    ],
    // "Найди час": in a search a bare "час" is an hour ("на час" is the
    // ordinary rule's).
    [rule("(?<!на )(?:один )?час", (_, { out }) => setSearchDuration(out, 60))],
  ],
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
      // sprint-20-tasks.md п.4 — через день, каждые N дней.
      rule("через день|каждый второй день|раз в два дня", (_, { out }) =>
        setDailyInterval(out, 2),
      ),
      rule(`(?:каждые|раз в) (${NUM}) (?:дня|дней)`, (match, { out }) =>
        setDailyInterval(out, countOf(match[1])),
      ),
      rule(
        "по будням|в будни|по рабочим дням|каждый будний день|каждый рабочий день",
        (_, { out }) => setWeekly(out, [1, 2, 3, 4, 5]),
      ),
      rule(
        `(?:по|каждый|каждую|каждое) (?:${WEEKDAY})(?:(?:\\s*(?:,|и)\\s*|\\s+)(?:по )?(?:${WEEKDAY}))*(?: ([01]?\\d|2[0-3])(?![:.]?\\d)(?! ?(?:час|мин|ч)))?`,
        (match, { out }) => {
          const days = [
            ...match[0].matchAll(new RegExp(`(?:${WEEKDAY})`, "giu")),
          ].map((m) => weekdayOf(m[0]));
          // The hour right after the day ("по средам 19"): its
          // time — "по средам в 19" without the "в".
          const hour = match[1];
          return (
            days.every((day) => day !== undefined) &&
            setWeekly(out, days as number[]) &&
            (hour === undefined || setTime(out, Number(hour), 0))
          );
        },
      ),
      // 2026-10-09 decision 1 — "по утрам" is daily, at 09:00.
      rule(MORNING_HABIT, (_, ctx) => setDailyDayPart(ctx, "morning")),
      rule(EVENING_HABIT, (_, ctx) => setDailyDayPart(ctx, "evening")),
      rule(
        "каждый день|ежедневно|каждую ночь",
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
    // The part of the day: its time unless the text gives one (engine).
    [
      rule(`утром|с утра|поутру|${MORNING_HABIT}`, (_, ctx) =>
        setDayPart(ctx, "morning"),
      ),
      rule(
        "(?<!(?<![\\p{L}\\p{N}])(?:с|со) )дн[её]м(?! рожд)|после обеда",
        (_, ctx) => setDayPart(ctx, "afternoon"),
      ),
      rule(`вечером|${EVENING_HABIT}`, (_, ctx) => setDayPart(ctx, "evening")),
    ],
    // sprint-20-tasks.md п.3 — сколько идёт повтор: «на месяц», «в течение
    // 2 недель», «до 3 ноября», «10 дней подряд», «3 раза». Без повтора
    // срок сам говорит «каждый день» (решение 3 от 2026-10-09).
    [
      rule(
        `(?:на|в течени[еи]|на протяжении|в продолжение) (?:(${NUM}) )?(${SPAN_UNIT})(?: подряд)?`,
        spanRule(UNITS),
      ),
      rule(
        `${NOT_A_SPAN}(${NUM}) (${SPAN_UNIT})(?: подряд)?(?! назад| спустя)`,
        spanRule(UNITS),
      ),
      // A bare "неделю" / "месяц" — only last, so "месяц" in the middle
      // of a title stays.
      rule(`${NOT_A_SPAN}()(неделю|месяц)(?=[\\s.!]*$)`, spanRule(UNITS)),
      // "3 раза" — not "3 раза в день", the doses of a course (course.ts).
      rule(
        `(${NUM}) раза?(?! (?:в|за|на) (?:день|сутки|неделю|месяц))`,
        (match, ctx) => setRepeatCount(ctx, countOf(match[1])),
      ),
      rule(`до (\\d{1,2})(?:-?го)? (${MONTH})`, (match, ctx) =>
        setRepeatUntil(
          ctx,
          monthDayDate(ctx.today, monthOf(match[2]), Number(match[1])),
        ),
      ),
      rule(`до ${NUMERIC_DATE}`, (match, ctx) =>
        setRepeatUntil(ctx, numericDateOf(match, 1, ctx.today)),
      ),
    ],
    // Date
    [
      rule("послезавтра", (_, ctx) => setDaysAhead(ctx, 2)),
      rule("завтра", (_, ctx) => setDaysAhead(ctx, 1)),
      rule("сегодня", (_, ctx) => setDaysAhead(ctx, 0)),
      rule(`через (${NUM}) (?:день|дня|дней)`, (match, ctx) =>
        setDaysAhead(ctx, countOf(match[1])),
      ),
      rule(`через (?:(${NUM}) )?(?:неделю|недели|недель)`, (match, ctx) =>
        setDaysAhead(ctx, countOf(match[1]) * 7),
      ),
      rule(`через (?:(${NUM}) )?(?:месяц|месяца|месяцев)`, (match, ctx) =>
        setMonthsAhead(ctx, countOf(match[1])),
      ),
      rule("на (?:следующей|будущей) неделе", (_, ctx) =>
        setNextWeeksDay(ctx, 1),
      ),
      // sprint-20-tasks.md п.11 — "03/10" is October 3; "в 20.10" a time.
      numericDateRule("на", "во? |к |до "),
      rule(`(?:на )?(\\d{1,2})(?:-?го)? (${MONTH})\\.?`, (match, ctx) =>
        setMonthDay(ctx, monthOf(match[2]), Number(match[1])),
      ),
      // "в следующую субботу" — next week's (engine's setNextWeeksDay).
      rule(`(?:(?:во?|на) )?следующ\\p{L}* (${WEEKDAY})`, (match, ctx) => {
        const day = weekdayOf(match[1]);
        if (!day) return false;
        setNextWeeksDay(ctx, day);
      }),
      rule(
        `(?:во?|на) (?:(?:эт\\p{L}*|ближайш\\p{L}*) )?(${WEEKDAY})`,
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
    // sprint-20-tasks.md п.10 — срок: «до 12», «до 12:30». Не дата:
    // «до 3 ноября», «до 03/11» — это конец повтора или текст.
    [
      rule(
        `до (\\d{1,2})(?:[:.](\\d{2}))?(?:-?(?:ти|х|и))?(?![/.]?\\d)(?! (?:${MONTH}))`,
        (match, { out }) =>
          setDue(out, Number(match[1]), Number(match[2] ?? 0)),
      ),
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
  searchFillers: /^(?:для|чтобы|на)\s+/iu,
  kindWords: {
    workout: words(
      "тренировк\\p{L}*|тренироваться|присед\\p{L}*|спортзал\\p{L}*|зал|зале|тренажёрн\\p{L}*|тренажерн\\p{L}*|бег|бегать|побегать|пробежк\\p{L}*|йог\\p{L}*|пилатес\\p{L}*|плавани\\p{L}*|бассейн\\p{L}*|фитнес\\p{L}*|растяжк\\p{L}*|кроссфит\\p{L}*|зарядк\\p{L}*",
    ),
    remote: words(
      "позвонить|звонок|звонк\\p{L}*|созвон\\p{L}*|набрать|написать|напиши|ответить|письм\\p{L}*|почт\\p{L}*|email|оплатить|оплат\\p{L}*|заплатить|заказать|записаться|забронировать|онлайн|zoom",
    ),
  },
  leadingDangling: "и|а",
  trailingDangling: "в|во|на|к|и|по|через|с|до|а|каждый|каждую|каждое",
};
