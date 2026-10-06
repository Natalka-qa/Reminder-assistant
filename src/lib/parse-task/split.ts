import { WEEKDAY_PATTERN as EN_WEEKDAY } from "@/lib/parse-task/languages/en";
import { WEEKDAY_PATTERN as RU_WEEKDAY } from "@/lib/parse-task/languages/ru";
import { WEEKDAY_PATTERN as UK_WEEKDAY } from "@/lib/parse-task/languages/uk";

// A task keeps one time for all its days, so "Dance every Mon at 19 and
// Wed at 20" can't be one task. Read as a sentence it would come out as
// "Dance and Wed at 20" on Mondays only. Instead it's split into one
// sentence per day-and-time pair — "Dance every Mon at 19", "Dance every
// Wed at 20" — and each is read by parseTask as usual.

const L = "[\\p{L}\\p{N}]";
const START = `(?<!${L})`;
const END = `(?!${L})`;

type PairSyntax = {
  /** What makes the first day a repeat or a date: "every", "по". */
  prefix: string;
  weekday: string;
  /** "at 19", "19:00", "7pm" — one time. */
  time: string;
};

const EN: PairSyntax = {
  prefix: "every|each|on",
  weekday: `(?:${EN_WEEKDAY})s?`,
  time: "(?:at |@ ?)\\d{1,2}(?:[:.]\\d{2})?(?: ?(?:am|pm))?|\\d{1,2}[:.]\\d{2}(?: ?(?:am|pm))?|\\d{1,2} ?(?:am|pm)",
};

const CYRILLIC_SYNTAX: PairSyntax = {
  prefix: "по|каждый|каждую|каждое|кожного|кожної|кожен|кожну|во|в|у",
  weekday: `(?:${RU_WEEKDAY}|${UK_WEEKDAY})`,
  // "по средам 19" — a bare hour right after the day counts too
  // (the weekly rule reads it as the time).
  time: "(?:в|о|об) \\d{1,2}(?:[:.]\\d{2})?|\\d{1,2}[:.]\\d{2}|(?:[01]?\\d|2[0-3])(?![:.]?\\d)(?! ?(?:час|мин|ч|год|хв|г))",
};

// Nothing but a connector between two pairs: "and", "и", "і", a comma.
const CONNECTOR = /^[\s,]*(?:and|&|и|і|й|та)?[\s,]*$/iu;

const CYRILLIC = /\p{Script=Cyrillic}/u;

/**
 * The sentences `text` stands for: one per day-and-time pair, when it
 * names at least two such pairs right after one another and the first
 * says what they are ("every Mon at 19", "по пн в 19"). A pair without
 * its own prefix takes the first one's ("… and Wed at 20" → "every Wed at
 * 20"). Null when there's nothing to split — the text is read as it is.
 */
export function splitTaskPhrase(text: string): string[] | null {
  const syntax = CYRILLIC.test(text) ? CYRILLIC_SYNTAX : EN;
  const pair = new RegExp(
    `${START}(?:(${syntax.prefix}) )?(${syntax.weekday}) (${syntax.time})${END}`,
    "giu",
  );
  const pairs = [...text.matchAll(pair)];
  if (pairs.length < 2 || !pairs[0][1]) return null;
  for (let i = 1; i < pairs.length; i++) {
    const gap = text.slice(
      pairs[i - 1].index + pairs[i - 1][0].length,
      pairs[i].index,
    );
    if (!CONNECTOR.test(gap)) return null;
  }

  const last = pairs[pairs.length - 1];
  const before = text.slice(0, pairs[0].index).trim();
  const after = text.slice(last.index + last[0].length).trim();
  const prefix = pairs[0][1];
  return pairs.map((match) => {
    const own = match[1] ? match[0] : `${prefix} ${match[0]}`;
    return [before, own, after].filter(Boolean).join(" ");
  });
}
