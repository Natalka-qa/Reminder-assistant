import {
  detectKind,
  runLanguage,
  type Language,
  type LanguageResult,
  type TaskKind,
} from "@/lib/parse-task/engine";
import { guessDuration } from "@/lib/parse-task/duration-guess";
import { en } from "@/lib/parse-task/languages/en";
import { ru } from "@/lib/parse-task/languages/ru";
import { uk } from "@/lib/parse-task/languages/uk";
import { es } from "@/lib/parse-task/languages/es";

export type {
  ParsedFields,
  RepeatFrequency,
  TaskKind,
} from "@/lib/parse-task/engine";

export type ParsedTask = LanguageResult & {
  /** Which rule set read the text. */
  language: "en" | "ru" | "uk" | "es";
  /**
   * The usual length of a task with this title (duration-guess.ts) when
   * the text names none: "Танцы" → 60, "Принять таблетки" → 0.
   */
  durationGuess?: number;
};

const CYRILLIC = /\p{Script=Cyrillic}/u;
// Letters Russian doesn't have — a tie between the two goes to Ukrainian.
const UKRAINIAN_ONLY = /[іїєґ]/iu;
// Letters and marks English doesn't use — a tie between the two goes to
// Spanish (sprint-24-tasks.md решение 1).
const SPANISH_ONLY = /[ñ¿¡áéíóú]/iu;

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
  return withDurationGuess(readText(text, today));
}

function withDurationGuess(parsed: ParsedTask): ParsedTask {
  if (parsed.durationMinutes !== undefined) return parsed;
  const guess = guessDuration(parsed.title);
  return guess === undefined ? parsed : { ...parsed, durationGuess: guess };
}

function readText(text: string, today: string): ParsedTask {
  if (!CYRILLIC.test(text)) {
    // Latin text is English or Spanish: the reading that recognises more
    // wins, English on a tie — the app's language — unless the text has
    // Spanish letters ("mañana", "sábado").
    const readings = [
      { ...runLanguage(en, text, today), language: "en" as const },
      { ...runLanguage(es, text, today), language: "es" as const },
    ];
    if (SPANISH_ONLY.test(text)) readings.reverse();
    // "Cena el 03/11", "Cine a las 18:45": the same count, but Spanish
    // took "el" and "a las" too — on equal hits, more words taken wins.
    return pickReading(
      readings,
      (language) => (language === "en" ? es : en),
      (reading) => reading.hits.join(" ").length,
    );
  }
  const readings = [
    { ...runLanguage(ru, text, today), language: "ru" as const },
    { ...runLanguage(uk, text, today), language: "uk" as const },
  ];
  if (UKRAINIAN_ONLY.test(text)) readings.reverse();
  return pickReading(readings, (language) => (language === "ru" ? uk : ru));
}

function pickReading(
  readings: ParsedTask[],
  other: (language: ParsedTask["language"]) => Language,
  tieBreak: (reading: ParsedTask) => number = () => 0,
): ParsedTask {
  const best = readings.reduce((best, reading) =>
    reading.hits.length > best.hits.length ||
    (reading.hits.length === best.hits.length &&
      tieBreak(reading) > tieBreak(best))
      ? reading
      : best,
  );
  // A title with nothing else to recognise ("Написати листа") can land on
  // the other language's reading — its words still say what kind it is.
  if (!best.kind) {
    const kind = detectKind(best.title, other(best.language));
    if (kind) return { ...best, kind };
  }
  return best;
}

/**
 * S12-06 — the kind a saved title reads as, for a task that's already
 * there (Home's "A small suggestion"). Same words as parseTask, in every
 * language the title could be in; a workout still takes precedence.
 */
export function taskKindOf(title: string): TaskKind | undefined {
  const kinds = (CYRILLIC.test(title) ? [ru, uk] : [en, es]).map((language) =>
    detectKind(title, language),
  );
  return kinds.includes("workout") ? "workout" : kinds.find(Boolean);
}
