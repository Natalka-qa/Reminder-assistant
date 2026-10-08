"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
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
import { SwitchTrack } from "@/components/ui/switch-track";
import {
  updateNameAction,
  updateReminderPreferencesAction,
  updateSchedulePreferencesAction,
  updateTimezoneAction,
  type UpdateReminderPreferencesState,
  type UpdateSchedulePreferencesState,
  type UpdateTimezoneState,
} from "@/features/user/actions";
import { HALF_HOURS, TimeSelect } from "@/components/ui/time-select";
import { REMINDER_CHOICES } from "@/features/tasks/new-task-fields";
import {
  NAME_MAX_LENGTH,
  type ReminderPreferences,
  type SchedulePreferences,
} from "@/lib/validation/user";

const timezones = Intl.supportedValuesOf("timeZone");
const initialState: UpdateTimezoneState = { status: "idle" };
const initialPreferencesState: UpdateSchedulePreferencesState = {
  status: "idle",
};

// design_handoff_reminder_assistant/README.md § Settings — grouped rows,
// each with a hint line, saved on change (no Save button, as in the
// mockup). Timezone, and since sprint-12-tasks.md S12-09 the hours free
// time is suggested in: the day, work hours and the latest start for a
// workout — each user's own ("Расхождения" п.11–12). Since
// sprint-14-tasks.md S14-06, Default reminder (where a new task's reminder
// starts) and Email reminders are real too.
export function SettingsForm({
  currentName,
  currentTimezone,
  preferences,
  reminderPreferences,
  telegramLinked,
}: {
  currentName: string;
  currentTimezone: string;
  preferences: SchedulePreferences;
  reminderPreferences: ReminderPreferences;
  /** Telegram reminders are on — they keep coming with email off. */
  telegramLinked: boolean;
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

  // S14-06 — same snap-back as the hours: a refused change shows what's
  // saved, not what was sent.
  const [remindersState, remindersAction] = useActionState(
    updateReminderPreferencesAction,
    initialPreferencesState as UpdateReminderPreferencesState,
  );
  const [reminders, setReminders] = useState(reminderPreferences);
  const [savedReminders, setSavedReminders] = useState(reminderPreferences);
  const [sentReminders, setSentReminders] = useState(reminderPreferences);
  const [seenRemindersState, setSeenRemindersState] = useState(remindersState);
  if (remindersState !== seenRemindersState) {
    setSeenRemindersState(remindersState);
    if (remindersState.status === "success") setSavedReminders(sentReminders);
    if (remindersState.status === "error") setReminders(savedReminders);
  }

  useEffect(() => {
    if (remindersState.status === "success") {
      toast.success("Reminders saved");
    } else if (remindersState.status === "error" && remindersState.message) {
      toast.error(remindersState.message);
    }
  }, [remindersState]);

  function saveReminders(next: ReminderPreferences) {
    setReminders(next);
    setSentReminders(next);
    const data = new FormData();
    data.set("defaultReminderMinutes", String(next.defaultReminderMinutes));
    data.set("emailRemindersEnabled", String(next.emailRemindersEnabled));
    startTransition(() => remindersAction(data));
  }

  const emailHint = reminders.emailRemindersEnabled
    ? "Sent to your email address"
    : telegramLinked
      ? "Reminders go to Telegram and the app"
      : "Reminders will only show in the app";

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
          label="Name"
          hint="How I greet you on Home — tap to change"
          value={<NameField initialName={currentName} />}
        />
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
          hint="Where a new task starts"
          value={
            <Select
              value={String(reminders.defaultReminderMinutes)}
              onValueChange={(value) =>
                value !== null &&
                saveReminders({
                  ...reminders,
                  defaultReminderMinutes: Number(value),
                })
              }
            >
              <SelectTrigger
                aria-label="Default reminder"
                className="h-auto w-fit gap-1 border-0 bg-transparent p-0 text-[15px]"
              >
                <SelectValue>
                  {(value: string) =>
                    REMINDER_CHOICES.find(
                      (choice) => String(choice.value) === value,
                    )?.label
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {REMINDER_CHOICES.map((choice) => (
                  <SelectItem key={choice.value} value={String(choice.value)}>
                    {choice.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
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
          hint={emailHint}
          value={
            <button
              type="button"
              role="switch"
              aria-checked={reminders.emailRemindersEnabled}
              aria-label="Email reminders"
              onClick={() =>
                saveReminders({
                  ...reminders,
                  emailRemindersEnabled: !reminders.emailRemindersEnabled,
                })
              }
              className="flex min-h-11 items-center"
            >
              <SwitchTrack checked={reminders.emailRemindersEnabled} />
            </button>
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

// The name the app calls you by (also set on /onboarding), saved when the
// field is left; a refused one goes back to what's saved.
function NameField({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [saved, setSaved] = useState(initialName);

  async function save() {
    const next = name.trim();
    if (next === saved) {
      setName(saved);
      return;
    }
    const result = await updateNameAction(next);
    if (result.status === "success") {
      setSaved(next);
      setName(next);
      toast.success("Name saved");
    } else {
      setName(saved);
      if (result.message) toast.error(result.message);
    }
  }

  // 2026-10-08 — it looked like plain text: now a pencil, a soft tint on
  // hover and a ring while editing say it can be changed; the pencil puts
  // the cursor in the field.
  return (
    <label className="group flex w-full min-w-0 cursor-text items-center justify-end gap-2">
      <input
        aria-label="Name"
        value={name}
        maxLength={NAME_MAX_LENGTH}
        placeholder="Add your name"
        onChange={(event) => setName(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className="text-text-primary placeholder:text-placeholder-text group-hover:bg-tasks-hover focus:ring-burgundy/40 focus:bg-surface w-full min-w-0 rounded-[8px] bg-transparent px-2 py-1 text-right text-[15px] outline-none focus:ring-1"
      />
      <Pencil
        aria-hidden
        className="text-text-secondary group-hover:text-text-primary size-3.5 shrink-0"
        strokeWidth={1.8}
      />
    </label>
  );
}
