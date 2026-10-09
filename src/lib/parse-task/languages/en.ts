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
  setTime,
  setWeekly,
  spanRule,
  startTimeSearch,
  words,
  type DayPart,
  type Language,
} from "@/lib/parse-task/engine";

// NEW_TASK_V2_UPDATE.md § 3 — English, as in the table.

const FULL_WEEKDAY = "monday|tuesday|wednesday|thursday|friday|saturday|sunday";
const WEEKDAY = `${FULL_WEEKDAY}|mon|tues|tue|wed|thurs|thur|thu|fri|sat|sun`;
const WEEKDAY_NUMBER: Record<string, number> = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  sun: 7,
};
const weekdayOf = (word: string) =>
  WEEKDAY_NUMBER[word.trim().slice(0, 3).toLowerCase()];

const MONTH =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const MONTH_PREFIXES = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];
const monthOf = (word: string) =>
  MONTH_PREFIXES.indexOf(word.slice(0, 3).toLowerCase()) + 1;

const MERIDIEM = "am|pm|a\\.m\\.|p\\.m\\.";
const meridiemOf = (value: string | undefined) =>
  value ? (value.replace(/\./g, "").toLowerCase() as "am" | "pm") : undefined;

/** Weekday words, for splitting "Mon at 19 and Wed at 20" (split.ts). */
export const WEEKDAY_PATTERN = WEEKDAY;

// sprint-20-tasks.md п.3 — the unit of "for a month" / "на 2 недели".
const UNITS = { month: /^month/i, week: /^week/i };

// A count in digits or words: "3", "three".
const NUM = numberPattern([
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
]);

// Not how long: "in 2 weeks" is a date, "every 3 days" a step.
const NOT_A_SPAN =
  "(?<!(?<![\\p{L}\\p{N}])(?:in|every|each|within|after|for|at|by) )";

const dayPartOf = (word: string) =>
  word.toLowerCase().replace(/s$/, "") as DayPart;

export const en: Language = {
  id: "en",
  searchGroups: [
    // sprint-12-tasks.md S12-04 — "find me an hour", "find a time".
    [
      rule(
        "(?:please )?(?:find|look for|search for)(?: me)?(?: (a|some))?(?: free)?(?: (time|slot|window|spot))?",
        (match, ctx) => startTimeSearch(ctx, match[2] !== undefined),
      ),
    ],
    // Parts of the day, only inside a search.
    [
      rule("(?:in the )?morning", (_, { out }) => setPartOfDay(out, "morning")),
      rule("(?:in the )?afternoon", (_, { out }) =>
        setPartOfDay(out, "afternoon"),
      ),
      rule("(?:in the )?evening|at night", (_, { out }) =>
        setPartOfDay(out, "evening"),
      ),
    ],
  ],
  groups: [
    // Importance
    [
      rule(
        "urgent|important|asap",
        (_, { out }) => void (out.priority = "HIGH"),
      ),
    ],
    // Repeat
    [
      // sprint-20-tasks.md п.4 — every N days.
      rule("every (?:other|second) day", (_, { out }) =>
        setDailyInterval(out, 2),
      ),
      rule(`every (${NUM}) days`, (match, { out }) =>
        setDailyInterval(out, countOf(match[1])),
      ),
      rule("(?:every|each|on) (?:weekdays?|workdays?)", (_, { out }) =>
        setWeekly(out, [1, 2, 3, 4, 5]),
      ),
      // "every mon and wed", "every mon, wed", and "every Mon Wed" — the
      // days may also follow one another with just a space.
      rule(
        `(?:every|each) (?:${WEEKDAY})(?:(?:\\s*(?:,|and|&)\\s*|\\s+)(?:${WEEKDAY}))*`,
        (match, { out }) =>
          setWeekly(
            out,
            match[0]
              .replace(/^(?:every|each)\s+/i, "")
              .split(/\s*(?:,|and|&)\s*|\s+/i)
              .map(weekdayOf),
          ),
      ),
      // 2026-10-09 decision 1 — "every morning", "in the evenings":
      // daily, at that part of the day's time.
      rule(
        "(?:every|each) (morning|afternoon|evening)|(?:in the |on )?(mornings|afternoons|evenings)",
        (match, ctx) => setDailyDayPart(ctx, dayPartOf(match[1] ?? match[2])),
      ),
      rule(
        "every ?day|daily|each day|every night",
        (_, { out }) => void (out.repeat = "DAILY"),
      ),
      rule("every week|weekly", (_, { out }) => void (out.repeat = "WEEKLY")),
      rule(
        "every month|monthly",
        (_, { out }) => void (out.repeat = "MONTHLY"),
      ),
    ],
    // The part of the day: its time unless the text gives one (engine).
    [
      rule(
        "in the (morning|afternoon|evening)|(?:every|each) (morning|afternoon|evening)|(?:in the |on )?(mornings|afternoons|evenings)",
        (match, ctx) =>
          setDayPart(ctx, dayPartOf(match[1] ?? match[2] ?? match[3])),
      ),
    ],
    // sprint-20-tasks.md п.3 — how long a repeat runs: "for a month",
    // "until Nov 3", "10 days in a row", "3 times". With no repeat of its
    // own a span says "daily" (2026-10-09 decision 3).
    [
      rule(
        `(?:for|during|over) (?:the next )?(an?|${NUM}) (days?|weeks?|months?)(?: in a row| straight)?`,
        spanRule(UNITS),
      ),
      rule(
        `${NOT_A_SPAN}(${NUM}) (days?|weeks?|months?)(?: in a row| straight)?(?! ago| later| before| after| from)`,
        spanRule(UNITS),
      ),
      // "3 times" — not "3 times a day", the doses of a course (course.ts).
      rule(
        `(${NUM}) times(?! (?:a|per|each) (?:day|week|month))`,
        (match, ctx) => setRepeatCount(ctx, countOf(match[1])),
      ),
      rule(
        `(?:until|till|through) (?:the )?(${MONTH})\\.? (\\d{1,2})(?:st|nd|rd|th)?`,
        (match, ctx) =>
          setRepeatUntil(
            ctx,
            monthDayDate(ctx.today, monthOf(match[1]), Number(match[2])),
          ),
      ),
      rule(
        `(?:until|till|through) (?:the )?(\\d{1,2})(?:st|nd|rd|th)? (?:of )?(${MONTH})`,
        (match, ctx) =>
          setRepeatUntil(
            ctx,
            monthDayDate(ctx.today, monthOf(match[2]), Number(match[1])),
          ),
      ),
      rule(`(?:until|till|through) ${NUMERIC_DATE}`, (match, ctx) =>
        setRepeatUntil(ctx, numericDateOf(match, 1, ctx.today)),
      ),
    ],
    // Date
    [
      rule("(?:on )?(?:the )?day after tomorrow", (_, ctx) =>
        setDaysAhead(ctx, 2),
      ),
      rule("tomorrow|tmrw", (_, ctx) => setDaysAhead(ctx, 1)),
      rule("today|tonight|this (morning|afternoon|evening)", (match, ctx) => {
        // "tonight"/"this evening" also say when in the day: a search's
        // part of the day, or the time (2026-10-09 decision 1).
        const part = /tonight/i.test(match[0])
          ? "evening"
          : match[1] && dayPartOf(match[1]);
        if (part) {
          setPartOfDay(ctx.out, part);
          setDayPart(ctx, part);
        }
        return setDaysAhead(ctx, 0);
      }),
      rule(`in (an?|${NUM}) days?`, (match, ctx) =>
        setDaysAhead(ctx, countOf(match[1])),
      ),
      rule(`in (an?|${NUM}) weeks?`, (match, ctx) =>
        setDaysAhead(ctx, countOf(match[1]) * 7),
      ),
      rule(`in (an?|${NUM}) months?`, (match, ctx) =>
        setMonthsAhead(ctx, countOf(match[1])),
      ),
      rule("next week", (_, ctx) => setNextWeeksDay(ctx, 1)),
      // sprint-20-tasks.md п.11 — "03/10" is October 3; "at 20.10" a time.
      numericDateRule("on", "at |by |@ ?"),
      rule(
        `(?:on )?(?:the )?(${MONTH})\\.? (\\d{1,2})(?:st|nd|rd|th)?`,
        (match, ctx) => setMonthDay(ctx, monthOf(match[1]), Number(match[2])),
      ),
      rule(
        `(?:on )?(?:the )?(\\d{1,2})(?:st|nd|rd|th)? (?:of )?(${MONTH})`,
        (match, ctx) => setMonthDay(ctx, monthOf(match[2]), Number(match[1])),
      ),
      // "next sat" — next week's (engine's setNextWeeksDay).
      rule(`(?:on )?next (${WEEKDAY})`, (match, ctx) =>
        setNextWeeksDay(ctx, weekdayOf(match[1])),
      ),
      // "on fri" / "this tue" / "monday" — a bare abbreviation isn't
      // taken on its own ("I sat down", "the sun").
      rule(`(?:on|this) (${WEEKDAY})`, (match, ctx) =>
        setNextWeekday(ctx, weekdayOf(match[1])),
      ),
      rule(`(${FULL_WEEKDAY})`, (match, ctx) =>
        setNextWeekday(ctx, weekdayOf(match[1])),
      ),
    ],
    // sprint-20-tasks.md п.10 — a deadline: "by 12", "by 12:30", "by noon".
    [
      rule("by noon|by midday", (_, { out }) => setDue(out, 12, 0)),
      rule(
        `by (\\d{1,2})(?:[:.](\\d{2}))?(?: ?(${MERIDIEM}))?(?![/.]?\\d)`,
        (match, { out }) =>
          setDue(
            out,
            Number(match[1]),
            Number(match[2] ?? 0),
            meridiemOf(match[3]),
          ),
      ),
    ],
    // Duration
    [
      rule(
        "(?:for )?(\\d{1,2}) ?h(?:ours?|rs?)? ?(\\d{1,2}) ?m(?:in(?:ute)?s?)?",
        (match, { out }) =>
          setDuration(out, Number(match[1]) * 60 + Number(match[2])),
      ),
      rule("(?:for )?half an hour", (_, { out }) => setDuration(out, 30)),
      rule("(?:for )?(?:an?|one) (?:hour|hr)", (_, { out }) =>
        setDuration(out, 60),
      ),
      rule(
        "(?:for )?(\\d{1,2}(?:[.,]\\d+)?) ?(?:hours?|hrs?|h)",
        (match, { out }) => {
          const hours = decimal(match[1]);
          return hours <= 12 && setDuration(out, hours * 60);
        },
      ),
      rule("(?:for )?(\\d{1,3}) ?(?:minutes?|mins?|m)", (match, { out }) => {
        const minutes = Number(match[1]);
        return minutes <= 600 && setDuration(out, minutes);
      }),
    ],
    // Time
    [
      rule(
        `(?:at |@ ?)?(\\d{1,2})[:.](\\d{2})(?: ?(${MERIDIEM}))?`,
        (match, { out }) =>
          setTime(
            out,
            Number(match[1]),
            Number(match[2]),
            meridiemOf(match[3]),
          ),
      ),
      rule(`(?:at |@ ?)?(\\d{1,2}) ?(${MERIDIEM})`, (match, { out }) =>
        setTime(out, Number(match[1]), 0, meridiemOf(match[2])),
      ),
      // § 3 — a bare "at 1"–"at 5" means the afternoon.
      rule("(?:at|@) ?(\\d{1,2})", (match, { out }) => {
        const hour = Number(match[1]);
        return setTime(out, hour >= 1 && hour <= 5 ? hour + 12 : hour, 0);
      }),
      rule("(?:at )?noon", (_, { out }) => setTime(out, 12, 0)),
    ],
  ],
  fillers:
    /^(?:remind me to|remember to|i need to|need to|don['’]t forget to)\s+/iu,
  searchFillers: /^(?:(?:to|for)\s+)?(?:(?:a|an|the|my)\s+)?/iu,
  kindWords: {
    workout: words(
      "workout|work out|squats?|squatting|gym|run|running|jog|jogging|yoga|pilates|swim|swimming|training|exercise|fitness|cycling|crossfit|stretching",
    ),
    remote: words(
      "call|phone|ring|email|e-mail|message|text|reply|write|pay|order|book|renew|submit|zoom|online",
    ),
  },
  leadingDangling: "on|at|for|by|in|every|and",
  trailingDangling: "on|at|for|by|in|every|and|from",
};
