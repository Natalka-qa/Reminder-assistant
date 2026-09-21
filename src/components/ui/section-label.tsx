import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// design_handoff_reminder_assistant/README.md § Typography ("Eyebrow label").
// Used for the small uppercase labels that introduce a section (e.g. "Today,
// Apr 26", "Overdue") — "overdue" tone matches the Home screen's Overdue
// section spec (eyebrow in --overdue-ink).
export function SectionLabel({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: "default" | "overdue";
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-eyebrow font-semibold tracking-eyebrow uppercase",
        tone === "overdue" ? "text-overdue-ink" : "text-text-secondary",
        className,
      )}
    >
      {children}
    </p>
  );
}
