import Link from "next/link";
import { Button } from "@/components/ui/button";

// design_handoff_reminder_assistant/README.md § EmptyState. Typography,
// never illustration — the ring is a plain decorative hairline, not an
// image. The CTA is `relative` so the ring (behind it, `top-[78px]`) never
// crosses it.
export function EmptyState({
  title,
  body,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <div className="relative flex flex-col items-center gap-3 py-[120px] text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute top-[78px] left-1/2 size-[160px] -translate-x-1/2 rounded-pill border border-[#e9e2dd]"
      />
      <span aria-hidden className="text-rose-gold relative text-[14px]">
        &#10022;
      </span>
      <p className="font-display relative text-[40px] leading-none font-light">
        {title}
      </p>
      <p className="text-text-secondary relative text-[15px]">{body}</p>
      <Button
        nativeButton={false}
        render={<Link href={ctaHref} />}
        className="relative mt-2"
      >
        {ctaLabel}
      </Button>
    </div>
  );
}
