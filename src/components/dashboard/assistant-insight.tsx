import Link from "next/link";
import { AssistantMark } from "@/components/dashboard/assistant-mark";

// HOME_V2_UPDATE.md § 5 — "Assistant insight" card. Background gradient,
// border and the decorative composition are ported from the reference
// prototype (one-off illustration values, not tokens — see sky-scene.tsx's
// same reasoning); only the body copy is data — computed by the caller via
// assistant-message.ts's assistantMessage (backlog.md, 2026-10-07), never hardcoded (the title itself is
// static in the reference prototype too, so it stays static here).
export function AssistantInsight({
  title = "A calmer day ahead",
  body,
  moreHref,
}: {
  /** backlog.md (2026-10-07) — in the message's mood (assistantTitle). */
  title?: string;
  body: string;
  /** S13-05 — set when the body ends with a pattern sentence. */
  moreHref?: string;
}) {
  return (
    <div
      className="relative flex flex-col gap-[9px] overflow-hidden rounded-[20px] border p-[22px] pb-6"
      style={{
        background:
          "linear-gradient(152deg, var(--insight-from) 0%, var(--insight-mid) 54%, var(--insight-to) 100%)",
        borderColor: "var(--home-insight-border)",
      }}
    >
      <svg
        aria-hidden
        width="270"
        height="160"
        viewBox="0 0 270 160"
        fill="none"
        className="pointer-events-none absolute -right-7 -bottom-[62px]"
      >
        <circle cx="156" cy="100" r="58" fill="var(--insight-disc)" />
        <path d="M2 100 H 268" stroke="var(--insight-line)" />
        <circle
          cx="156"
          cy="100"
          r="84"
          stroke="var(--insight-orbit)"
          strokeDasharray="2 9"
        />
        <circle cx="48" cy="36" r="1.8" fill="var(--insight-dot)" />
        <circle cx="80" cy="18" r="1.2" fill="var(--insight-dot)" />
        <path d="M48 36 L80 18" stroke="var(--insight-thread)" />
      </svg>

      <div className="relative flex items-center gap-2">
        <AssistantMark tone="insight" size={14} />
        <span
          className="text-eyebrow tracking-eyebrow font-semibold uppercase"
          style={{ color: "var(--home-insight-eyebrow)" }}
        >
          From your assistant
        </span>
      </div>
      <p className="font-display text-blue-ink-title relative text-[30px] leading-[1.1] font-light">
        {title}
      </p>
      <p className="text-blue-ink-body relative max-w-[270px] text-[14px] leading-[1.6] text-pretty">
        {body}
      </p>
      {moreHref && (
        <Link
          href={moreHref}
          className="text-blue-ink-body decoration-blue-ink-body/40 hover:decoration-blue-ink-body relative self-start text-[14px] font-semibold underline underline-offset-4"
        >
          How it&apos;s going →
        </Link>
      )}
    </div>
  );
}
