import Link from "next/link";
import { cn } from "@/lib/utils";

// CALENDAR_V2_UPDATE.md § 1. Presentational only (no hooks), shared by the
// week and month views, which compute the hrefs from their selected day.
// Week/Month, Today and the arrows are links: each is a different URL
// (`?date=`, `?view=month`). Every control's hit area reaches 44px tall for
// touch (§ 6) through a pseudo-element, without changing the layout.
export function CalendarHeader({
  title,
  subtitle,
  view,
  weekHref,
  monthHref,
  todayHref,
  prevHref,
  nextHref,
}: {
  title: string;
  subtitle: string;
  view: "week" | "month";
  weekHref: string;
  monthHref: string;
  /** § 1 — back to today, in the current mode. */
  todayHref: string;
  prevHref: string;
  nextHref: string;
}) {
  const unit = view === "week" ? "week" : "month";
  return (
    <div className="flex flex-wrap items-end justify-between gap-[18px]">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-text-primary text-[42px] leading-none font-light">
          {title}
        </h1>
        <p className="text-calendar-quiet-text text-[14px]">{subtitle}</p>
      </div>
      <div className="flex items-center gap-4">
        <nav aria-label="Calendar view" className="flex gap-4">
          <ModeLink href={weekHref} active={view === "week"}>
            Week
          </ModeLink>
          <ModeLink href={monthHref} active={view === "month"}>
            Month
          </ModeLink>
        </nav>
        <span aria-hidden className="bg-border h-4 w-px" />
        <div className="flex items-center gap-0.5">
          <Link
            href={todayHref}
            className="text-text-tertiary hover:text-burgundy relative rounded-[6px] px-2 py-1 text-[13px] font-medium transition-colors after:absolute after:inset-x-0 after:-inset-y-[10px]"
          >
            Today
          </Link>
          <ArrowLink href={prevHref} label={`Previous ${unit}`}>
            &#8249;
          </ArrowLink>
          <ArrowLink href={nextHref} label={`Next ${unit}`}>
            &#8250;
          </ArrowLink>
        </div>
      </div>
    </div>
  );
}

function ModeLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative border-b-[1.5px] py-1 text-[13px] after:absolute after:-inset-x-[5px] after:-inset-y-[9px]",
        active
          ? "border-burgundy text-burgundy font-semibold"
          : "text-calendar-quiet-text hover:text-burgundy border-transparent font-medium",
      )}
    >
      {children}
    </Link>
  );
}

// 30×30 as drawn, 44×44 to touch (§ 1).
function ArrowLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="text-text-tertiary hover:bg-border-soft relative flex size-[30px] items-center justify-center rounded-[6px] text-[19px] leading-none transition-colors after:absolute after:-inset-[7px]"
    >
      {children}
    </Link>
  );
}
