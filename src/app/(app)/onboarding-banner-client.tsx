"use client";

import { useActionState, useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  updateTimezoneAction,
  type UpdateTimezoneState,
} from "@/features/user/actions";

const initialState: UpdateTimezoneState = { status: "idle" };

export function OnboardingBannerClient({
  storedTimezone,
}: {
  storedTimezone: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  // Browser timezone has no subscribable "change" event, so useSyncExternalStore
  // can't pick it up after mount (nothing ever fires onStoreChange). A one-time
  // effect is the correct tool here: synchronizing with a platform API that
  // isn't knowable during SSR.
  const [detectedZone, setDetectedZone] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetectedZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);
  const [state, formAction, pending] = useActionState(
    updateTimezoneAction,
    initialState,
  );

  if (dismissed || state.status === "success" || !detectedZone) {
    return null;
  }

  return (
    <div className="bg-accent flex items-center justify-between gap-4 border-b px-4 py-2 text-sm">
      <p>
        {detectedZone === storedTimezone
          ? `Is ${detectedZone} your timezone?`
          : `We think you're in ${detectedZone}, but your account is set to ${storedTimezone}.`}
      </p>
      <div className="flex items-center gap-2">
        <form action={formAction}>
          <input type="hidden" name="timezone" value={detectedZone} />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : `Use ${detectedZone}`}
          </Button>
        </form>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:bg-background rounded-md p-1"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
