"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sprout } from "lucide-react";
import { duration, ease, prefersReducedMotion } from "@/lib/motion";
import { shiftDate } from "@/lib/date/calendar-date";
import {
  HABIT_INVITE_COOKIE,
  HABIT_INVITE_HIDE_DAYS,
  type HabitInvite,
} from "@/features/habits/habit-invite";

const LIFT = "var(--lift-shadow)";

// backlog.md (2026-10-07) — while there's no habit, Home asks a short,
// human question where the habits strip would be, with a way in and a
// "Not now". 2026-10-08: "Not now" folds it to one line, "Add a habit →",
// for two weeks (then it asks again) — the way in stays — and does it
// smoothly: the card lifts on a soft shadow while its words fade, then
// shrinks to the line's height as its background and shadow dissolve and
// the line fades in. A cookie, not localStorage: the page reads it, so the
// card never flashes open on load.
export function HabitInviteCard({
  invite,
  today,
  initiallyFolded,
}: {
  invite: HabitInvite;
  today: string;
  /** "Not now" was pressed within the last two weeks. */
  initiallyFolded: boolean;
}) {
  const [folded, setFolded] = useState(initiallyFolded);
  const frame = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLElement>(null);
  const line = useRef<HTMLAnchorElement>(null);
  // The card's height when it started folding; null — nothing to animate.
  const foldingFrom = useRef<number | null>(null);

  // Second step: once the line is drawn, shrink from the card to it.
  useLayoutEffect(() => {
    const from = foldingFrom.current;
    const box = frame.current;
    if (!folded || from === null || !box) return;
    foldingFrom.current = null;
    const to = box.offsetHeight;
    box.animate(
      [
        {
          height: `${from}px`,
          backgroundColor: "var(--surface)",
          boxShadow: LIFT,
          borderRadius: "16px",
        },
        {
          height: `${to}px`,
          backgroundColor: "transparent",
          boxShadow: "0 0 0 0 transparent",
          borderRadius: "22px",
        },
      ],
      { duration: duration("--dur-3"), easing: ease("--ease-out") },
    );
    line.current?.animate(
      [
        { opacity: 0, transform: "translateY(4px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      {
        duration: duration("--dur-2"),
        delay: duration("--dur-1"),
        easing: ease("--ease-out"),
        fill: "backwards",
      },
    );
  }, [folded]);

  function notNow() {
    const until = shiftDate(today, HABIT_INVITE_HIDE_DAYS);
    document.cookie = `${HABIT_INVITE_COOKIE}=${until}; path=/; max-age=${
      (HABIT_INVITE_HIDE_DAYS + 1) * 86400
    }; samesite=lax`;

    const box = frame.current;
    const reduced = prefersReducedMotion();
    if (!box || !card.current || reduced) {
      setFolded(true);
      return;
    }
    // First step: lift on a soft shadow while the words fade.
    const height = box.offsetHeight;
    box.animate([{ boxShadow: "0 0 0 0 transparent" }, { boxShadow: LIFT }], {
      duration: duration("--dur-2"),
      easing: ease("--ease-out"),
      fill: "forwards",
    });
    const fade = card.current.animate(
      [
        { opacity: 1, transform: "translateY(0)" },
        { opacity: 0, transform: "translateY(-3px)" },
      ],
      {
        duration: duration("--dur-2"),
        easing: ease("--ease-out"),
        fill: "forwards",
      },
    );
    // Folds when the fade ends — or anyway shortly after, should the page
    // not be running animations (a hidden tab).
    let done = false;
    const fold = () => {
      if (done) return;
      done = true;
      box.getAnimations().forEach((animation) => animation.cancel());
      foldingFrom.current = height;
      setFolded(true);
    };
    fade.onfinish = fold;
    setTimeout(fold, 320);
  }

  return (
    <div ref={frame} className="overflow-hidden rounded-2xl">
      {folded ? (
        <Link
          ref={line}
          href="/progress/habits/new"
          className="text-accent-text flex min-h-11 w-fit items-center gap-2 text-sm font-semibold"
        >
          <span
            aria-hidden
            className="bg-burgundy-tint rounded-pill flex size-6 items-center justify-center"
          >
            <Sprout className="size-3.5" strokeWidth={1.8} />
          </span>
          Add a habit →
        </Link>
      ) : (
        <section
          ref={card}
          aria-labelledby="habit-invite-question"
          className="bg-surface border-border flex items-start gap-3 rounded-2xl border px-4 py-3.5"
        >
          <span
            aria-hidden
            className="bg-burgundy-tint text-accent-text rounded-pill mt-0.5 flex size-8 shrink-0 items-center justify-center"
          >
            <Sprout className="size-4" strokeWidth={1.8} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p
              id="habit-invite-question"
              className="text-text-primary text-[15px] font-medium"
            >
              {invite.question}
            </p>
            <p className="text-tasks-meta text-[13px] leading-snug">
              {invite.hint}
            </p>
            <div className="mt-1 flex items-center gap-1">
              <Link
                href="/progress/habits/new"
                className="text-accent-text -ml-1 min-h-11 content-center px-1 text-sm font-semibold"
              >
                {invite.cta} →
              </Link>
              <button
                type="button"
                onClick={notNow}
                className="text-tasks-meta min-h-11 px-3 text-sm"
              >
                Not now
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
