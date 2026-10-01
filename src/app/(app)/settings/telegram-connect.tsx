"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { GroupedRows, GroupedRow } from "@/components/ui/grouped-rows";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  generateTelegramLinkCodeAction,
  disconnectTelegramAction,
  updateTelegramSummaryAction,
} from "@/features/user/actions";
import { formatMinutes } from "@/features/scheduling/calendar-layout";
import { SUMMARY_MINUTES } from "@/lib/validation/user";

const OFF = "off";

// sprint-15-tasks.md S15-10, п.17 — Off, then the fixed times.
const SUMMARY_CHOICES = [
  { value: OFF, label: "Off" },
  ...SUMMARY_MINUTES.map((minutes) => ({
    value: String(minutes),
    label: formatMinutes(minutes),
  })),
];

// design_handoff_reminder_assistant/README.md § Settings — a real,
// interactive row (unlike the "Coming in a later sprint" placeholders in
// settings-form.tsx), so it's a separate component/card rather than folded
// into that simpler value+Select form. Only rendered when
// isTelegramEnabled() (sprint-10-tasks.md) — the page passes that down,
// this component doesn't check env itself.
export function TelegramConnect({
  connected,
  summaryMinutes,
}: {
  connected: boolean;
  /** "Morning summary" (S15-10): minutes after midnight, null = off. */
  summaryMinutes: number | null;
}) {
  const [pending, startTransition] = useTransition();
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [summary, setSummary] = useState(
    summaryMinutes === null ? OFF : String(summaryMinutes),
  );

  function handleSummaryChange(value: string | null) {
    if (!value || value === summary) return;
    const previous = summary;
    setSummary(value);
    startTransition(async () => {
      const result = await updateTelegramSummaryAction(value);
      if (result.status === "error") {
        setSummary(previous);
        toast.error(result.message ?? "Couldn't save the summary time");
        return;
      }
      toast.success("Morning summary saved");
    });
  }

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
        {connected && (
          <GroupedRow
            label="Morning summary"
            hint={
              summary === OFF
                ? "Today's plan, sent to Telegram each morning"
                : "Today's plan, sent at this time"
            }
            value={
              <Select value={summary} onValueChange={handleSummaryChange}>
                <SelectTrigger
                  aria-label="Morning summary"
                  className="h-auto w-fit gap-1 border-0 bg-transparent p-0 text-[15px]"
                >
                  <SelectValue>
                    {(value: string) =>
                      SUMMARY_CHOICES.find((choice) => choice.value === value)
                        ?.label
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SUMMARY_CHOICES.map((choice) => (
                    <SelectItem key={choice.value} value={choice.value}>
                      {choice.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
        )}
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
