import type {
  Prisma,
  PrismaClient,
  Priority,
  Flexibility,
} from "@prisma/client";
import {
  occurrenceRepository,
  type OverlapExclusion,
} from "@/features/scheduling/occurrence.repository";
import {
  busyQueryWindow,
  findBusyOverlaps,
  type Interval,
} from "@/features/scheduling/external-busy";
import { googleCalendarService } from "@/features/google-calendar/google-calendar.service";
import { isGoogleCalendarEnabled } from "@/lib/google-calendar/google-calendar.config";

type Db = PrismaClient | Prisma.TransactionClient;

export type ScheduleConflict = {
  occurrenceId: string;
  taskId: string;
  title: string;
  start: Date;
  end: Date;
  priority: Priority;
  flexibility: Flexibility;
};

export type ExternalBusyCheck =
  // Google answered; `overlaps` may well be empty. `busy` is everything
  // Google reported in the `window` it was asked about (the candidates
  // padded by a day, busyQueryWindow) — what "Free nearby" searches around
  // the task without a second request (sprint-12-tasks.md S12-03).
  | {
      status: "checked";
      overlaps: Interval[];
      busy: Interval[];
      window: { timeMin: Date; timeMax: Date };
    }
  // Nothing to ask: the feature is off, the calendar isn't connected, or
  // there are no intervals to check.
  | { status: "skipped" }
  // Google couldn't be asked — the task is saved without this check and
  // the user is told so ("Расхождения" п.6).
  | { status: "unavailable" };

export const EXTERNAL_BUSY_NOT_CHECKED: ExternalBusyCheck = {
  status: "skipped",
};

export const conflictService = {
  async findConflicts(
    userId: string,
    start: Date,
    end: Date,
    exclude?: OverlapExclusion,
    db?: Db,
  ): Promise<ScheduleConflict[]> {
    const overlapping = await occurrenceRepository.findOverlapping(
      userId,
      start,
      end,
      exclude,
      db,
    );

    return overlapping.map((occurrence) => ({
      occurrenceId: occurrence.id,
      taskId: occurrence.task.id,
      title: occurrence.task.title,
      start: occurrence.scheduledStart,
      end: occurrence.scheduledEnd ?? occurrence.scheduledStart,
      priority: occurrence.task.priority,
      flexibility: occurrence.task.flexibility,
    }));
  },

  // Must run outside any DB transaction — the network call to Google would
  // otherwise hold it open ("Расхождения" п.6). `candidates` is lazy so that
  // with the feature off not even the lookup behind it runs (S11-06:
  // "exactly the previous behaviour").
  async findExternalBusy(
    userId: string,
    candidates: () => Interval[] | Promise<Interval[]>,
  ): Promise<ExternalBusyCheck> {
    if (!isGoogleCalendarEnabled()) {
      return EXTERNAL_BUSY_NOT_CHECKED;
    }
    const intervals = await candidates();
    const window = busyQueryWindow(intervals);
    if (!window) {
      return EXTERNAL_BUSY_NOT_CHECKED;
    }

    const result = await googleCalendarService.getBusyIntervals(
      userId,
      window.timeMin,
      window.timeMax,
    );
    switch (result.status) {
      case "not-connected":
        return EXTERNAL_BUSY_NOT_CHECKED;
      case "unavailable":
        return { status: "unavailable" };
      case "ok":
        return {
          status: "checked",
          overlaps: findBusyOverlaps(intervals, result.busy),
          busy: result.busy,
          window,
        };
    }
  },
};
