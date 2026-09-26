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

// NEW_TASK_V2_UPDATE.md § 3.1 — Ukrainian, with its own forms ("у
// понеділок", "по понеділках", "щопонеділка", "1 жовтня", "о 9", "на
// годину"). "Вранці" or "ввечері" alone set no time (don't guess) and stay
// in the title.

// The apostrophe in п'ятниця comes typed several ways.
const APOSTROPHE = "['’ʼ`]";

const WEEKDAY_FORMS: [number, string[]][] = [
  [1, ["понеділок", "понеділка", "понеділках", "пн"]],
  [2, ["вівторок", "вівторка", "вівторках", "вт"]],
  [3, ["середа", "середу", "середи", "середах", "ср"]],
  [4, ["четвер", "четверга", "четвергах", "чт"]],
  [5, ["п'ятниця", "п'ятницю", "п'ятниці", "п'ятницях", "пт"]],
  [6, ["субота", "суботу", "суботи", "суботах", "сб"]],
  [7, ["неділя", "неділю", "неділі", "неділях", "нд"]],
];
const WEEKDAY = WEEKDAY_FORMS.flatMap(([, forms]) => forms)
  .sort((a, b) => b.length - a.length)
  .map((form) => form.replace("'", APOSTROPHE))
  .join("|");
const weekdayOf = (word: string) => {
  const normalized = word.toLowerCase().replace(new RegExp(APOSTROPHE), "'");
  return WEEKDAY_FORMS.find(([, forms]) => forms.includes(normalized))?.[0];
};

const MONTH_GENITIVE = [
  "січня",
  "лютого",
  "березня",
  "квітня",
  "травня",
  "червня",
  "липня",
  "серпня",
  "вересня",
  "жовтня",
  "листопада",
  "грудня",
];
const MONTH = MONTH_GENITIVE.join("|");
const monthOf = (word: string) =>
  MONTH_GENITIVE.indexOf(word.toLowerCase()) + 1;

const DAYPART = "ранку|дня|вечора|ночі";
/** "7 вечора" → 19, "3 дня" → 15, "11 ночі" → 23, "2 ночі" → 2. */
function hourWithDaypart(hour: number, daypart: string | undefined): number {
  switch (daypart?.toLowerCase()) {
    case "ранку":
      return hour === 12 ? 0 : hour;
    case "дня":
      return hour >= 1 && hour <= 6 ? hour + 12 : hour;
    case "вечора":
      return hour < 12 ? hour + 12 : hour;
    case "ночі":
      return hour === 12 ? 0 : hour >= 9 ? hour + 12 : hour;
    default:
      // § 3 — like "at 1"–"at 5": a bare "о 3" is the afternoon.
      return hour >= 1 && hour <= 5 ? hour + 12 : hour;
  }
}

const TIME_PREPOSITION = "о|об|в|у|до";

export const uk: Language = {
  id: "uk",
  groups: [
    // Importance
    [
      rule(
        "терміново|термінове|термінова|терміновий|важливо|важливе|важлива|важливий",
        (_, { out }) => void (out.priority = "HIGH"),
      ),
    ],
    // Repeat
    [
      rule(
        "по буднях|у будні|в будні|щобудня|по робочих днях|кожного робочого дня|кожен робочий день|кожного буднього дня",
        (_, { out }) => setWeekly(out, [1, 2, 3, 4, 5]),
      ),
      rule(
        `(?:що|(?:по|кожного|кожної|кожен|кожну) )(?:${WEEKDAY})(?:\\s*(?:,|і|й|та)\\s*(?:по )?(?:${WEEKDAY}))*`,
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
        "щодня|щоденно|кожного дня|кожен день|щоранку|щовечора|щоночі|кожного ранку|кожного вечора",
        (_, { out }) => void (out.repeat = "DAILY"),
      ),
      rule(
        "щотижня|щотижнево|кожного тижня|кожен тиждень",
        (_, { out }) => void (out.repeat = "WEEKLY"),
      ),
      rule(
        "щомісяця|щомісячно|кожного місяця|кожен місяць",
        (_, { out }) => void (out.repeat = "MONTHLY"),
      ),
    ],
    // Date
    [
      rule("післязавтра", (_, ctx) => setDaysAhead(ctx, 2)),
      rule("завтра", (_, ctx) => setDaysAhead(ctx, 1)),
      rule("сьогодні", (_, ctx) => setDaysAhead(ctx, 0)),
      rule("через (\\d{1,3}) (?:день|дні|днів)", (match, ctx) =>
        setDaysAhead(ctx, Number(match[1])),
      ),
      rule(`(?:на )?(\\d{1,2})(?:-?го)? (${MONTH})`, (match, ctx) =>
        setMonthDay(ctx, monthOf(match[2]), Number(match[1])),
      ),
      rule(
        `(?:(?:у|в|во|на) (?:(?:наступн\\p{L}*|цю|цей|найближч\\p{L}*) )?|(?:наступного|найближчого) )(${WEEKDAY})`,
        (match, ctx) => {
          const day = weekdayOf(match[1]);
          if (!day) return false;
          setNextWeekday(ctx, day);
        },
      ),
      rule("(пн|вт|ср|чт|пт|сб|нд)", (match, ctx) => {
        setNextWeekday(ctx, weekdayOf(match[1])!);
      }),
    ],
    // Duration — "о 9 годині" is a time, hence the lookbehind.
    [
      rule(
        "(?:на )?(\\d{1,2}) ?год(?:ин[иу]?)? ?(\\d{1,2}) ?хв(?:илин[иу]?)?",
        (match, { out }) =>
          setDuration(out, Number(match[1]) * 60 + Number(match[2])),
      ),
      rule("(?:на )?півгодини", (_, { out }) => setDuration(out, 30)),
      rule("(?:на )?півтори години", (_, { out }) => setDuration(out, 90)),
      rule("на (?:одну )?годину", (_, { out }) => setDuration(out, 60)),
      rule(
        `(?:на )?(?<!(?<![\\p{L}\\p{N}])(?:${TIME_PREPOSITION}) )(\\d{1,2}(?:[.,]\\d+)?) ?(?:години|годин|годину|год)`,
        (match, { out }) => {
          const hours = decimal(match[1]);
          return hours <= 12 && setDuration(out, hours * 60);
        },
      ),
      rule("(?:на )?(\\d{1,3}) ?(?:хвилин[иу]?|хв)", (match, { out }) => {
        const minutes = Number(match[1]);
        return minutes <= 600 && setDuration(out, minutes);
      }),
    ],
    // Time
    [
      rule(
        `(?:(?:${TIME_PREPOSITION}) )?(\\d{1,2})[:.](\\d{2})(?: (${DAYPART}))?`,
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
        `(?:${TIME_PREPOSITION}) (\\d{1,2})(?: годин[іи]?)?(?: (${DAYPART}))?`,
        (match, { out }) =>
          setTime(out, hourWithDaypart(Number(match[1]), match[2]), 0),
      ),
      rule(`(\\d{1,2})(?: годин[іи]?)? (${DAYPART})`, (match, { out }) =>
        setTime(out, hourWithDaypart(Number(match[1]), match[2]), 0),
      ),
      rule("опівдні|(?:о )?полудні", (_, { out }) => setTime(out, 12, 0)),
    ],
  ],
  fillers:
    /^(?:нагадай(?:те)?(?: мені)?|нагадати(?: мені)?|не забути|не забудь(?:те)?|мені треба|мені потрібно|треба|потрібно)\s+/iu,
  // As in Russian, a leading "у"/"на" is usually meant ("У магазин").
  leadingDangling: "і|й|та|а",
  trailingDangling: "о|об|в|у|на|до|і|й|та|по|через|з|кожного|кожен|кожну",
};
