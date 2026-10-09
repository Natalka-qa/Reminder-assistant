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

// NEW_TASK_V2_UPDATE.md § 3.1 — Ukrainian, with its own forms ("у
// понеділок", "по понеділках", "щопонеділка", "1 жовтня", "о 9", "на
// годину"). "Вранці" or "ввечері" alone are the part of the day's time,
// 09:00 or 20:00 (2026-10-09 decision 1; before, they set nothing).

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

/** Weekday words, for splitting "Mon at 19 and Wed at 20" (split.ts). */
export const WEEKDAY_PATTERN = WEEKDAY;

// sprint-20-tasks.md п.3 — the unit of "for a month" / "на 2 недели".
const UNITS = { month: /^міс/iu, week: /^тиж/iu };

// A count in digits or words: "3", "три", "трьох", "п'яти".
const NUM = numberPattern([
  "один",
  "одна",
  "одну",
  "одного",
  "два",
  "дві",
  "двох",
  "три",
  "трьох",
  "чотири",
  "чотирьох",
  "п'ять",
  "п'яти",
  "шість",
  "шести",
  "сім",
  "семи",
  "вісім",
  "восьми",
  "дев'ять",
  "дев'яти",
  "десять",
  "десяти",
]);

// "дня" isn't among the bare units: "3 дня" is 3 p.m. (DAYPART).
const SPAN_UNIT =
  "день|дня|дні|днів|тиждень|тижня|тижні|тижнів|місяць|місяця|місяці|місяців";
const BARE_SPAN_UNIT =
  "день|дні|днів|тиждень|тижні|тижнів|місяць|місяці|місяців";

// Not how long: "через 2 дні" is a date, "кожні 3 дні" a step, "о 3 дня"
// a time, "за 2 дні" before.
const NOT_A_SPAN =
  "(?<!(?<![\\p{L}\\p{N}])(?:через|кожні|кожного|кожен|раз на|за|о|об|в|у|до|після|з|на|цей|цього|наступний|наступного|минулий|минулого) )";

// The parts of the day, said once ("вранці") or as a habit ("щоранку").
const MORNING_HABIT = "щоранку|кожного ранку|по ранках|ранками";
const EVENING_HABIT = "щовечора|кожного вечора|по вечорах|вечорами";

export const uk: Language = {
  id: "uk",
  searchGroups: [
    // sprint-12-tasks.md S12-04 — "знайди (мені) (вільний) час/вікно".
    // Here "час" is "time", not "hour" (that's "годину").
    [
      rule(
        "(?:знайди(?:ть)?|підбери(?:ть)?|пошукай(?:те)?)(?: мені)?(?: (?:вільний|вільне|вільну|вільні))?(?: (час|вікно|віконце|слот))?",
        (match, ctx) => startTimeSearch(ctx, match[1] !== undefined),
      ),
    ],
    // Parts of the day, only inside a search.
    [
      rule("вранці|зранку|уранці", (_, { out }) =>
        setPartOfDay(out, "morning"),
      ),
      rule("вдень|удень|після обіду|по обіді", (_, { out }) =>
        setPartOfDay(out, "afternoon"),
      ),
      rule("ввечері|увечері", (_, { out }) => setPartOfDay(out, "evening")),
    ],
    // "Знайди годину": in a search a bare "годину" is an hour ("на
    // годину" is the ordinary rule's).
    [
      rule("(?<!на )(?:одну )?годин(?:у|ку)", (_, { out }) =>
        setSearchDuration(out, 60),
      ),
    ],
  ],
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
      // sprint-20-tasks.md п.4 — через день, кожні N днів.
      rule("через день|кожного другого дня|раз на два дні", (_, { out }) =>
        setDailyInterval(out, 2),
      ),
      rule(`(?:кожні|раз на) (${NUM}) (?:дні|днів)`, (match, { out }) =>
        setDailyInterval(out, countOf(match[1])),
      ),
      rule(
        "по буднях|у будні|в будні|щобудня|по робочих днях|кожного робочого дня|кожен робочий день|кожного буднього дня",
        (_, { out }) => setWeekly(out, [1, 2, 3, 4, 5]),
      ),
      rule(
        `(?:що|(?:по|кожного|кожної|кожен|кожну) )(?:${WEEKDAY})(?:(?:\\s*(?:,|і|й|та)\\s*|\\s+)(?:по )?(?:${WEEKDAY}))*(?: ([01]?\\d|2[0-3])(?![:.]?\\d)(?! ?(?:год|хв|г)))?`,
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
      // 2026-10-09 decision 1 — "щоранку" is daily, at 09:00.
      rule(MORNING_HABIT, (_, ctx) => setDailyDayPart(ctx, "morning")),
      rule(EVENING_HABIT, (_, ctx) => setDailyDayPart(ctx, "evening")),
      rule(
        "щодня|щоденно|кожного дня|кожен день|щоночі",
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
    // The part of the day: its time unless the text gives one (engine).
    [
      rule(`вранці|зранку|уранці|${MORNING_HABIT}`, (_, ctx) =>
        setDayPart(ctx, "morning"),
      ),
      rule("вдень|удень|після обіду|по обіді", (_, ctx) =>
        setDayPart(ctx, "afternoon"),
      ),
      rule(`ввечері|увечері|${EVENING_HABIT}`, (_, ctx) =>
        setDayPart(ctx, "evening"),
      ),
    ],
    // sprint-20-tasks.md п.3 — скільки триває повтор: «на місяць»,
    // «протягом 2 тижнів», «до 3 листопада», «10 днів поспіль», «3 рази».
    // Без повтору строк сам каже «щодня» (рішення 3 від 2026-10-09).
    [
      rule(
        `(?:на|протягом|впродовж|продовж) (?:(${NUM}) )?(${SPAN_UNIT})(?: поспіль| підряд)?`,
        spanRule(UNITS),
      ),
      rule(
        `${NOT_A_SPAN}(${NUM}) (${BARE_SPAN_UNIT})(?: поспіль| підряд)?(?! тому| потому)`,
        spanRule(UNITS),
      ),
      // A bare "тиждень" / "місяць" — only last.
      rule(`${NOT_A_SPAN}()(тиждень|місяць)(?=[\\s.!]*$)`, spanRule(UNITS)),
      // "3 рази" — not "3 рази на день", the doses of a course (course.ts).
      rule(
        `(${NUM}) (?:рази|разів|раз)(?! (?:на|в|за) (?:день|добу|тиждень|місяць))`,
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
      rule("післязавтра", (_, ctx) => setDaysAhead(ctx, 2)),
      rule("завтра", (_, ctx) => setDaysAhead(ctx, 1)),
      rule("сьогодні", (_, ctx) => setDaysAhead(ctx, 0)),
      rule(`через (${NUM}) (?:день|дні|днів)`, (match, ctx) =>
        setDaysAhead(ctx, countOf(match[1])),
      ),
      rule(`через (?:(${NUM}) )?(?:тиждень|тижні|тижнів)`, (match, ctx) =>
        setDaysAhead(ctx, countOf(match[1]) * 7),
      ),
      rule(`через (?:(${NUM}) )?(?:місяць|місяці|місяців)`, (match, ctx) =>
        setMonthsAhead(ctx, countOf(match[1])),
      ),
      rule("наступного тижня|на наступному тижні", (_, ctx) =>
        setNextWeeksDay(ctx, 1),
      ),
      // sprint-20-tasks.md п.11 — "03/10" is October 3; "о 20.10" a time.
      numericDateRule("на", "о |об |в |у |до "),
      rule(`(?:на )?(\\d{1,2})(?:-?го)? (${MONTH})`, (match, ctx) =>
        setMonthDay(ctx, monthOf(match[2]), Number(match[1])),
      ),
      // "у наступну суботу" — next week's (engine's setNextWeeksDay).
      rule(`(?:(?:у|в|во|на) )?наступн\\p{L}* (${WEEKDAY})`, (match, ctx) => {
        const day = weekdayOf(match[1]);
        if (!day) return false;
        setNextWeeksDay(ctx, day);
      }),
      rule(
        `(?:(?:у|в|во|на) (?:(?:цю|цей|найближч\\p{L}*) )?|найближчого )(${WEEKDAY})`,
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
    // sprint-20-tasks.md п.10 — строк: «до 12», «до 12:30», «до 12-ї».
    [
      rule(
        `до (\\d{1,2})(?:[:.](\\d{2}))?(?:-?(?:ї|ої|ї години))?(?![/.]?\\d)(?! (?:${MONTH}))`,
        (match, { out }) =>
          setDue(out, Number(match[1]), Number(match[2] ?? 0)),
      ),
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
  searchFillers: /^(?:для|щоб|аби|на)\s+/iu,
  kindWords: {
    workout: words(
      "тренуванн\\p{L}*|тренуватися|присід\\p{L}*|присіда\\p{L}*|спортзал\\p{L}*|зал|залі|біг|бігати|пробіжк\\p{L}*|йог\\p{L}*|пілатес\\p{L}*|плаванн\\p{L}*|басейн\\p{L}*|фітнес\\p{L}*|розтяжк\\p{L}*|кросфіт\\p{L}*|зарядк\\p{L}*",
    ),
    remote: words(
      "зателефонувати|подзвонити|дзвінок|дзвінк\\p{L}*|написати|напиши|відповісти|лист|листа|пошт\\p{L}*|email|оплатити|сплатити|оплат\\p{L}*|замовити|записатися|забронювати|онлайн|zoom",
    ),
  },
  leadingDangling: "і|й|та|а",
  trailingDangling: "о|об|в|у|на|до|і|й|та|по|через|з|кожного|кожен|кожну",
};
