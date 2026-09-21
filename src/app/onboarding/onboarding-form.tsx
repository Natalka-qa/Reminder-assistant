"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

export function OnboardingForm({ storedTimezone }: { storedTimezone: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    updateTimezoneAction,
    initialState,
  );

  // Browser timezone isn't knowable during SSR — detected client-side only,
  // same reasoning as the existing Dashboard banner (onboarding-banner-
  // client.tsx), which this screen doesn't replace, only complements.
  const [detectedZone, setDetectedZone] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetectedZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [chosenZone, setChosenZone] = useState<string | null>(null);
  const activeZone = chosenZone ?? detectedZone;

  useEffect(() => {
    if (state.status === "success") {
      router.push("/dashboard");
    } else if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
  }, [state, router]);

  return (
    <div className="flex flex-col gap-4">
      {pickerOpen ? (
        <Select
          value={activeZone ?? storedTimezone}
          onValueChange={(value) => value && setChosenZone(value)}
        >
          <SelectTrigger className="w-full">
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
        <div className="bg-blue-tint border-blue-tint-border rounded-[20px] border p-5">
          <p className="text-blue-ink-title text-[16px] font-semibold">
            {activeZone ?? "Detecting your timezone…"}
          </p>
        </div>
      )}

      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="timezone" value={activeZone ?? ""} />
        <Button
          type="submit"
          disabled={!activeZone || pending}
          className="h-[52px] w-full"
        >
          {pending
            ? "Saving…"
            : activeZone
              ? `Use ${activeZone}`
              : "Detecting…"}
        </Button>
      </form>

      {!pickerOpen && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => setPickerOpen(true)}
          className="h-[50px] w-full"
        >
          Choose another timezone
        </Button>
      )}

      <Link
        href="/dashboard"
        className="text-text-secondary text-center text-[15px]"
      >
        Skip for now
      </Link>
    </div>
  );
}
