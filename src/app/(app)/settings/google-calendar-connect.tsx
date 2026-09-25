"use client";

import { useTransition } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { GroupedRows, GroupedRow } from "@/components/ui/grouped-rows";
import {
  connectGoogleCalendarAction,
  disconnectGoogleCalendarAction,
} from "@/features/google-calendar/actions";
import type { GoogleCalendarConnectionStatus } from "@/features/google-calendar/google-calendar-connection";

const hints: Record<GoogleCalendarConnectionStatus, string> = {
  connected: "Connected",
  "not-connected": "Not connected",
  // Granular consent: the calendar box was unticked on Google's screen
  // (sprint-11-tasks.md S11-02).
  "needs-reconnect": "Calendar access wasn't granted",
};

// Same card as telegram-connect.tsx (sprint-11-tasks.md S11-08). Only
// rendered when isGoogleCalendarEnabled() — the page decides, this component
// doesn't check env itself.
export function GoogleCalendarConnect({
  status,
}: {
  status: GoogleCalendarConnectionStatus;
}) {
  const [pending, startTransition] = useTransition();

  function handleDisconnect() {
    startTransition(async () => {
      const result = await disconnectGoogleCalendarAction();
      if (result.status === "error" && result.message) {
        toast.error(result.message);
        return;
      }
      toast.success("Google Calendar disconnected");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <SectionLabel>Google Calendar</SectionLabel>
      <GroupedRows>
        <GroupedRow
          label="Busy times"
          hint={hints[status]}
          value={
            status === "connected" ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={handleDisconnect}
              >
                Disconnect
              </Button>
            ) : (
              // A form rather than a transition: the action ends in a
              // redirect to Google's consent screen.
              <form action={connectGoogleCalendarAction}>
                <ConnectButton />
              </form>
            )
          }
        />
      </GroupedRows>
      <p className="text-text-secondary text-xs">
        Used to warn you when a task overlaps a meeting. We only see when
        you&apos;re busy — never event details.
      </p>
    </div>
  );
}

function ConnectButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" size="sm" disabled={pending}>
      Connect
    </Button>
  );
}
