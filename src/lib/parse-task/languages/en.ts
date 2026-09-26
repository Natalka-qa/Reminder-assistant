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

export const en: Language = {
  id: "en",
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
      rule("(?:every|each|on) (?:weekdays?|workdays?)", (_, { out }) =>
        setWeekly(out, [1, 2, 3, 4, 5]),
      ),
      rule(
        `(?:every|each) (?:${WEEKDAY})(?:\\s*(?:,|and|&)\\s*(?:${WEEKDAY}))*`,
        (match, { out }) =>
          setWeekly(
            out,
            match[0]
              .replace(/^(?:every|each)\s+/i, "")
              .split(/\s*(?:,|and|&)\s*/i)
              .map(weekdayOf),
          ),
      ),
      rule(
        "every ?day|daily|each day|every (?:morning|afternoon|evening|night)",
        (_, { out }) => void (out.repeat = "DAILY"),
      ),
      rule("every week|weekly", (_, { out }) => void (out.repeat = "WEEKLY")),
      rule(
        "every month|monthly",
        (_, { out }) => void (out.repeat = "MONTHLY"),
      ),
    ],
    // Date
    [
      rule("(?:on )?(?:the )?day after tomorrow", (_, ctx) =>
        setDaysAhead(ctx, 2),
      ),
      rule("tomorrow|tmrw", (_, ctx) => setDaysAhead(ctx, 1)),
      rule("today|tonight|this (?:morning|afternoon|evening)", (_, ctx) =>
        setDaysAhead(ctx, 0),
      ),
      rule("in (\\d{1,3}) days?", (match, ctx) =>
        setDaysAhead(ctx, Number(match[1])),
      ),
      rule(
        `(?:on )?(?:the )?(${MONTH})\\.? (\\d{1,2})(?:st|nd|rd|th)?`,
        (match, ctx) => setMonthDay(ctx, monthOf(match[1]), Number(match[2])),
      ),
      rule(
        `(?:on )?(?:the )?(\\d{1,2})(?:st|nd|rd|th)? (?:of )?(${MONTH})`,
        (match, ctx) => setMonthDay(ctx, monthOf(match[2]), Number(match[1])),
      ),
      // "on fri" / "next tue" / "monday" — a bare abbreviation isn't
      // taken on its own ("I sat down", "the sun").
      rule(`(?:on|this|next) (${WEEKDAY})`, (match, ctx) =>
        setNextWeekday(ctx, weekdayOf(match[1])),
      ),
      rule(`(${FULL_WEEKDAY})`, (match, ctx) =>
        setNextWeekday(ctx, weekdayOf(match[1])),
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
  leadingDangling: "on|at|for|by|in|every|and",
  trailingDangling: "on|at|for|by|in|every|and|from",
};
