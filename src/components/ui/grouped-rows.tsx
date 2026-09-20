import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// design_handoff_reminder_assistant/README.md § Grouped rows (settings,
// form).
export function GroupedRows({ children }: { children: ReactNode }) {
  return (
    <div className="bg-surface border-border overflow-hidden rounded-[18px] border">
      {children}
    </div>
  );
}

export function GroupedRow({
  label,
  value,
  hint,
  href,
  className,
}: {
  label: string;
  value?: ReactNode;
  hint?: string;
  href?: string;
  className?: string;
}) {
  const content = (
    <div
      className={cn(
        "border-border-soft flex items-center justify-between gap-3 border-b px-5 py-[17px] last:border-b-0",
        className,
      )}
    >
      {/* A plain flex row lets one nowrap child (the label) and one
          unbounded-width child (a long hint, or a long value like Notes)
          fight over space in ways that overflow or overlap instead of
          wrapping. Capping the label column's width is what actually forces
          the hint to wrap within it; the value column then gets the rest
          via flex-1 and can wrap too if it's long free text. */}
      <div className="flex max-w-[55%] shrink-0 flex-col gap-0.5">
        <span className="text-text-primary text-[15px] whitespace-nowrap">
          {label}
        </span>
        {hint && <span className="text-placeholder-text text-xs">{hint}</span>}
      </div>
      <div className="text-text-secondary flex min-w-0 flex-1 items-center justify-end gap-1 text-right text-[15px]">
        {value}
        {href && <ChevronRight className="size-4 shrink-0" strokeWidth={1.6} />}
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}
