"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { GroupedRows, GroupedRow } from "@/components/ui/grouped-rows";
import {
  generateTelegramLinkCodeAction,
  disconnectTelegramAction,
} from "@/features/user/actions";

// design_handoff_reminder_assistant/README.md § Settings — a real,
// interactive row (unlike the "Coming in a later sprint" placeholders in
// settings-form.tsx), so it's a separate component/card rather than folded
// into that simpler value+Select form. Only rendered when
// isTelegramEnabled() (sprint-10-tasks.md) — the page passes that down,
// this component doesn't check env itself.
export function TelegramConnect({ connected }: { connected: boolean }) {
  const [pending, startTransition] = useTransition();
  const [deepLink, setDeepLink] = useState<string | null>(null);

  function handleConnect() {
    startTransition(async () => {
      const result = await generateTelegramLinkCodeAction();
      if (result.status === "success") {
        setDeepLink(result.deepLink);
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleDisconnect() {
    startTransition(async () => {
      const result = await disconnectTelegramAction();
      if (result.status === "error" && result.message) {
        toast.error(result.message);
        return;
      }
      setDeepLink(null);
      toast.success("Telegram disconnected");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <SectionLabel>Telegram</SectionLabel>
      <GroupedRows>
        <GroupedRow
          label="Reminders"
          hint={connected ? "Connected" : "Not connected"}
          value={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={connected ? handleDisconnect : handleConnect}
            >
              {connected ? "Disconnect" : "Connect"}
            </Button>
          }
        />
      </GroupedRows>
      {deepLink && (
        <a
          href={deepLink}
          target="_blank"
          rel="noreferrer"
          className="text-burgundy text-[15px] font-semibold"
        >
          Open Telegram to finish connecting →
        </a>
      )}
    </div>
  );
}
