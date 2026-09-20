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
      <div className="flex flex-col gap-0.5">
        <span className="text-text-primary text-[15px]">{label}</span>
        {hint && (
          <span className="text-placeholder-text text-xs">{hint}</span>
        )}
      </div>
      <div className="text-text-secondary flex items-center gap-1 text-[15px]">
        {value}
        {href && <ChevronRight className="size-4" strokeWidth={1.6} />}
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
