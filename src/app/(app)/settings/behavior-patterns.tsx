import { SectionLabel } from "@/components/ui/section-label";
import {
  ANALYTICS_PARTS,
  MIN_TOTAL,
  isComparable,
  patternSentence,
  weekSentence,
  type AnalyticsPart,
  type BehaviorPatterns,
  type Tally,
} from "@/features/analytics/behavior-stats";

// sprint-13-tasks.md S13-04 — what the last 30 days say about when tasks get
// done. No handoff design: built from the "Last 7 days" pieces next to it.
// The bars only repeat the numbers beside them (aria-hidden), so all of it
// reads the same without them; grey text is --tasks-meta (AA, see
// recent-activity.tsx).

const PART_LABELS: Record<AnalyticsPart, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  late: "After 20:00",
};

const PART_HOURS: Record<AnalyticsPart, string> = {
  morning: "05–12",
  afternoon: "12–18",
  evening: "18–20",
  late: "20–05",
};

export function BehaviorPatternsSection({
  patterns,
}: {
  patterns: BehaviorPatterns;
}) {
  const sentences = [patternSentence(patterns), weekSentence(patterns)].filter(
    (sentence): sentence is string => sentence !== null,
  );

  return (
    <div className="flex flex-col gap-3">
      <SectionLabel>Your patterns · last 30 days</SectionLabel>
      {patterns.enough ? (
        <>
          {sentences.map((sentence) => (
            <p key={sentence} className="text-[15px] leading-[1.5]">
              {sentence}
            </p>
          ))}
          <ul className="flex flex-col gap-2.5">
            {ANALYTICS_PARTS.map((part) => (
              <PartRow
                key={part}
                label={PART_LABELS[part]}
                hours={PART_HOURS[part]}
                tally={patterns.byPart[part]}
              />
            ))}
          </ul>
          <p className="text-tasks-meta text-sm">
            Weekdays {percentLabel(patterns.weekdays)} · Weekends{" "}
            {percentLabel(patterns.weekends)}
          </p>
        </>
      ) : (
        <p className="text-tasks-meta text-sm leading-[1.5]">
          Not enough history yet — patterns show up once you&apos;ve marked a
          few weeks of tasks ({patterns.overall.total} of {MIN_TOTAL} so far).
        </p>
      )}
    </div>
  );
}

function percentLabel(tally: Tally): string {
  return tally.percent === null ? "—" : `${tally.percent}%`;
}

function PartRow({
  label,
  hours,
  tally,
}: {
  label: string;
  hours: string;
  tally: Tally;
}) {
  const comparable = isComparable(tally);
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>
          {label} <span className="text-tasks-meta text-xs">{hours}</span>
        </span>
        <span className="text-tasks-meta text-xs">
          {tally.total === 0
            ? "no tasks"
            : comparable
              ? `${tally.done} of ${tally.total} · `
              : `${tally.done} of ${tally.total} · too few`}
          {comparable && (
            <span className="text-text-primary text-sm font-semibold">
              {percentLabel(tally)}
            </span>
          )}
        </span>
      </div>
      <div
        aria-hidden
        className="bg-separator rounded-pill h-1.5 w-full overflow-hidden"
      >
        {tally.total > 0 && (
          <div
            className={
              comparable
                ? "bg-burgundy rounded-pill h-full"
                : "bg-tasks-muted rounded-pill h-full"
            }
            style={{ width: `${tally.percent}%` }}
          />
        )}
      </div>
    </li>
  );
}
