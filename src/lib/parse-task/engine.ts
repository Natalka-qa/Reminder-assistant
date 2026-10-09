import { calendarDate, isoWeekday, shiftDate } from "@/lib/date/calendar-date";

// NEW_TASK_V2_UPDATE.md § 3 — the rule engine every language shares,
// ported from the prototype's parseTask(). A language is an ordered list
// of rule groups (importance, repeat, date, duration, time); within a
// group the first rule that matches *and* accepts its match wins. An
// accepted phrase is blanked out of the text, remembered for "Picked up",
// and what's left becomes the title. A rule that rejects its match ("at
// 25") leaves the words in the title — invalid values are never consumed.

export type RepeatFrequency = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";

export type ParsedFields = {
  /** "YYYY-MM-DD" */
  date?: string;
  /** "HH:mm" */
  time?: string;
  durationMinutes?: number;
  repeat?: RepeatFrequency;
  /** ISO weekdays, 1 = Monday … 7 = Sunday. */
  repeatDays?: number[];
  /**
   * sprint-20-tasks.md п.4 — a daily repeat every N days ("every other
   * day": 2). Never 1.
   */
  repeatInterval?: number;
  /**
   * п.3 — the repeat's last day, "YYYY-MM-DD": "until Nov 3", or "for a
   * month" counted from the task's date. Only with a repeat.
   */
  repeatUntil?: string;
  /**
   * The repeat's end as a number of times: "3 раза", "10 days in a row",
   * "на 5 дней" (a daily repeat, one day apart). Only with a repeat; never
   * together with `repeatUntil`.
   */
  repeatCount?: number;
  /**
   * п.5–6 — the time is the app's default for a part of the day, not one
   * the text gave: a course's dose ("twice a day for a month", course.ts)
   * or a part of the day alone ("утром", "in the evening" — 09:00, 14:00,
   * 20:00). So the task is Flexible and reminded at its start.
   */
  course?: boolean;
  /**
   * п.7 — "by 12:00": a deadline, "HH:mm", for a task without a time (a
   * time given too wins — the form drops the deadline).
   */
  due?: string;
  priority?: "HIGH";
  /**
   * sprint-12-tasks.md S12-04 — the text asks to find a time ("find me an
   * hour tomorrow evening") instead of giving one. Never set together
   * with `time`: a time the text does give wins.
   */
  timeSearch?: { partOfDay: PartOfDay };
  /**
   * S12-10 — what kind of task the title reads as, for where free time is
   * looked for: a workout (starts by the user's limit) or something that
   * can be done during work hours ("remote": call, write, pay…).
   */
  kind?: TaskKind;
};

export type TaskKind = "workout" | "remote";

/** The searchable parts of the day (features/scheduling/free-slots.ts). */
export type PartOfDay = "morning" | "afternoon" | "evening" | "any";

export type RuleContext = {
  /** The user's today, "YYYY-MM-DD". */
  today: string;
  out: ParsedFields;
  /** A find-a-time trigger named what it's after ("find a time"). */
  searchNoun: boolean;
  /**
   * п.3 — "for a month": how long the repeat runs, made a last day once
   * the date is known (the date rules come after the repeat's). `byDay` —
   * said in days ("5 дней"): a daily repeat a day apart counts them.
   */
  repeatFor?: { days?: number; months?: number; byDay?: boolean };
  /**
   * "утром", "in the evening", "по вечерам": the part of the day the task
   * is in — its default time when the text gives none (see runLanguage).
   */
  partOfDay?: DayPart;
};

/** A part of the day with a time of its own. */
export type DayPart = Exclude<PartOfDay, "any">;

/** The app's time for each part of the day (and for a course's doses). */
export const PART_OF_DAY_TIMES: Record<DayPart, string> = {
  morning: "09:00",
  afternoon: "14:00",
  evening: "20:00",
};

/** Return false to reject the match: nothing is set, nothing consumed. */
type Apply = (match: RegExpExecArray, ctx: RuleContext) => boolean | void;

export type Rule = { pattern: RegExp; apply: Apply };

export type Language = {
  id: string;
  /**
   * S12-04 — a find-a-time trigger and the parts of the day, run before
   * `groups` so those rules know a search is on. Dropped again when the
   * text turns out not to be asking for a time (see runLanguage).
   */
  searchGroups: Rule[][];
  groups: Rule[][];
  /** Leading phrases like "remind me to", stripped from the title. */
  fillers: RegExp;
  /** Words left dangling at the title's start or end ("on", "at"). */
  leadingDangling: string;
  trailingDangling: string;
  /** What's left of a find-a-time request's wording ("for a", "для"). */
  searchFillers: RegExp;
  /** Words in the title that make a task a workout, or a remote task. */
  kindWords: Record<TaskKind, RegExp>;
};

export type LanguageResult = ParsedFields & {
  title: string;
  hits: string[];
};

// `\b` only knows ASCII letters, so words are bounded by "not a letter or
// digit" in any script — Cyrillic included.
const WORD_CHAR = "[\\p{L}\\p{N}]";
const START = `(?<!${WORD_CHAR})`;
const END = `(?!${WORD_CHAR})`;

/** Whole words only, any script, case-insensitive (for testing a title). */
export function words(source: string): RegExp {
  return new RegExp(`${START}(?:${source})${END}`, "iu");
}

/** A rule matching whole words only; the pattern is case-insensitive. */
export function rule(source: string, apply: Apply): Rule {
  return {
    pattern: new RegExp(`${START}(?:${source})${END}`, "giu"),
    apply,
  };
}

// --- Setters shared by the languages' rules --------------------------------

/** Sets the time if it's a real one; `hour` is 0–23 unless `meridiem`. */
export function setTime(
  out: ParsedFields,
  hour: number,
  minute: number,
  meridiem?: "am" | "pm",
): boolean {
  let h = hour;
  if (meridiem) {
    if (h < 1 || h > 12) return false;
    if (meridiem === "pm" && h < 12) h += 12;
    if (meridiem === "am" && h === 12) h = 0;
  }
  if (h > 23 || minute > 59) return false;
  out.time = `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return true;
}

/** sprint-20-tasks.md п.10 — "by 12", "до 12:30": the task's deadline. */
export function setDue(
  out: ParsedFields,
  hour: number,
  minute: number,
  meridiem?: "am" | "pm",
): boolean {
  const probe: ParsedFields = {};
  if (!setTime(probe, hour, minute, meridiem)) return false;
  out.due = probe.time;
  return true;
}

/**
 * A day of a month with no year: this year's, or next year's once this
 * year's has passed (§ 3, absolute dates).
 */
export function setMonthDay(
  ctx: RuleContext,
  month: number,
  day: number,
): boolean {
  const date = monthDayDate(ctx.today, month, day);
  if (!date) return false;
  ctx.out.date = date;
  return true;
}

/** setMonthDay's date, set nowhere; null for a day that doesn't exist. */
export function monthDayDate(
  today: string,
  month: number,
  day: number,
): string | null {
  const year = Number(today.slice(0, 4));
  const date = calendarDate(year, month, day);
  return date && date < today ? calendarDate(year + 1, month, day) : date;
}

/** sprint-20-tasks.md п.4 — "every other day" (2), "every 3 days". */
export function setDailyInterval(out: ParsedFields, interval: number): boolean {
  if (!Number.isInteger(interval) || interval < 2 || interval > 30) {
    return false;
  }
  out.repeat = "DAILY";
  out.repeatDays = undefined;
  out.repeatInterval = interval;
  return true;
}

/**
 * п.3 — "for a month", "на 2 недели", "5 дней": how long a repeat runs. A
 * span with no repeat of its own says "daily" (2026-10-09 decision 3) —
 * one that's more than a day: "на день" alone is no repeat.
 */
export function setRepeatFor(
  ctx: RuleContext,
  span: { days?: number; months?: number; byDay?: boolean },
): boolean {
  const amount = span.days ?? span.months ?? 0;
  if (!Number.isInteger(amount) || amount < 1) return false;
  if ((span.days ?? 0) > 366 || (span.months ?? 0) > 12) return false;
  if (!ctx.out.repeat) {
    if (span.days === 1) return false;
    ctx.out.repeat = "DAILY";
  }
  ctx.repeatFor = span;
  return true;
}

/** A span's count and unit word as days or months. */
function spanUnit(
  n: number,
  unit: string,
  units: { month: RegExp; week: RegExp },
): { days?: number; months?: number; byDay?: boolean } {
  if (units.month.test(unit)) return { months: n };
  if (units.week.test(unit)) return { days: n * 7 };
  return { days: n, byDay: true };
}

/** A span rule's apply: the count in `match[1]`, the unit in `match[2]`. */
export function spanRule(units: { month: RegExp; week: RegExp }): Apply {
  return (match, ctx) =>
    setRepeatFor(ctx, spanUnit(countOf(match[1]), match[2], units));
}

/**
 * "3 раза", "5 times", "3 рази": the repeat ends after that many times. A
 * count with no repeat of its own says "daily", as a span does.
 */
export function setRepeatCount(ctx: RuleContext, count: number): boolean {
  if (!Number.isInteger(count) || count < 2 || count > 366) return false;
  ctx.out.repeat ??= "DAILY";
  ctx.out.repeatCount = count;
  return true;
}

/** "утром", "in the evening": the task's part of the day. */
export function setDayPart(ctx: RuleContext, part: DayPart): boolean {
  ctx.partOfDay = part;
  return true;
}

/** "по утрам", "every evening", "щовечора": daily, in that part of the day. */
export function setDailyDayPart(ctx: RuleContext, part: DayPart): boolean {
  ctx.out.repeat = "DAILY";
  ctx.partOfDay = part;
  return true;
}

/** п.3 — "until Nov 3", "до 3 ноября": a repeat's last day. */
export function setRepeatUntil(ctx: RuleContext, date: string | null): boolean {
  if (!ctx.out.repeat || !date) return false;
  ctx.out.repeatUntil = date;
  return true;
}

// Numbers written as words, in every form a count takes after a
// preposition ("трёх недель", "п'яти днів"). Russian and Ukrainian share
// most of them.
export const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  один: 1,
  одна: 1,
  одну: 1,
  одного: 1,
  одной: 1,
  два: 2,
  две: 2,
  дві: 2,
  двух: 2,
  двох: 2,
  три: 3,
  трёх: 3,
  трех: 3,
  трьох: 3,
  четыре: 4,
  чотири: 4,
  четырёх: 4,
  четырех: 4,
  чотирьох: 4,
  пять: 5,
  "п'ять": 5,
  пяти: 5,
  "п'яти": 5,
  шесть: 6,
  шість: 6,
  шести: 6,
  семь: 7,
  сім: 7,
  семи: 7,
  восемь: 8,
  вісім: 8,
  восьми: 8,
  девять: 9,
  "дев'ять": 9,
  девяти: 9,
  "дев'яти": 9,
  десять: 10,
  десяти: 10,
};

// The apostrophe in п'ять comes typed several ways.
const APOSTROPHES = /['’ʼ`]/gu;

/**
 * The number words of one language as a pattern, longest first, with any
 * apostrophe typed any way. With `\d{1,3}` — a count in digits or words.
 */
export function numberPattern(wordList: string[]): string {
  const alternatives = [...wordList]
    .sort((a, b) => b.length - a.length)
    .map((word) => word.replace("'", "['’ʼ`]"));
  return `\\d{1,3}|${alternatives.join("|")}`;
}

/** "a"/"one" → 1, "2" → 2, "трёх" → 3 — the count in "на 2 недели". */
export function countOf(word: string | undefined): number {
  if (!word) return 1;
  const n = Number(word);
  if (Number.isFinite(n)) return n;
  return NUMBER_WORDS[word.toLowerCase().replace(APOSTROPHES, "'")] ?? 1;
}

/**
 * sprint-20-tasks.md п.11 — a date in digits is always day/month: "03/10"
 * is October 3 (the users are in Europe). With "/" with or without a year
 * ("3/10", "03/10/2026"); with "." too ("03.10.26", and since 2026-10-09
 * decision 2 "20.10" — a two-digit month, not followed by a unit). A dotted
 * one right after the language's "at" (`notAfter`: "в 20.10", "at 20.10")
 * stays a time, as does one that can't be a date ("9.30"). `prefix` is the
 * language's "on" ("on", "на"). A date or slash next to it ("2026/03/10",
 * "1/2/3") isn't taken apart.
 */
export function numericDateRule(prefix: string, notAfter: string): Rule {
  return rule(
    `(?<!(?<![\\p{L}\\p{N}])(?:${notAfter}))(?:${prefix} )?${NUMERIC_DATE}`,
    (match, ctx) => {
      const date = numericDateOf(match, 1, ctx.today);
      if (!date) return false;
      ctx.out.date = date;
      return true;
    },
  );
}

// What can follow "20.10" when it's a time or an amount: "9.30 утра",
// "1.25 hours", "2.10 ч".
const TIME_OR_AMOUNT_AFTER =
  "(?! ?(?:h|hrs?|hours?|m|mins?|minutes?|am|pm|a\\.m|p\\.m|ч|час\\p{L}*|мин\\p{L}*|утра|дня|вечера|ночи|год\\p{L}*|хв\\p{L}*|ранку|вечора|ночі)(?!\\p{L}))";

/**
 * A date in digits, six groups: day, then month and year after "/", or
 * month and year after ".", or a two-digit month after "." with no year
 * (see numericDateRule).
 */
export const NUMERIC_DATE = `(?<![/.\\d])(\\d{1,2})(?:/(\\d{1,2})(?:/(\\d{4}|\\d{2}))?|\\.(\\d{1,2})\\.(\\d{4}|\\d{2})|\\.(\\d{2})${TIME_OR_AMOUNT_AFTER})(?![/.]\\d)`;

/** The date NUMERIC_DATE matched, its groups from `first` on; or null. */
export function numericDateOf(
  match: RegExpExecArray,
  first: number,
  today: string,
): string | null {
  const day = Number(match[first]);
  const month = Number(
    match[first + 1] ?? match[first + 3] ?? match[first + 5],
  );
  const year = match[first + 2] ?? match[first + 4];
  if (year === undefined) return monthDayDate(today, month, day);
  return calendarDate(
    year.length === 2 ? 2000 + Number(year) : Number(year),
    month,
    day,
  );
}

/** § 3 — a weekday means its next occurrence after today. */
export function setNextWeekday(ctx: RuleContext, weekday: number): void {
  const ahead = (weekday - isoWeekday(ctx.today) + 7) % 7 || 7;
  ctx.out.date = shiftDate(ctx.today, ahead);
}

/**
 * "в следующую субботу", "next Saturday": that day of next week (weeks
 * start on Monday) — from Friday, October 9, Saturday the 17th, not the
 * 10th. "Next week" alone is its Monday.
 */
export function setNextWeeksDay(ctx: RuleContext, weekday: number): void {
  const nextMonday = shiftDate(ctx.today, 8 - isoWeekday(ctx.today));
  ctx.out.date = shiftDate(nextMonday, weekday - 1);
}

export function setDaysAhead(ctx: RuleContext, days: number): boolean {
  if (!Number.isInteger(days) || days < 0 || days > 366) return false;
  ctx.out.date = shiftDate(ctx.today, days);
  return true;
}

/** "через месяц", "in 2 months": the same day that many months on. */
export function setMonthsAhead(ctx: RuleContext, months: number): boolean {
  if (!Number.isInteger(months) || months < 1 || months > 12) return false;
  ctx.out.date = shiftMonths(ctx.today, months);
  return true;
}

/** The same day `months` on — or that month's last, if it's shorter. */
function shiftMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const total = m - 1 + months;
  const year = y + Math.floor(total / 12);
  const month = (total % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return calendarDate(year, month, Math.min(d, last))!;
}

export function setDuration(out: ParsedFields, minutes: number): boolean {
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) {
    return false;
  }
  out.durationMinutes = Math.round(minutes);
  return true;
}

export function setWeekly(out: ParsedFields, days: number[]): boolean {
  if (days.length === 0) return false;
  out.repeat = "WEEKLY";
  out.repeatDays = [...new Set(days)].sort((a, b) => a - b);
  return true;
}

/**
 * A find-a-time request: the rules below only apply once it's on.
 * `named` — the trigger said what it's after ("find a time", "найди окно").
 */
export function startTimeSearch(ctx: RuleContext, named: boolean): void {
  ctx.out.timeSearch = { partOfDay: "any" };
  ctx.searchNoun = named;
}

/**
 * A part of the day narrows a time search ("evening"). Outside one it
 * sets nothing here: the language's part-of-day rules read it as the
 * part's time instead (setDayPart, 2026-10-09 decision 1).
 */
export function setPartOfDay(out: ParsedFields, partOfDay: PartOfDay): boolean {
  if (!out.timeSearch) return false;
  out.timeSearch = { partOfDay };
  return true;
}

/** A duration only a time search reads as one (a bare "час" / "годину"). */
export function setSearchDuration(out: ParsedFields, minutes: number): boolean {
  return out.timeSearch !== undefined && setDuration(out, minutes);
}

/** "1,5" and "1.5" alike. */
export function decimal(value: string): number {
  return parseFloat(value.replace(",", "."));
}

// --- The run ---------------------------------------------------------------

export function runLanguage(
  language: Language,
  text: string,
  today: string,
  { withSearch = true } = {},
): LanguageResult {
  let rest = text.replace(/\s+/g, " ");
  const out: ParsedFields = {};
  const ctx: RuleContext = { today, out, searchNoun: false };
  const hits: { index: number; text: string }[] = [];
  const groups = withSearch
    ? [...language.searchGroups, ...language.groups]
    : language.groups;

  const take = (match: RegExpExecArray) => {
    hits.push({
      index: match.index,
      text: match[0].replace(/^[\s,]+|[\s,]+$/g, ""),
    });
    rest =
      rest.slice(0, match.index) +
      " ".repeat(match[0].length) +
      rest.slice(match.index + match[0].length);
  };

  for (const group of groups) {
    let matched = false;
    for (const { pattern, apply } of group) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while (!matched && (match = pattern.exec(rest)) !== null) {
        if (apply(match, ctx) === false) continue;
        take(match);
        matched = true;
      }
      if (!matched) continue;
      // The same thing said twice ("daily … every day") is taken out of
      // the title too — only when it says exactly what the first match
      // did; anything else stays in the title, as before.
      const said = JSON.stringify(out);
      while ((match = pattern.exec(rest)) !== null) {
        const probe = { ...ctx, out: structuredClone(out) };
        if (apply(match, probe) === false) continue;
        if (JSON.stringify(probe.out) === said) take(match);
      }
      break;
    }
  }

  // § 3 — a weekly repeat on given days with no date starts on the first
  // of those days from today on.
  if (out.repeat === "WEEKLY" && out.repeatDays && !out.date) {
    for (let ahead = 0; ahead < 7; ahead++) {
      const date = shiftDate(today, ahead);
      if (out.repeatDays.includes(isoWeekday(date))) {
        out.date = date;
        break;
      }
    }
  }

  // sprint-20-tasks.md п.3 — "for a month" runs from the task's date: the
  // last day is the day before the same date a month on. Days of a daily
  // repeat a day apart ("10 дней подряд") are a count; with a step ("через
  // день 10 дней") they're still a last day.
  if (ctx.repeatFor && out.repeat && !out.repeatUntil && !out.repeatCount) {
    const start = out.date ?? today;
    const { days, months, byDay } = ctx.repeatFor;
    if (days && byDay && out.repeat === "DAILY" && !out.repeatInterval) {
      out.repeatCount = days;
    } else if (days) {
      out.repeatUntil = shiftDate(start, days - 1);
    } else if (months) {
      out.repeatUntil = shiftDate(shiftMonths(start, months), -1);
    }
  }

  // 2026-10-09 decision 1 — a part of the day alone ("Позвонить маме
  // утром") is its time: 09:00, 14:00 or 20:00, Flexible like a course's
  // dose. A time the text gives wins — "вечером в 8" is 20:00, though.
  if (ctx.partOfDay && !out.timeSearch) {
    if (!out.time) {
      out.time = PART_OF_DAY_TIMES[ctx.partOfDay];
      out.course = true;
    } else if (ctx.partOfDay === "evening") {
      const hour = Number(out.time.slice(0, 2));
      if (hour >= 1 && hour < 12) {
        out.time = `${hour + 12}${out.time.slice(2)}`;
      }
    }
  }

  // "Find" alone doesn't ask for a time ("Find my passport"): a search
  // needs the trigger to name it, a duration or a part of the day — else
  // the text is read again without the search rules, words intact. A time
  // the text does give wins over asking to find one.
  if (
    out.timeSearch &&
    (out.time ||
      !(
        ctx.searchNoun ||
        out.durationMinutes !== undefined ||
        out.timeSearch.partOfDay !== "any"
      ))
  ) {
    return runLanguage(language, text, today, { withSearch: false });
  }

  const title = cleanTitle(rest, language, out.timeSearch !== undefined);
  const kind = detectKind(title, language);

  return {
    ...out,
    ...(kind ? { kind } : {}),
    title,
    hits: hits.sort((a, b) => a.index - b.index).map((hit) => hit.text),
  };
}

/**
 * S12-10 — the kind a title reads as in `language`. A workout takes
 * precedence: "Pay for the gym" still reads as a workout — the form's "Can
 * do during work hours" switch is there to say otherwise.
 */
export function detectKind(
  title: string,
  language: Language,
): TaskKind | undefined {
  if (language.kindWords.workout.test(title)) return "workout";
  if (language.kindWords.remote.test(title)) return "remote";
  return undefined;
}

// § 3 — title cleanup: drop "remind me to"-style openers and words left
// dangling by what was taken out, tidy punctuation, capitalise.
function cleanTitle(
  rest: string,
  language: Language,
  searching: boolean,
): string {
  const leading = new RegExp(
    `^(?:(?:${language.leadingDangling})\\s+(?!\\d)|[,;:\\-–—]\\s*)`,
    "iu",
  );
  const trailing = new RegExp(
    `(?:\\s(?:${language.trailingDangling})|\\s*[,;:.!?\\-–—])\\s*$`,
    "iu",
  );
  const alone = new RegExp(
    `^(?:${language.leadingDangling}|${language.trailingDangling})$`,
    "iu",
  );

  let title = rest.replace(/\s+/g, " ").trim().replace(language.fillers, "");
  if (searching) title = title.replace(language.searchFillers, "");
  for (let pass = 0; pass < 4; pass++) {
    title = title.replace(leading, "").replace(trailing, "").trim();
  }
  if (alone.test(title)) title = "";
  title = title.replace(/\s+([,.!?])/g, "$1");
  return title ? title.charAt(0).toLocaleUpperCase() + title.slice(1) : "";
}
