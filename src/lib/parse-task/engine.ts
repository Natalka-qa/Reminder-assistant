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

/**
 * A day of a month with no year: this year's, or next year's once this
 * year's has passed (§ 3, absolute dates).
 */
export function setMonthDay(
  ctx: RuleContext,
  month: number,
  day: number,
): boolean {
  const year = Number(ctx.today.slice(0, 4));
  let date = calendarDate(year, month, day);
  if (date && date < ctx.today) {
    date = calendarDate(year + 1, month, day);
  }
  if (!date) return false;
  ctx.out.date = date;
  return true;
}

/** § 3 — a weekday means its next occurrence after today. */
export function setNextWeekday(ctx: RuleContext, weekday: number): void {
  const ahead = (weekday - isoWeekday(ctx.today) + 7) % 7 || 7;
  ctx.out.date = shiftDate(ctx.today, ahead);
}

export function setDaysAhead(ctx: RuleContext, days: number): boolean {
  if (days > 366) return false;
  ctx.out.date = shiftDate(ctx.today, days);
  return true;
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
 * sets nothing and stays in the title — the spec's "don't guess a time".
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

  for (const group of groups) {
    let matched = false;
    for (const { pattern, apply } of group) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while (!matched && (match = pattern.exec(rest)) !== null) {
        if (apply(match, ctx) === false) continue;
        hits.push({
          index: match.index,
          text: match[0].replace(/^[\s,]+|[\s,]+$/g, ""),
        });
        rest =
          rest.slice(0, match.index) +
          " ".repeat(match[0].length) +
          rest.slice(match.index + match[0].length);
        matched = true;
      }
      if (matched) break;
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
