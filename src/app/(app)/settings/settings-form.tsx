"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { GroupedRows, GroupedRow } from "@/components/ui/grouped-rows";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateTimezoneAction,
  type UpdateTimezoneState,
} from "@/features/user/actions";

const timezones = Intl.supportedValuesOf("timeZone");
const initialState: UpdateTimezoneState = { status: "idle" };

// design_handoff_reminder_assistant/README.md § Settings — grouped rows,
// each with a hint line. Timezone is the only real, saveable setting;
// Default reminder/Start of day/End of day/Email reminders were already
// disabled placeholders before this redesign ("Coming in a later sprint")
// and stay that way — the mockup names them, but nothing backs them yet.
// Saves on change (no separate Save button, matching the mockup, which
// doesn't show one) rather than the earlier explicit-submit form.
export function SettingsForm({ currentTimezone }: { currentTimezone: string }) {
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

  return (
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
        value="09:00"
        hint="Coming in a later sprint"
        className="opacity-50"
      />
      <GroupedRow
        label="End of day"
        value="18:00"
        hint="Coming in a later sprint"
        className="opacity-50"
      />
      <GroupedRow
        label="Email reminders"
        value="On"
        hint="Coming in a later sprint"
        className="opacity-50"
      />
    </GroupedRows>
  );
}
