import type { ReactNode } from "react";

// design_handoff_reminder_assistant/README.md § InsightCard. The hairline
// ring is decoration only (aria-hidden, pointer-events-none) — text sits in
// a `relative` layer so it always paints above it.
export function InsightCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-blue-tint border-blue-tint-border relative overflow-hidden rounded-[20px] border px-[22px] py-5">
      <div
        aria-hidden
        className="border-blue-ring-border pointer-events-none absolute -top-[34px] -right-[34px] size-[112px] rounded-pill border"
      />
      <div className="relative flex flex-col gap-1">
        <p className="text-blue-ink-title text-[16px] font-semibold">
          {title}
        </p>
        <p className="text-blue-ink-body max-w-[240px] text-[14px] leading-[1.55]">
          {children}
        </p>
      </div>
    </div>
  );
}
