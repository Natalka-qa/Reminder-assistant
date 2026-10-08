import {
  ANALYTICS_PARTS,
  MIN_PER_GROUP,
  PART_WHEN,
  type AnalyticsPart,
  type BehaviorPatterns,
  type Tally,
} from "./behavior-stats";

// sprint-23-tasks.md S23-01 (PROGRESS_V2_UPDATE.md) — How it's going, read
// as the assistant reflecting the week back: the hero line, the rhythm of
// the day, one small pattern. Pure; the numbers are the existing tallies
// (решение 2: the last 7 days, the rhythm over the last 30).

/** Решение 3 — on this screen a pattern needs this gap, in whole points. */
export const PATTERN_GAP_POINTS = 20;

const LABELS: Record<AnalyticsPart, { label: string; hours: string }> = {
  morning: { label: "Morning", hours: "05–12" },
  afternoon: { label: "Afternoon", hours: "12–18" },
  evening: { label: "Evening", hours: "18–20" },
  late: { label: "After 20:00", hours: "20–05" },
};

export type RhythmRow = {
  part: AnalyticsPart;
  label: string;
  /** "05–12 · 2 of 5", or "18–20 · 3 tasks so far" while data is limited. */
  meta: string;
  /** Fewer than MIN_PER_GROUP counted: no bar, no percent, not compared. */
  limited: boolean;
  /** 0–100; null when limited. */
  percent: number | null;
  /** The best comparable part — the only burgundy bar. */
  strongest: boolean;
  /** For screen readers: "Morning, 40 percent, 2 of 5 completed". */
  ariaLabel: string;
};

function tasks(n: number): string {
  return `${n} task${n === 1 ? "" : "s"}`;
}

export function rhythmRows(patterns: BehaviorPatterns): RhythmRow[] {
  const comparable = ANALYTICS_PARTS.filter(
    (part) => patterns.byPart[part].total >= MIN_PER_GROUP,
  );
  // Ties go to the earlier part.
  const strongest = comparable.reduce<AnalyticsPart | null>(
    (best, part) =>
      best === null ||
      (patterns.byPart[part].percent ?? 0) >
        (patterns.byPart[best].percent ?? 0)
        ? part
        : best,
    null,
  );
  return ANALYTICS_PARTS.map((part) => {
    const tally: Tally = patterns.byPart[part];
    const { label, hours } = LABELS[part];
    const limited = tally.total < MIN_PER_GROUP;
    return {
      part,
      label,
      meta: limited
        ? tally.total === 0
          ? `${hours} · no tasks yet`
          : `${hours} · ${tasks(tally.total)} so far`
        : `${hours} · ${tally.done} of ${tally.total}`,
      limited,
      percent: limited ? null : tally.percent,
      strongest: part === strongest,
      ariaLabel: limited
        ? `${label}, limited data, ${tasks(tally.total)} so far`
        : `${label}, ${tally.percent} percent, ${tally.done} of ${tally.total} completed`,
    };
  });
}

/**
 * §2 — under the hero: "10 completed · 2 missed", and the counts that are
 * zero folded into one quiet phrase, "nothing partial or skipped".
 */
export function heroMeta(tally: Tally): {
  counts: string;
  quiet: string | null;
} {
  const others = [
    { n: tally.partial, word: "partial" },
    { n: tally.skipped, word: "skipped" },
    { n: tally.missed, word: "missed" },
  ];
  const counts = [
    `${tally.done} completed`,
    ...others.filter((o) => o.n > 0).map((o) => `${o.n} ${o.word}`),
  ].join(" · ");
  const zero = others.filter((o) => o.n === 0).map((o) => o.word);
  const quiet =
    zero.length === 0
      ? null
      : `nothing ${
          zero.length === 1
            ? zero[0]
            : `${zero.slice(0, -1).join(", ")} or ${zero.at(-1)}`
        }`;
  return { counts, quiet };
}

const SENTENCE_WHEN: Record<AnalyticsPart, string> = {
  morning: "in the morning",
  afternoon: "in the afternoon",
  evening: "in the evening",
  // §4 — after 20:00 reads as the evening too.
  late: "in the evening",
};

export type SmallPattern = { sentence: string; evidence: string };

/**
 * §4 — observed, not instructed: shown only with at least two parts of the
 * day that have enough data and a gap of PATTERN_GAP_POINTS or more
 * between the strongest and the weakest of them. Otherwise nothing.
 */
export function smallPattern(rows: RhythmRow[]): SmallPattern | null {
  const comparable = rows.filter(
    (row): row is RhythmRow & { percent: number } =>
      !row.limited && row.percent !== null,
  );
  if (comparable.length < 2) return null;
  const top = comparable.reduce((a, b) => (b.percent > a.percent ? b : a));
  const low = comparable.reduce((a, b) => (b.percent < a.percent ? b : a));
  if (top.percent - low.percent < PATTERN_GAP_POINTS) return null;
  return {
    sentence: `You tend to finish more tasks ${SENTENCE_WHEN[top.part]}.`,
    evidence: `${top.percent}% ${PART_WHEN[top.part]} · ${low.percent}% ${PART_WHEN[low.part]}`,
  };
}
