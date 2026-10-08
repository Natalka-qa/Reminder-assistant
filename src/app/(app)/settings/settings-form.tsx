"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { GroupedRows, GroupedRow } from "@/components/ui/grouped-rows";
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
  updateTimezoneAction,
  type UpdateReminderPreferencesState,
  type UpdateSchedulePreferencesState,
  type UpdateTimezoneState,
} from "@/features/user/actions";
import { REMINDER_CHOICES } from "@/features/tasks/new-task-fields";
import {
  NAME_MAX_LENGTH,
  type ReminderPreferences,
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
  emailName = null,
  currentTimezone,
  daySummary,
  reminderPreferences,
  telegramLinked,
}: {
  currentName: string;
  /** What Home calls you while the name is empty (displayName). */
  emailName?: string | null;
  currentTimezone: string;
  /** "08:00–21:00 · Work Mon–Fri 09:00–17:00" (daySummary). */
  daySummary: string;
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

  return (
    <>
      <GroupedRows>
        <GroupedRow
          label="Name"
          hint={
            currentName
              ? "How I greet you on Home — tap to change"
              : emailName
                ? "Taken from your email — tap to change"
                : "How I greet you on Home"
          }
          value={<NameField initialName={currentName} emailName={emailName} />}
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
        {/* 2026-10-08 — the hours live on their own page, so Settings
            isn't crowded; here, what they are at a glance. */}
        <GroupedRow
          label="Your day"
          hint="Day and work hours"
          value={
            // Wraps only between the parts, never inside "9–17".
            <span className="flex flex-wrap justify-end gap-x-1.5">
              {daySummary.split(" · ").map((part, index) => (
                <span key={part} className="whitespace-nowrap">
                  {index > 0 && "· "}
                  {part}
                </span>
              ))}
            </span>
          }
          href="/settings/day"
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
    </>
  );
}

// The name the app calls you by (also set on /onboarding), saved when the
// field is left; a refused one goes back to what's saved.
function NameField({
  initialName,
  emailName,
}: {
  initialName: string;
  emailName: string | null;
}) {
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
        placeholder={emailName ?? "Add your name"}
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
