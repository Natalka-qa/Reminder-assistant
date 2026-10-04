"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { useZonedClock } from "@/lib/date/zoned-clock";
import { taskKindOf } from "@/lib/parse-task";
import {
  rescheduleOccurrenceAction,
  type OccurrenceActionState,
} from "@/features/scheduling/actions";
import {
  previewTaskEditOverlapsAction,
  type EditOverlapPreview,
} from "@/features/tasks/actions";
import { overlapNotice, pastNotice } from "@/features/tasks/new-task-fields";
import { RoseNotice } from "@/components/tasks/task-fields/shared";
import {
  OverlapNotice,
  WhenGroup,
  WorkHoursSwitch,
} from "@/components/tasks/task-fields/when-group";
import {
  FormActions,
  FormHeader,
} from "@/components/tasks/task-fields/form-chrome";

// As on Edit task: the overlap check waits for the When row to settle.
const OVERLAP_DEBOUNCE_MS = 400;

const initialState: OccurrenceActionState = { status: "idle" };

export type EditOccurrenceValues = {
  date: string;
  /** Null — the series has no time, and its days have none (п.3). */
  time: string | null;
  durationMinutes: number;
};

// sprint-19-tasks.md п.3–4 — Edit's one-day mode (?occurrence=<id>): only
// When — the date, and for a series with a time its time and length. The
// title, reminder, repeat and note belong to the whole series. Overlaps
// and "Free nearby" work as for a one-off task, for this one day.
export function EditOccurrenceForm({
  taskId,
  occurrenceId,
  title,
  dateLabel,
  seriesTimeLabel,
  values,
  timezone,
  today,
  nowMinutes,
  hasWorkHours,
}: {
  taskId: string;
  occurrenceId: string;
  title: string;
  /** "Oct 5" — the day as it is now. */
  dateLabel: string;
  /** "18:00" — the series' own time; null for a series without one. */
  seriesTimeLabel: string | null;
  values: EditOccurrenceValues;
  timezone: string;
  today: string;
  nowMinutes: number;
  hasWorkHours: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    rescheduleOccurrenceAction.bind(null, occurrenceId),
    initialState,
  );
  const clock = useZonedClock(timezone, { date: today, minutes: nowMinutes });
  const [fields, setFields] = useState(values);
  const whenId = useId();
  const hasTime = values.time !== null;
  const backHref = `/tasks/${taskId}?occurrence=${occurrenceId}`;

  useEffect(() => {
    if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
  }, [state]);

  const kind = taskKindOf(title) ?? null;
  const [workOverride, setWorkOverride] = useState<boolean | null>(null);
  const allowDuringWork = workOverride ?? kind === "remote";

  const past = pastNotice(fields.date, fields.time, clock.date, clock.minutes);
  const checkOverlaps = fields.time !== null && !past;
  const overlapKey = JSON.stringify({
    taskId,
    date: fields.date,
    time: fields.time,
    durationMinutes: fields.durationMinutes,
    repeatFrequency: "NONE",
    repeatDaysOfWeek: [],
    kind,
    allowDuringWork,
    singleDay: true,
  });
  const [preview, setPreview] = useState<{
    key: string;
    result: EditOverlapPreview;
  } | null>(null);
  useEffect(() => {
    if (!checkOverlaps) return;
    let stale = false;
    const timer = setTimeout(async () => {
      const result = await previewTaskEditOverlapsAction(
        JSON.parse(overlapKey),
      );
      if (!stale && result) {
        setPreview({ key: overlapKey, result });
      }
    }, OVERLAP_DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [checkOverlaps, overlapKey]);
  const overlap =
    checkOverlaps && preview?.key === overlapKey ? preview.result : null;
  const oneOff = overlap?.kind === "one-off" ? overlap.preview : null;
  const overlapText = oneOff
    ? overlapNotice(oneOff.tasks, oneOff.busyCount)
    : null;

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (past) event.preventDefault();
      }}
      aria-label={`Edit ${dateLabel} only`}
      className="flex w-full max-w-[560px] flex-col gap-[30px]"
    >
      <input type="hidden" name="date" value={fields.date} />
      <input type="hidden" name="time" value={fields.time ?? ""} />
      <input
        type="hidden"
        name="durationMinutes"
        value={fields.durationMinutes}
      />
      <input type="hidden" name="confirmConflicts" value="true" />

      <FormHeader label={`Edit ${dateLabel} only`} cancelHref={backHref} />

      <div className="flex flex-col gap-2">
        <h1 className="font-display text-text-primary text-[34px]/[1.15] font-light">
          {title}
        </h1>
        <p className="text-text-secondary text-[15px]">
          {seriesTimeLabel
            ? `Only this day changes. The rest of the series stays at ${seriesTimeLabel}.`
            : "Only this day changes. The rest of the series stays as it is."}
        </p>
      </div>

      <WhenGroup
        labelId={whenId}
        today={today}
        date={fields.date}
        time={fields.time}
        durationMinutes={fields.durationMinutes}
        onDateChange={(date) => setFields((current) => ({ ...current, date }))}
        onTimeChange={(time) => setFields((current) => ({ ...current, time }))}
        onDurationChange={(durationMinutes) =>
          setFields((current) => ({ ...current, durationMinutes }))
        }
        dateOnly={!hasTime}
      >
        {past && <RoseNotice>{past}</RoseNotice>}
        {overlapText && (
          <OverlapNotice
            text={overlapText}
            freeNearby={oneOff?.freeNearby ?? []}
            currentDate={fields.date}
            today={today}
            onChoose={(slot) =>
              setFields((current) => ({
                ...current,
                date: slot.date,
                time: slot.time,
              }))
            }
          />
        )}
        {hasWorkHours && (oneOff?.freeNearby.length ?? 0) > 0 && (
          <WorkHoursSwitch
            checked={allowDuringWork}
            onChange={setWorkOverride}
          />
        )}
      </WhenGroup>

      <FormActions
        submitLabel="Save this day"
        pendingLabel="Saving…"
        pending={pending}
        canSubmit={!past}
        cancelHref={backHref}
        blockedHint={
          hasTime ? "Pick a time still ahead." : "Pick today or a later day."
        }
      />
    </form>
  );
}
