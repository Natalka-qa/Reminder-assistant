import { parseTask, type ParsedTask } from "@/lib/parse-task";
import { PART_OF_DAY_TIMES } from "@/lib/parse-task/engine";
import { splitTaskPhrase } from "@/lib/parse-task/split";

// sprint-20-tasks.md п.5–6 — "Pills twice a day for a month", "Таблетки
// утром и вечером через день на месяц": a course with several doses a
// day. A task has one time for all its days (and a series one day per
// date), so each dose is its own task — "Pills — morning" at 09:00 and
// "Pills — evening" at 20:00 — sharing the repeat and its end. Only for a
// course: the text must say how long it runs (a span or a count) or every
// N days. A single part of the day ("every morning") is parseTask's own:
// the part's time (2026-10-09 decision 1).

const L = "[\\p{L}\\p{N}]";
const words = (source: string) =>
  new RegExp(`(?<!${L})(?:${source})(?!${L})`, "giu");

const COUNT_WORDS: Record<string, number> = {
  "2": 2,
  "3": 3,
  two: 2,
  three: 3,
  twice: 2,
  thrice: 3,
  два: 2,
  дві: 2,
  три: 3,
  дважды: 2,
  трижды: 3,
  двічі: 2,
  тричі: 3,
};

// "twice a day", "2 раза в день", "двічі на день" — and how many.
const TIMES_A_DAY = words(
  [
    "(2|3|two|three) times (?:a|per) day",
    "(twice|thrice) (?:a day|daily)",
    "(2|3|два|три) раза (?:в|за) день",
    "(дважды|трижды) (?:в )?день",
    "(2|3|дві|два|три) рази (?:на|в) день",
    "(двічі|тричі) (?:на )?день",
  ].join("|"),
);

// "morning and evening", "утром и вечером" — two doses; with the middle
// of the day, three.
const DAYPARTS = words(
  [
    "(?:in the )?mornings? and (?:in the )?evenings?",
    "(?:in the )?morning, (?:in the )?afternoon,? and (?:in the )?evening",
    "утром и вечером",
    "утром, дн[её]м и вечером",
    "(?:вранці|зранку) (?:і|й|та) (?:ввечері|увечері)",
    "(?:вранці|зранку), вдень (?:і|й|та) (?:ввечері|увечері)",
  ].join("|"),
);

const { morning, afternoon, evening } = PART_OF_DAY_TIMES;
const DOSES: Record<number, { time: string; part: 0 | 1 | 2 }[]> = {
  2: [
    { time: morning, part: 0 },
    { time: evening, part: 2 },
  ],
  3: [
    { time: morning, part: 0 },
    { time: afternoon, part: 1 },
    { time: evening, part: 2 },
  ],
};

const PART_NAMES: Record<ParsedTask["language"], [string, string, string]> = {
  en: ["morning", "afternoon", "evening"],
  ru: ["утро", "день", "вечер"],
  uk: ["ранок", "день", "вечір"],
};

// "a day" says daily: added when the text names no repeat of its own.
const DAILY: Record<ParsedTask["language"], string> = {
  en: "every day",
  ru: "каждый день",
  uk: "щодня",
};

function countIn(match: RegExpMatchArray): number {
  const word = match.slice(1).find(Boolean)?.toLowerCase();
  return (word && COUNT_WORDS[word]) || 2;
}

/**
 * The doses of a course `text` describes, each read as its own task, or
 * null when it isn't one. Each has the course's title with the part of
 * the day ("Pills — morning"), its default time, and `course` set.
 */
export function splitCoursePhrase(
  text: string,
  today: string,
): ParsedTask[] | null {
  const times = [...text.matchAll(TIMES_A_DAY)];
  const parts = [...text.matchAll(DAYPARTS)];
  if (times.length + parts.length === 0) return null;
  const count = times[0] ? countIn(times[0]) : /, /.test(parts[0][0]) ? 3 : 2;

  let rest = text;
  for (const match of [...times, ...parts]) {
    rest = rest.replace(match[0], " ");
  }
  rest = rest.replace(/\s+/g, " ").trim();
  let parsed = parseTask(rest, today);
  if (!parsed.repeat) {
    rest = `${rest} ${DAILY[parsed.language]}`;
    parsed = parseTask(rest, today);
  }
  if (!isCourse(parsed) || parsed.time || parsed.timeSearch || !parsed.title) {
    return null;
  }

  const names = PART_NAMES[parsed.language];
  return DOSES[count].map(({ time, part }) => ({
    ...parsed,
    title: `${parsed.title} — ${names[part]}`,
    time,
    course: true,
  }));
}

/** A course runs for a while (a last day or a count) or every N days. */
function isCourse(parsed: ParsedTask): boolean {
  return (
    parsed.repeatUntil !== undefined ||
    parsed.repeatCount !== undefined ||
    parsed.repeatInterval !== undefined
  );
}

/**
 * One task's reading of `text`, as the New task form and the bot show it.
 * "Medicine every other day in the evening for a month" — one dose, so one
 * task at the part of the day's time — is parseTask's own since every part
 * of the day sets its time (2026-10-09 decision 1).
 */
export function parseTaskText(text: string, today: string): ParsedTask {
  return parseTask(text, today);
}

/**
 * Every task `text` stands for when it's more than one: a dose each of a
 * course (above), or a day-and-time pair each (splitTaskPhrase). Null —
 * it's one task, read by parseTask as it is.
 */
export function readTaskParts(
  text: string,
  today: string,
): ParsedTask[] | null {
  const course = splitCoursePhrase(text, today);
  if (course) return course;
  const sentences = splitTaskPhrase(text);
  if (!sentences) return null;
  const read = sentences.map((sentence) => parseTask(sentence, today));
  return read.every((part) => part.title && !part.timeSearch) ? read : null;
}
