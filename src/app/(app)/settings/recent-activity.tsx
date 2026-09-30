import { SectionLabel } from "@/components/ui/section-label";
import type { Tally } from "@/features/analytics/behavior-stats";

// Settings' "Last 7 days" (README § Settings). S13-03 adds Missed and the
// completion rate — Done out of everything counted, Missed included (§17).
// Grey text is --tasks-meta (5.1:1 on --background): --text-secondary is
// 4.26:1, under AA — same fix as Tasks v2 and Calendar v2.
export function RecentActivity({ stats }: { stats: Tally }) {
  return (
    <div className="flex flex-col gap-3">
      <SectionLabel>Last 7 days</SectionLabel>
      <div className="flex flex-wrap gap-8">
        <Stat value={stats.done} label="Completed" />
        <Stat value={stats.partial} label="Partial" />
        <Stat value={stats.skipped} label="Skipped" />
        <Stat value={stats.missed} label="Missed" />
      </div>
      <p className="text-tasks-meta text-sm">
        Completion rate{" "}
        <span className="text-text-primary font-semibold">
          {stats.percent === null ? "—" : `${stats.percent}%`}
        </span>
      </p>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-display text-[38px] leading-none font-light">
        {value}
      </span>
      <span className="text-tasks-meta text-xs">{label}</span>
    </div>
  );
}
