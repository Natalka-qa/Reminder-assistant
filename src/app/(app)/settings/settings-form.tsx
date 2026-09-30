"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { GroupedRows, GroupedRow } from "@/components/ui/grouped-rows";
import { SectionLabel } from "@/components/ui/section-label";
import { WeekdayPicker } from "@/components/ui/weekday-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateSchedulePreferencesAction,
  updateTimezoneAction,
  type UpdateSchedulePreferencesState,
  type UpdateTimezoneState,
} from "@/features/user/actions";
import { formatMinutes } from "@/features/scheduling/calendar-layout";
import type { SchedulePreferences } from "@/lib/validation/user";

const timezones = Intl.supportedValuesOf("timeZone");
const initialState: UpdateTimezoneState = { status: "idle" };
const initialPreferencesState: UpdateSchedulePreferencesState = {
  status: "idle",
};

// Every half hour of the day, 00:00 to 24:00.
const HALF_HOURS = Array.from({ length: 49 }, (_, index) => index * 30);
const NO_LIMIT = "none";

function timeLabel(minutes: number): string {
  return minutes === 24 * 60 ? "24:00" : formatMinutes(minutes);
}

// design_handoff_reminder_assistant/README.md § Settings — grouped rows,
// each with a hint line, saved on change (no Save button, as in the
// mockup). Timezone, and since sprint-12-tasks.md S12-09 the hours free
// time is suggested in: the day, work hours and the latest start for a
// workout — each user's own ("Расхождения" п.11–12). Default reminder and
// Email reminders are still placeholders: nothing backs them yet.
export function SettingsForm({
  currentTimezone,
  preferences,
}: {
  currentTimezone: string;
  preferences: SchedulePreferences;
}) {
  const [state, formAction, pending] = useActionState(
    updateTimezoneAction,
    initialState,
  );
  const [timezone, setTimezone] = useState(currentTimezone);

  useEffect(() => {
    if (state.status === "success") {
      toast.success("Timezone updated");
    } else if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
  }, [state]);

  function handleTimezoneChange(value: string | null) {
    if (!value) return;
    setTimezone(value);
    const data = new FormData();
    data.set("timezone", value);
    startTransition(() => formAction(data));
  }

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
          label="Timezone"
          hint="Used for scheduling"
          value={
            <Select
              value={timezone}
              onValueChange={handleTimezoneChange}
              disabled={pending}
            >
              <SelectTrigger className="h-auto w-fit gap-1 border-0 bg-transparent p-0 text-[15px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timezones.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
        <GroupedRow
          label="Default reminder"
          value="15 min before"
          hint="Coming in a later sprint"
          className="opacity-50"
        />
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
        <GroupedRow
          label="Email reminders"
          value="On"
          hint="Coming in a later sprint"
          className="opacity-50"
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

function TimeSelect({
  ariaLabel,
  value,
  options,
  allowNone = false,
  onChange,
}: {
  ariaLabel: string;
  value: number | null;
  options: number[];
  allowNone?: boolean;
  onChange: (minutes: number | null) => void;
}) {
  return (
    <Select
      value={value === null ? NO_LIMIT : String(value)}
      onValueChange={(next) => {
        if (next === null) return;
        onChange(next === NO_LIMIT ? null : Number(next));
      }}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className="h-auto w-fit gap-1 border-0 bg-transparent p-0 text-[15px]"
      >
        {/* Select.Value shows the raw value unless told how to format it. */}
        <SelectValue>
          {(raw: string) =>
            raw === NO_LIMIT ? "No limit" : timeLabel(Number(raw))
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NO_LIMIT}>No limit</SelectItem>}
        {options.map((minutes) => (
          <SelectItem key={minutes} value={String(minutes)}>
            {timeLabel(minutes)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
