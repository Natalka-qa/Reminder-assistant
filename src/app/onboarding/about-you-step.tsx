"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  saveAboutYouAction,
  type OnboardingStepState,
} from "@/features/user/actions";
import { NAME_MAX_LENGTH } from "@/lib/validation/user";

const timezones = Intl.supportedValuesOf("timeZone");
const initialState: OnboardingStepState = { status: "idle" };

// Step 1 — what to call you, and your timezone: the one this device
// reports, shown so it can be checked, with "Change" for any other.
export function AboutYouStep({
  name: savedName,
  confirmedTimezone,
}: {
  name: string;
  /** Set once the user picked one; null — offer the device's. */
  confirmedTimezone: string | null;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    saveAboutYouAction,
    initialState,
  );
  const [name, setName] = useState(savedName);

  // The browser's zone isn't known during SSR — read it once mounted.
  const [deviceZone, setDeviceZone] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDeviceZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);
  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState<string | null>(confirmedTimezone);
  const timezone = chosen ?? deviceZone;

  useEffect(() => {
    if (state.status === "success") {
      router.push("/onboarding?step=2");
    } else if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-col gap-[26px]">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-[44px] leading-[1.08] font-light">
          Welcome. Let&apos;s set you up.
        </h1>
        <p className="text-text-secondary text-[15px] leading-[1.6]">
          Two things first: what to call you, and where you are — tasks and
          reminders follow your local time.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="onboarding-name" className="text-[15px] font-medium">
          What should we call you?
        </label>
        <Input
          id="onboarding-name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={NAME_MAX_LENGTH}
          autoComplete="given-name"
          placeholder="Your name"
          className="h-[52px] text-[16px]"
        />
        <p className="text-text-secondary text-[13px]">
          For the greeting on Home. Optional.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p id="onboarding-timezone" className="text-[15px] font-medium">
          Your timezone
        </p>
        {picking ? (
          <Select
            value={timezone ?? undefined}
            onValueChange={(value) => value && setChosen(value)}
          >
            <SelectTrigger
              aria-labelledby="onboarding-timezone"
              className="h-[52px] w-full"
            >
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
        ) : (
          <div className="bg-blue-tint border-blue-tint-border flex items-center justify-between gap-3 rounded-[20px] border p-5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-blue-ink-title truncate text-[16px] font-semibold">
                {timezone ?? "Detecting…"}
              </p>
              {timezone && timezone === deviceZone && !confirmedTimezone && (
                <p className="text-blue-ink text-[13px]">From this device</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="text-blue-ink-title min-h-11 shrink-0 text-[14px] font-semibold underline underline-offset-4"
            >
              Change
            </button>
          </div>
        )}
      </div>

      <input type="hidden" name="timezone" value={timezone ?? ""} />
      <Button
        type="submit"
        disabled={!timezone || pending}
        className="h-[52px] w-full"
      >
        {pending ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
