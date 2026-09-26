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
};

export type RuleContext = {
  /** The user's today, "YYYY-MM-DD". */
  today: string;
  out: ParsedFields;
};

/** Return false to reject the match: nothing is set, nothing consumed. */
type Apply = (match: RegExpExecArray, ctx: RuleContext) => boolean | void;

export type Rule = { pattern: RegExp; apply: Apply };

export type Language = {
  id: string;
  groups: Rule[][];
  /** Leading phrases like "remind me to", stripped from the title. */
  fillers: RegExp;
  /** Words left dangling at the title's start or end ("on", "at"). */
  leadingDangling: string;
  trailingDangling: string;
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

/** "1,5" and "1.5" alike. */
export function decimal(value: string): number {
  return parseFloat(value.replace(",", "."));
}

// --- The run ---------------------------------------------------------------

export function runLanguage(
  language: Language,
  text: string,
  today: string,
): LanguageResult {
  let rest = text.replace(/\s+/g, " ");
  const out: ParsedFields = {};
  const hits: { index: number; text: string }[] = [];

  for (const group of language.groups) {
    let matched = false;
    for (const { pattern, apply } of group) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while (!matched && (match = pattern.exec(rest)) !== null) {
        if (apply(match, { today, out }) === false) continue;
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

  return {
    ...out,
    title: cleanTitle(rest, language),
    hits: hits.sort((a, b) => a.index - b.index).map((hit) => hit.text),
  };
}

// § 3 — title cleanup: drop "remind me to"-style openers and words left
// dangling by what was taken out, tidy punctuation, capitalise.
function cleanTitle(rest: string, language: Language): string {
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
  for (let pass = 0; pass < 4; pass++) {
    title = title.replace(leading, "").replace(trailing, "").trim();
  }
  if (alone.test(title)) title = "";
  title = title.replace(/\s+([,.!?])/g, "$1");
  return title ? title.charAt(0).toLocaleUpperCase() + title.slice(1) : "";
}
