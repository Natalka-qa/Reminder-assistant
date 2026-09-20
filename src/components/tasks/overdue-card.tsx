"use client";

import Link from "next/link";

// design_handoff_reminder_assistant/README.md § Overdue card — the one place
// a card is used in the Home list. Its quick-action pills aren't part of
// ReminderRow's own spec (that row only supports tap-to-open /
// tap-indicator-to-toggle) — they're specific to this overdue treatment.
export function OverdueCard({
  href,
  time,
  title,
  onDone,
  onPartial,
  onSnooze,
  onSkip,
}: {
  href: string;
  time: string;
  title: string;
  onDone?: () => void;
  onPartial?: () => void;
  onSnooze?: () => void;
  onSkip?: () => void;
}) {
  return (
    <div className="border-overdue-card-border bg-surface flex flex-col gap-3 rounded-[18px] border px-5 py-[18px]">
      <Link href={href} className="flex flex-col gap-0.5">
        <span className="text-overdue-ink text-meta font-semibold">{time}</span>
        <span className="text-text-primary text-[17px] leading-[1.35]">
          {title}
        </span>
      </Link>
      <div className="flex flex-wrap gap-1.5 pl-[70px]">
        <ActionPill onClick={onDone}>Done</ActionPill>
        <ActionPill onClick={onPartial}>Partial</ActionPill>
        <ActionPill onClick={onSnooze}>Snooze</ActionPill>
        <ActionPill onClick={onSkip}>Skip</ActionPill>
      </div>
    </div>
  );
}

function ActionPill({
  onClick,
  children,
}: {
  onClick?: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-surface border-border text-text-tertiary rounded-pill border px-[13px] py-[7px] text-[12px] font-medium"
    >
      {children}
    </button>
  );
}
