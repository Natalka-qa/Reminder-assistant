import type { Flexibility, Priority } from "@prisma/client";
import type { OccurrenceStatus } from "@/lib/db/types";

// CALENDAR_V2_UPDATE.md — the week timeline's geometry and block styling
// rules, as plain numbers and strings. No dates, no timezone and no Luxon:
// the page hands every occurrence over as local minutes since midnight, so
// this module stays importable from the client component that lays the
// blocks out (it needs the selected day, which only the client knows).

// § 2.4 — the default range. Decision G (review of 2026-09-25): a week
// with a task outside it widens the range instead of hiding the task.
export const TIMELINE_START_HOUR = 7;
export const TIMELINE_END_HOUR = 22;

export type BusyLevel = 0 | 1 | 2 | 3;

/** The month grid's aria-label wording for each level (§ 4). */
export const BUSY_LEVEL_WORDS: Record<BusyLevel, string> = {
  0: "quiet",
  1: "light",
  2: "busy",
  3: "full",
};

/**
 * § 2.2 — how full a day is against a baseline of daily routines:
 * `dailyCount` is how many of the day's occurrences belong to tasks that
 * repeat every day, so a day holding only those reads as quiet.
 */
export function busyLevel(count: number, dailyCount: number): BusyLevel {
  const extra = count - dailyCount;
  if (extra <= 0) return 0;
  if (extra === 1) return 1;
  if (extra <= 3) return 2;
  return 3;
}

type TimedInterval = { startMinutes: number; durationMinutes: number };

/**
 * The hours the timeline shows: 07:00–22:00, widened to whole hours around
 * any task that starts earlier or ends later. Never past midnight — an
 * occurrence that runs into the next day is cut at 24:00.
 */
export function timelineRange(events: TimedInterval[]): {
  startHour: number;
  endHour: number;
} {
  let startHour = TIMELINE_START_HOUR;
  let endHour = TIMELINE_END_HOUR;
  for (const { startMinutes, durationMinutes } of events) {
    startHour = Math.min(startHour, Math.floor(startMinutes / 60));
    const end = Math.min(startMinutes + durationMinutes, 24 * 60);
    endHour = Math.max(endHour, Math.ceil(end / 60));
  }
  return { startHour, endHour };
}

export type LaidOut<T> = T & {
  top: number;
  /** Already less the 2px gap between stacked blocks (§ 2.5). */
  height: number;
  column: number;
  columns: number;
};

/**
 * § 2.5 — block geometry plus side-by-side columns for overlaps. A block
 * is at least `minHeight` tall (so a 0-min task is still tappable), and
 * that visual height is what counts as overlapping: two short tasks 15
 * minutes apart would otherwise draw on top of each other. Within each
 * cluster of overlapping blocks a task takes the first free column; every
 * block in the cluster shares the cluster's column count.
 */
export function layoutDayEvents<T extends TimedInterval>(
  events: T[],
  {
    hourHeight,
    minHeight,
    startHour,
  }: { hourHeight: number; minHeight: number; startHour: number },
): LaidOut<T>[] {
  const blocks = events
    .map((event) => {
      const height = Math.max(
        (event.durationMinutes / 60) * hourHeight,
        minHeight,
      );
      return {
        event,
        top: ((event.startMinutes - startHour * 60) / 60) * hourHeight,
        height,
        visualEnd: event.startMinutes + (height / hourHeight) * 60,
        column: 0,
        columns: 1,
      };
    })
    .sort(
      (a, b) =>
        a.event.startMinutes - b.event.startMinutes ||
        b.event.durationMinutes - a.event.durationMinutes,
    );

  let cluster: typeof blocks = [];
  let clusterEnd = -Infinity;
  const closeCluster = () => {
    const columnEnds: number[] = [];
    for (const block of cluster) {
      let column = columnEnds.findIndex(
        (end) => end <= block.event.startMinutes,
      );
      if (column < 0) {
        column = columnEnds.length;
        columnEnds.push(0);
      }
      columnEnds[column] = block.visualEnd;
      block.column = column;
    }
    for (const block of cluster) {
      block.columns = columnEnds.length;
    }
  };
  for (const block of blocks) {
    if (cluster.length > 0 && block.event.startMinutes >= clusterEnd) {
      closeCluster();
      cluster = [];
      clusterEnd = -Infinity;
    }
    cluster.push(block);
    clusterEnd = Math.max(clusterEnd, block.visualEnd);
  }
  closeCluster();

  return blocks.map(({ event, top, height, column, columns }) => ({
    ...event,
    top,
    height: height - 2,
    column,
    columns,
  }));
}

// A block's text sizes (§ 2.5 desktop, § 3 mobile): a single task in the
// selected day ("roomy", 12px title), every other desktop block
// ("compact", 11.5px), and the mobile one-day timeline (14px title, 12px
// meta).
export type BlockTextSize = "roomy" | "compact" | "mobile";

// Per size: the title's line box (font size × 1.25), the title + meta
// stack (+ the meta's 1.2 line box and its 1px gap), and the spec's padding
// and the tighter one used when that stack wouldn't fit inside it.
const BLOCK_TEXT: Record<
  BlockTextSize,
  { titleLine: number; stack: number; padding: number; tightPadding: number }
> = {
  roomy: { titleLine: 15, stack: 15 + 1 + 13.2, padding: 5, tightPadding: 3 },
  compact: {
    titleLine: 14.375,
    stack: 14.375 + 1 + 13.2,
    padding: 3,
    tightPadding: 3,
  },
  mobile: {
    titleLine: 17.5,
    stack: 17.5 + 1 + 14.4,
    padding: 8,
    tightPadding: 4,
  },
};
const BLOCK_BORDER_Y = 2;

/**
 * A block's vertical padding and how many lines its title may take. The
 * spec's own numbers don't fit a minimum-height block (desktop: 40px with
 * 5px padding leaves 26px for a 15px title and a 13px meta line; mobile:
 * 46px with 8px padding leaves 26px for 17.5px + 14.4px), so a block the
 * title + meta stack doesn't fit at the spec's padding gets the tighter
 * one. The title may take a second line only where `wrap` allows it and
 * that line fits. Whether the meta line then still fits is left to CSS (it
 * wraps out of view rather than being cut in half).
 */
export function blockContentFit(
  height: number,
  { size, wrap }: { size: BlockTextSize; wrap: boolean },
): { paddingY: number; titleLines: 1 | 2 } {
  const text = BLOCK_TEXT[size];
  const inner = height - BLOCK_BORDER_Y;
  const paddingY =
    inner - text.padding * 2 >= text.stack ? text.padding : text.tightPadding;
  const room = inner - paddingY * 2;
  return {
    paddingY,
    titleLines: wrap && room >= text.titleLine * 2 ? 2 : 1,
  };
}

export type BlockAccent = "closed" | "strong" | "fixed" | "flexible";

export type BlockTone = {
  /** Done/Partial/Skipped — dimmed to 50%. */
  closed: boolean;
  /** Done only — the title is struck through. */
  done: boolean;
  critical: boolean;
  accent: BlockAccent;
};

/**
 * § 2.5 — which accent the block's left edge gets. Partially done reads as
 * closed like Done/Skipped (it's resolved for that day), just without the
 * strike-through. Critical keeps its heavier edge until it's done.
 */
export function blockTone(event: {
  status: OccurrenceStatus;
  priority: Priority;
  flexibility: Flexibility;
  overdue: boolean;
}): BlockTone {
  const done = event.status === "DONE";
  const closed =
    done || event.status === "SKIPPED" || event.status === "PARTIALLY_DONE";
  const important = event.priority === "HIGH" || event.priority === "CRITICAL";
  return {
    closed,
    done,
    critical: event.priority === "CRITICAL" && !done,
    accent: closed
      ? "closed"
      : important || event.overdue
        ? "strong"
        : event.flexibility === "FIXED"
          ? "fixed"
          : "flexible",
  };
}

const STATUS_WORDS: Partial<Record<OccurrenceStatus, string>> = {
  DONE: "Done",
  PARTIALLY_DONE: "Partially done",
  SKIPPED: "Skipped",
  SNOOZED: "Snoozed",
};

/**
 * § 2.5 — everything a block can't fit, for `aria-label`/`title`. The
 * spec's category segment is left out: the task model has no category.
 */
export function blockAriaLabel(event: {
  title: string;
  rangeLabel: string;
  flexibility: Flexibility;
  priority: Priority;
  recurrenceLabel: string | null;
  status: OccurrenceStatus;
}): string {
  return [
    event.title,
    event.rangeLabel,
    event.flexibility === "FIXED" ? "Fixed" : "Flexible",
    event.priority === "CRITICAL"
      ? "Critical"
      : event.priority === "HIGH"
        ? "High priority"
        : null,
    event.recurrenceLabel ? `↻ ${event.recurrenceLabel}` : null,
    STATUS_WORDS[event.status] ?? null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** "07:05" from minutes since midnight; wraps past 24:00. */
export function formatMinutes(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const rest = wrapped % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}
