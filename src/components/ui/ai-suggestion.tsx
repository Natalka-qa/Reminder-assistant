"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { SectionLabel } from "@/components/ui/section-label";

type SuggestionAction =
  | { label: string; href: string; onClick?: never }
  | { label: string; onClick: () => void; href?: never };

// design_handoff_reminder_assistant/README.md § AISuggestion. AI never
// dominates: no gradients, no glow, no chat bubbles, no robot imagery — just
// this quiet rose-tint card with a single sparkle.
export function AISuggestion({
  label,
  children,
  primaryAction,
  secondaryAction,
}: {
  label: string;
  children: ReactNode;
  primaryAction?: SuggestionAction;
  secondaryAction?: SuggestionAction;
}) {
  return (
    <div className="bg-rose-tint border-rose-tint-border rounded-[18px] border p-5">
      <div className="flex items-start gap-2">
        <span aria-hidden className="text-rose-gold text-[14px]">
          &#10022;
        </span>
        <div className="flex flex-col gap-1.5">
          <SectionLabel className="text-rose-tint-label">
            {label}
          </SectionLabel>
          <p className="text-rose-tint-text text-[14px] leading-[1.6]">
            {children}
          </p>
          {(primaryAction || secondaryAction) && (
            <div className="mt-1 flex items-center gap-4">
              {primaryAction && <ActionLink action={primaryAction} primary />}
              {secondaryAction && <ActionLink action={secondaryAction} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionLink({
  action,
  primary = false,
}: {
  action: SuggestionAction;
  primary?: boolean;
}) {
  // Never --muted (#A9A6A2) here — the README calls that out explicitly as
  // failing contrast for an interactive label.
  const className = primary
    ? "text-burgundy text-meta font-semibold"
    : "text-text-secondary text-meta";

  if (action.href) {
    return (
      <Link href={action.href} className={className}>
        {action.label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={action.onClick} className={className}>
      {action.label}
    </button>
  );
}
