import { runLanguage, type LanguageResult } from "@/lib/parse-task/engine";
import { en } from "@/lib/parse-task/languages/en";
import { ru } from "@/lib/parse-task/languages/ru";
import { uk } from "@/lib/parse-task/languages/uk";

export type { ParsedFields, RepeatFrequency } from "@/lib/parse-task/engine";

export type ParsedTask = LanguageResult & {
  /** Which rule set read the text. */
  language: "en" | "ru" | "uk";
};

const CYRILLIC = /\p{Script=Cyrillic}/u;
// Letters Russian doesn't have — a tie between the two goes to Ukrainian.
const UKRAINIAN_ONLY = /[іїєґ]/iu;

/**
 * NEW_TASK_V2_UPDATE.md § 3 — reads a task written the way it would be
 * said: its date, time, duration, repeat and importance, and the title left
 * once those phrases are taken out. Rule-based and deterministic: nothing
 * found means nothing set, never a guess. `today` is the user's today,
 * "YYYY-MM-DD".
 *
 * Which language: the app's UI is English (decision F, review of
 * 2026-09-25), so Latin text is read as English. Cyrillic text — where an
 * English reading would only ever catch its numbers ("в 18:00" as
 * "18:00") — is read as both Russian and Ukrainian, which share most of
 * their words ("завтра"), and the reading that recognises more wins; on a
 * tie, Ukrainian if the text has letters only Ukrainian uses.
 */
export function parseTask(text: string, today: string): ParsedTask {
  if (!CYRILLIC.test(text)) {
    return { ...runLanguage(en, text, today), language: "en" };
  }
  const readings = [
    { ...runLanguage(ru, text, today), language: "ru" as const },
    { ...runLanguage(uk, text, today), language: "uk" as const },
  ];
  if (UKRAINIAN_ONLY.test(text)) readings.reverse();
  return readings.reduce((best, reading) =>
    reading.hits.length > best.hits.length ? reading : best,
  );
}
