import { parseTask, type ParsedTask } from "@/lib/parse-task";
import { splitTaskPhrase } from "@/lib/parse-task/split";

// sprint-20-tasks.md п.5–6 — "Pills twice a day for a month", "Таблетки
// утром и вечером через день на месяц": a course with several doses a
// day. A task has one time for all its days (and a series one day per
// date), so each dose is its own task — "Pills — morning" at 09:00 and
// "Pills — evening" at 20:00 — sharing the repeat and its end. Only for a
// course: the text must say how long it runs or every N days; "every
// morning" alone stays a task without a time, as in Sprint 18.

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

// One dose at one part of the day: "every other day in the evening for a
// month", "через день вечером в течение месяца" (backlog 2026-10-03 №2).
const ONE_DAYPART = words(
  [
    "(?<!(?:every|each) )(?:in the )?(morning|afternoon|evening)s?",
    "(утром|дн[её]м|вечером)",
    "(вранці|зранку|вдень|ввечері|увечері)",
  ].join("|"),
);

const PART_OF_WORD: Record<string, 0 | 1 | 2> = {
  morning: 0,
  afternoon: 1,
  evening: 2,
  утром: 0,
  днём: 1,
  днем: 1,
  вечером: 2,
  вранці: 0,
  зранку: 0,
  вдень: 1,
  ввечері: 2,
  увечері: 2,
};

const PART_TIMES = ["09:00", "14:00", "20:00"] as const;

const DOSES: Record<number, { time: string; part: 0 | 1 | 2 }[]> = {
  2: [
    { time: "09:00", part: 0 },
    { time: "20:00", part: 2 },
  ],
  3: [
    { time: "09:00", part: 0 },
    { time: "14:00", part: 1 },
    { time: "20:00", part: 2 },
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
  const isCourse =
    parsed.repeatUntil !== undefined || parsed.repeatInterval !== undefined;
  if (!isCourse || parsed.time || parsed.timeSearch || !parsed.title) {
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

/**
 * "Medicine every other day in the evening for a month": one dose, so one
 * task — at the part of the day's time, the word out of the title. Only
 * for a course (a span or a step) and with no time of its own; anything
 * else is parseTask's reading as it is.
 */
export function parseTaskText(text: string, today: string): ParsedTask {
  return oneDoseCourse(text, today) ?? parseTask(text, today);
}

function oneDoseCourse(text: string, today: string): ParsedTask | null {
  const found = [...text.matchAll(ONE_DAYPART)];
  if (found.length !== 1) return null;
  const word = found[0].slice(1).find(Boolean)!.toLowerCase();
  const part = PART_OF_WORD[word];
  if (part === undefined) return null;
  const rest = text.replace(found[0][0], " ").replace(/\s+/g, " ").trim();
  const parsed = parseTask(rest, today);
  const isCourse =
    parsed.repeat !== undefined &&
    (parsed.repeatUntil !== undefined || parsed.repeatInterval !== undefined);
  if (!isCourse || parsed.time || parsed.timeSearch || !parsed.title) {
    return null;
  }
  return {
    ...parsed,
    time: PART_TIMES[part],
    course: true,
    hits: [...parsed.hits, found[0][0].trim()],
  };
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
