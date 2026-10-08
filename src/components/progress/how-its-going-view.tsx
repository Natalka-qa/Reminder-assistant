"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Tally } from "@/features/analytics/behavior-stats";
import type {
  RhythmRow,
  SmallPattern,
} from "@/features/analytics/how-its-going";
import { cn } from "@/lib/utils";

// sprint-23-tasks.md S23-01/02 (PROGRESS_V2_UPDATE.md) — How it's going:
// the assistant reflecting the week back. Typography and whitespace, no
// cards, no chart chrome. The reveal (§5) plays once per entry to the
// screen — the hero counts up with its line, the rhythm rows follow one
// by one, the pattern last — and then stays still; a refresh or a
// re-render doesn't replay it. With reduced motion: the final state.

// §5 — the timeline, from mount (ms).
const HERO_MS = 950;
const ROW_START_MS = 180;
const ROW_STEP_MS = 80;
const ROW_FADE_MS = 380;
const ROW_BAR_MS = 680;
const INSIGHT_START_MS = 1150;
const INSIGHT_MS = 450;
const DONE_MS = INSIGHT_START_MS + INSIGHT_MS;

/** §5 — ease-out cubic, the one curve (--ease-out in globals.css). */
function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

function progress(elapsed: number, start: number, length: number): number {
  return easeOut(Math.min(1, Math.max(0, (elapsed - start) / length)));
}

/** Milliseconds since the screen appeared; DONE_MS at once with reduced motion. */
function useReveal(): number {
  const [elapsed, setElapsed] = useState(0);
  const frame = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      frame.current = requestAnimationFrame(() => setElapsed(DONE_MS));
      return () => cancelAnimationFrame(frame.current);
    }
    const start = performance.now();
    const tick = (now: number) => {
      const next = now - start;
      setElapsed(Math.min(next, DONE_MS));
      if (next < DONE_MS) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, []);
  return elapsed;
}

export function HowItsGoingView({
  tally,
  counts,
  quiet,
  rows,
  pattern,
  footnotes,
}: {
  /** The last 7 days (решение 2). */
  tally: Tally;
  /** "10 completed · 2 missed" (heroMeta). */
  counts: string;
  /** "nothing partial or skipped", or null. */
  quiet: string | null;
  rows: RhythmRow[];
  pattern: SmallPattern | null;
  /** Решение 5 — weekdays vs weekends, the usual workout time. */
  footnotes: string[];
}) {
  const elapsed = useReveal();
  const percent = tally.percent;
  const hero = progress(elapsed, 0, HERO_MS);

  return (
    <div className="flex max-w-[620px] flex-col gap-[60px]">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[45px] leading-[1] font-light">
          How it&apos;s going
        </h1>
        <p className="text-tasks-meta text-[15px]">
          What you planned, and what got done.
        </p>
      </div>

      {percent === null ? (
        <p className="text-text-secondary text-[17px]">
          Nothing to count yet — what you mark in the last 7 days shows here.
        </p>
      ) : (
        <section aria-labelledby="hero-label" className="flex flex-col">
          <p id="hero-label" className="sr-only">
            {percent} percent completed in the last 7 days
          </p>
          <p aria-hidden className="flex items-baseline gap-1.5 tabular-nums">
            <span className="font-display text-[128px] leading-[0.9] font-light tracking-[-0.02em] [font-variant-numeric:tabular-nums_lining-nums] md:text-[168px]">
              {Math.round(hero * percent)}
            </span>
            <span className="font-display text-text-muted text-[46px] font-light md:text-[60px]">
              %
            </span>
          </p>
          <p aria-hidden className="text-text-secondary text-[17px]">
            completed in the last 7 days
          </p>
          <div
            aria-hidden
            className="bg-border relative mt-[18px] mb-2 h-0.5 overflow-hidden rounded-[2px]"
          >
            <div
              className="bg-accent-line absolute inset-y-0 left-0 w-full origin-left rounded-[2px]"
              style={{ transform: `scaleX(${(hero * percent) / 100})` }}
            />
          </div>
          <p className="flex flex-wrap gap-x-3 text-sm">
            <span className="text-text-secondary tabular-nums">{counts}</span>
            {quiet && <span className="text-tasks-meta">{quiet}</span>}
          </p>
        </section>
      )}

      <section
        aria-labelledby="rhythm-heading"
        className="flex flex-col gap-[30px]"
      >
        <div className="flex flex-col gap-1">
          <h2
            id="rhythm-heading"
            className="text-text-muted text-xs font-semibold tracking-[0.14em] uppercase"
          >
            Your rhythm
          </h2>
          <p className="text-tasks-meta text-xs">Last 30 days</p>
        </div>
        <ul className="flex flex-col gap-[30px]">
          {rows.map((row, index) => (
            <RhythmLine
              key={row.part}
              row={row}
              elapsed={elapsed}
              start={ROW_START_MS + index * ROW_STEP_MS}
            />
          ))}
        </ul>
      </section>

      {pattern && (
        <section
          aria-labelledby="pattern-heading"
          className="border-border-soft flex flex-col gap-3 border-t pt-[30px]"
          style={reveal(progress(elapsed, INSIGHT_START_MS, INSIGHT_MS))}
        >
          <h2
            id="pattern-heading"
            className="text-text-muted text-xs font-semibold tracking-[0.14em] uppercase"
          >
            A small pattern
          </h2>
          <p className="font-display max-w-[460px] text-[32px] leading-[1.2] font-light text-pretty">
            {pattern.sentence}
          </p>
          <p className="text-text-muted text-sm tabular-nums">
            {pattern.evidence}
          </p>
          <Link
            href="/calendar"
            className="text-accent-text hover:text-accent-text-hover self-start text-sm font-medium underline-offset-4 hover:underline"
          >
            Adjust your schedule →
          </Link>
        </section>
      )}

      {footnotes.length > 0 && (
        <div className="text-tasks-meta -mt-8 flex flex-col gap-1 text-[13px]">
          {footnotes.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
    </div>
  );
}

/** Opacity 0 → 1 with a 6px rise, by an eased 0–1 progress. */
function reveal(p: number): React.CSSProperties {
  return { opacity: p, transform: `translateY(${(1 - p) * 6}px)` };
}

function RhythmLine({
  row,
  elapsed,
  start,
}: {
  row: RhythmRow;
  elapsed: number;
  start: number;
}) {
  const shown = progress(elapsed, start, ROW_FADE_MS);
  const grown = progress(elapsed, start, ROW_BAR_MS);
  const value = row.percent === null ? null : Math.round(grown * row.percent);
  return (
    <li className="flex flex-col" style={reveal(shown)}>
      {/* §8 — the final values, read at once; the counters are hidden. */}
      <span className="sr-only">{row.ariaLabel}</span>
      <div aria-hidden className="flex items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col">
          <span className="text-text-primary text-base">{row.label}</span>
          <span className="text-tasks-meta text-xs tabular-nums">
            {row.meta}
          </span>
        </div>
        {value === null ? (
          <span className="text-text-muted shrink-0 text-sm">limited data</span>
        ) : (
          <span
            className={cn(
              "shrink-0 text-2xl tabular-nums",
              row.strongest
                ? "text-text-primary font-medium"
                : "text-text-secondary",
            )}
          >
            {value}%
          </span>
        )}
      </div>
      <div
        aria-hidden
        className={cn(
          "relative mt-3 h-[3px] overflow-hidden rounded-[3px]",
          row.limited ? "bg-border-soft/60" : "bg-border-soft",
        )}
      >
        {row.percent !== null && (
          <div
            className={cn(
              "absolute inset-y-0 left-0 w-full origin-left rounded-[3px]",
              row.strongest ? "bg-accent-line" : "bg-chart-neutral",
            )}
            style={{ transform: `scaleX(${(grown * row.percent) / 100})` }}
          />
        )}
      </div>
    </li>
  );
}
