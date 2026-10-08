"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { GroupedRows, GroupedRow } from "@/components/ui/grouped-rows";
import { SectionLabel } from "@/components/ui/section-label";
import { WeekdayPicker } from "@/components/ui/weekday-picker";
import {
  updateSchedulePreferencesAction,
  type UpdateSchedulePreferencesState,
} from "@/features/user/actions";
import { HALF_HOURS, TimeSelect } from "@/components/ui/time-select";
import type { SchedulePreferences } from "@/lib/validation/user";

const initialPreferencesState: UpdateSchedulePreferencesState = {
  status: "idle",
};

// sprint-12-tasks.md S12-09 — the hours free time is suggested in: the
// day, work hours and the latest start for a workout, saved on change.
// Moved off /settings to /settings/day on 2026-10-08, so Settings isn't
// crowded; it keeps a one-line summary linking here.
export function DayForm({ preferences }: { preferences: SchedulePreferences }) {
  const [prefsState, prefsAction] = useActionState(
    updateSchedulePreferencesAction,
    initialPreferencesState,
  );
  // What's on screen, what the server last accepted, and what was just
  // sent — so a refused change (the day ending before it starts) snaps
  // back to the saved hours instead of showing ones that aren't in effect.
  const [prefs, setPrefs] = useState(preferences);
  const [savedPrefs, setSavedPrefs] = useState(preferences);
  const [sentPrefs, setSentPrefs] = useState(preferences);
  const [seenPrefsState, setSeenPrefsState] = useState(prefsState);
  if (prefsState !== seenPrefsState) {
    setSeenPrefsState(prefsState);
    if (prefsState.status === "success") setSavedPrefs(sentPrefs);
    if (prefsState.status === "error") setPrefs(savedPrefs);
  }

  useEffect(() => {
    if (prefsState.status === "success") {
      toast.success("Hours saved");
    } else if (prefsState.status === "error" && prefsState.message) {
      toast.error(prefsState.message);
    }
  }, [prefsState]);

  function savePrefs(next: SchedulePreferences) {
    setPrefs(next);
    setSentPrefs(next);
    const data = new FormData();
    data.set("dayStartMinutes", String(next.dayStartMinutes));
    data.set("dayEndMinutes", String(next.dayEndMinutes));
    for (const day of next.workDays) data.append("workDays", String(day));
    data.set("workStartMinutes", String(next.workStartMinutes));
    data.set("workEndMinutes", String(next.workEndMinutes));
    data.set(
      "workoutLatestStartMinutes",
      next.workoutLatestStartMinutes === null
        ? ""
        : String(next.workoutLatestStartMinutes),
    );
    startTransition(() => prefsAction(data));
  }

  function toggleWorkDay(day: number) {
    savePrefs({
      ...prefs,
      workDays: prefs.workDays.includes(day)
        ? prefs.workDays.filter((d) => d !== day)
        : [...prefs.workDays, day].sort((a, b) => a - b),
    });
  }

  return (
    <>
      <GroupedRows>
        <GroupedRow
          label="Start of day"
          hint="No time is suggested earlier"
          value={
            <TimeSelect
              ariaLabel="Start of day"
              value={prefs.dayStartMinutes}
              options={HALF_HOURS.slice(0, -1)}
              onChange={(minutes) =>
                minutes !== null &&
                savePrefs({ ...prefs, dayStartMinutes: minutes })
              }
            />
          }
        />
        <GroupedRow
          label="End of day"
          hint="Or later"
          value={
            <TimeSelect
              ariaLabel="End of day"
              value={prefs.dayEndMinutes}
              options={HALF_HOURS.slice(1)}
              onChange={(minutes) =>
                minutes !== null &&
                savePrefs({ ...prefs, dayEndMinutes: minutes })
              }
            />
          }
        />
        <GroupedRow
          label="Workouts start by"
          hint="The latest a workout is suggested"
          value={
            <TimeSelect
              ariaLabel="Workouts start by"
              value={prefs.workoutLatestStartMinutes}
              options={HALF_HOURS.slice(0, -1)}
              allowNone
              onChange={(minutes) =>
                savePrefs({ ...prefs, workoutLatestStartMinutes: minutes })
              }
            />
          }
        />
      </GroupedRows>

      <div className="flex flex-col gap-3">
        <SectionLabel>Work hours</SectionLabel>
        <WeekdayPicker selected={prefs.workDays} onToggle={toggleWorkDay} />
        {prefs.workDays.length > 0 && (
          <div className="text-text-primary flex items-center gap-2 text-[15px]">
            <TimeSelect
              ariaLabel="Work starts"
              value={prefs.workStartMinutes}
              options={HALF_HOURS.slice(0, -1)}
              onChange={(minutes) =>
                minutes !== null &&
                savePrefs({ ...prefs, workStartMinutes: minutes })
              }
            />
            <span className="text-text-secondary">to</span>
            <TimeSelect
              ariaLabel="Work ends"
              value={prefs.workEndMinutes}
              options={HALF_HOURS.slice(1)}
              onChange={(minutes) =>
                minutes !== null &&
                savePrefs({ ...prefs, workEndMinutes: minutes })
              }
            />
          </div>
        )}
        <p className="text-text-secondary text-xs">
          {prefs.workDays.length > 0
            ? "Suggested times skip these hours, except for tasks you can do during work."
            : "No work hours — suggestions can use the whole day."}
        </p>
      </div>
    </>
  );
}
