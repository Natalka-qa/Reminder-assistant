import Link from "next/link";
import { cn } from "@/lib/utils";
import { EYEBROW } from "./shared";

/** The eyebrow ("New task", "Edit task") and a quiet Cancel. */
export function FormHeader({
  label,
  cancelHref,
}: {
  label: string;
  cancelHref: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className={EYEBROW}>{label}</p>
      <Link
        href={cancelHref}
        className="text-newtask-quiet-text hover:text-text-primary flex min-h-11 items-center px-1 text-[14px] transition-colors"
      >
        Cancel
      </Link>
    </div>
  );
}

/** § 9 — the filled submit pill, Cancel, and why it can't submit yet. */
export function FormActions({
  submitLabel,
  pendingLabel,
  pending,
  canSubmit,
  cancelHref,
  blockedHint,
}: {
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  canSubmit: boolean;
  cancelHref: string;
  blockedHint: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-[18px]">
      <button
        type="submit"
        disabled={!canSubmit || pending}
        aria-disabled={!canSubmit || pending}
        className={cn(
          "text-on-accent h-[50px] rounded-full px-[30px] text-[15px] font-semibold transition-colors",
          canSubmit
            ? "bg-burgundy hover:bg-burgundy-hover"
            : "bg-newtask-muted-burgundy cursor-not-allowed",
        )}
      >
        {pending ? pendingLabel : submitLabel}
      </button>
      <Link
        href={cancelHref}
        className="text-newtask-quiet-text hover:text-text-primary flex min-h-11 items-center px-1 text-[15px] transition-colors"
      >
        Cancel
      </Link>
      {!canSubmit && (
        <p className="text-newtask-quiet-text text-[13px]">{blockedHint}</p>
      )}
    </div>
  );
}
