"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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

export function SettingsForm({ currentTimezone }: { currentTimezone: string }) {
  const [state, formAction, pending] = useActionState(
    updateTimezoneAction,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      toast.success("Timezone updated");
    } else if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <div className="flex max-w-sm flex-col gap-8">
      <form action={formAction} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="timezone">Timezone</Label>
          <Select
            key={currentTimezone}
            name="timezone"
            defaultValue={currentTimezone}
          >
            <SelectTrigger id="timezone" className="w-full">
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
        </div>
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving…" : "Save"}
        </Button>
      </form>

      <div className="flex flex-col gap-4 border-t pt-6">
        <div className="flex flex-col gap-1.5 opacity-50">
          <Label htmlFor="reminder-default">Default reminder offset</Label>
          <Input
            id="reminder-default"
            disabled
            placeholder="15 minutes before"
          />
        </div>
        <div className="flex flex-col gap-1.5 opacity-50">
          <Label htmlFor="day-start">Start of day</Label>
          <Input id="day-start" disabled placeholder="09:00" />
        </div>
        <div className="flex flex-col gap-1.5 opacity-50">
          <Label htmlFor="day-end">End of day</Label>
          <Input id="day-end" disabled placeholder="18:00" />
        </div>
        <p className="text-muted-foreground text-xs">
          Coming in a later sprint.
        </p>
      </div>
    </div>
  );
}
