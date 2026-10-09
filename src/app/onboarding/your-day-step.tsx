"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GroupedRow, GroupedRows } from "@/components/ui/grouped-rows";
import { HALF_HOURS, TimeSelect } from "@/components/ui/time-select";
import { WeekdayPicker } from "@/components/ui/weekday-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  saveYourDayAction,
  type OnboardingStepState,
} from "@/features/user/actions";
import { REMINDER_CHOICES } from "@/features/tasks/new-task-fields";
import type { SchedulePreferences } from "@/lib/validation/user";

const initialState: OnboardingStepState = { status: "idle" };

// Step 2 — the day, work hours and the default reminder, already at the
// usual values: "Looks right" keeps them, a change is one tap, and the
// step can be skipped. The same settings as /settings.
export function YourDayStep({
  preferences,
  defaultReminderMinutes,
}: {
  preferences: SchedulePreferences;
  defaultReminderMinutes: number;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    saveYourDayAction,
    initialState,
  );
  const [prefs, setPrefs] = useState(preferences);
  const [reminder, setReminder] = useState(defaultReminderMinutes);

  useEffect(() => {
    if (state.status === "success") {
      router.push("/onboarding?step=3");
    } else if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
  }, [state, router]);

  function toggleWorkDay(day: number) {
    setPrefs({
      ...prefs,
      workDays: prefs.workDays.includes(day)
        ? prefs.workDays.filter((d) => d !== day)
        : [...prefs.workDays, day].sort((a, b) => a - b),
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-[26px]">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-[44px] leading-[1.08] font-light">
          Your day
        </h1>
        <p className="text-text-secondary text-[15px] leading-[1.6]">
          So suggested times and reminders fit your day. The usual hours are
          already set — change only what&apos;s different for you.
        </p>
      </div>

      <GroupedRows>
        <GroupedRow
          label="Day starts"
          hint="No time is suggested earlier"
          value={
            <TimeSelect
              ariaLabel="Day starts"
              value={prefs.dayStartMinutes}
              options={HALF_HOURS.slice(0, -1)}
              onChange={(minutes) =>
                minutes !== null &&
                setPrefs({ ...prefs, dayStartMinutes: minutes })
              }
            />
          }
        />
        <GroupedRow
          label="Day ends"
          hint="Or later"
          value={
            <TimeSelect
              ariaLabel="Day ends"
              value={prefs.dayEndMinutes}
              options={HALF_HOURS.slice(1)}
              onChange={(minutes) =>
                minutes !== null &&
                setPrefs({ ...prefs, dayEndMinutes: minutes })
              }
            />
          }
        />
        <GroupedRow
          label="Default reminder"
          hint="Where a new task starts"
          value={
            <Select
              value={String(reminder)}
              onValueChange={(value) => value !== null && setReminder(+value)}
            >
              <SelectTrigger aria-label="Default reminder" variant="inline">
                <SelectValue>
                  {(value: string) =>
                    REMINDER_CHOICES.find(
                      (choice) => String(choice.value) === value,
                    )?.label
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} align="end">
                {REMINDER_CHOICES.map((choice) => (
                  <SelectItem key={choice.value} value={String(choice.value)}>
                    {choice.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
      </GroupedRows>

      <div className="flex flex-col gap-3">
        <p className="text-[15px] font-medium">Work hours</p>
        <WeekdayPicker selected={prefs.workDays} onToggle={toggleWorkDay} />
        {prefs.workDays.length > 0 && (
          <div className="text-text-primary flex items-center gap-3 text-[15px]">
            <TimeSelect
              ariaLabel="Work starts"
              align="start"
              value={prefs.workStartMinutes}
              options={HALF_HOURS.slice(0, -1)}
              onChange={(minutes) =>
                minutes !== null &&
                setPrefs({ ...prefs, workStartMinutes: minutes })
              }
            />
            <span className="text-text-secondary">to</span>
            <TimeSelect
              ariaLabel="Work ends"
              align="start"
              value={prefs.workEndMinutes}
              options={HALF_HOURS.slice(1)}
              onChange={(minutes) =>
                minutes !== null &&
                setPrefs({ ...prefs, workEndMinutes: minutes })
              }
            />
          </div>
        )}
        <p className="text-text-secondary text-[13px]">
          {prefs.workDays.length > 0
            ? "Free time isn't suggested in these hours, except for things you can do at work. No work days? Tap them off."
            : "No work hours — suggestions can use the whole day."}
        </p>
      </div>

      <input
        type="hidden"
        name="dayStartMinutes"
        value={prefs.dayStartMinutes}
      />
      <input type="hidden" name="dayEndMinutes" value={prefs.dayEndMinutes} />
      {prefs.workDays.map((day) => (
        <input key={day} type="hidden" name="workDays" value={day} />
      ))}
      <input
        type="hidden"
        name="workStartMinutes"
        value={prefs.workStartMinutes}
      />
      <input type="hidden" name="workEndMinutes" value={prefs.workEndMinutes} />
      <input
        type="hidden"
        name="workoutLatestStartMinutes"
        value={prefs.workoutLatestStartMinutes ?? ""}
      />
      <input type="hidden" name="defaultReminderMinutes" value={reminder} />

      <div className="flex flex-col gap-3">
        <Button type="submit" disabled={pending} className="h-[52px] w-full">
          {pending ? "Saving…" : "Looks right"}
        </Button>
        <Link
          href="/onboarding?step=3"
          className="text-text-secondary flex min-h-11 items-center justify-center text-[15px]"
        >
          Skip this step
        </Link>
      </div>
    </form>
  );
}
