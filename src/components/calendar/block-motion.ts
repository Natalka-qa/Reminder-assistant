"use client";

import { useLayoutEffect, type RefObject } from "react";
import { duration, ease, prefersReducedMotion } from "@/lib/motion";

// sprint-22-tasks.md, доработка 2026-10-07 — a block put back by Undo
// glides there instead of jumping: where it stood is noted before the
// undo, and once the week is drawn again the block (maybe in another
// day's column, so a new element) slides from there to its place and
// glows briefly. Only for a move asked for — picking another day or a
// re-render never animates.

const FORGET_AFTER_MS = 4000;

const departures = new Map<string, DOMRect>();

function shownBlock(occurrenceId: string): HTMLElement | null {
  // Desktop and phone layouts are both in the page; one is hidden.
  for (const element of document.querySelectorAll<HTMLElement>(
    `[data-occurrence-id="${CSS.escape(occurrenceId)}"]`,
  )) {
    if (element.getBoundingClientRect().width > 0) return element;
  }
  return null;
}

/** Before the undo: where the block is now. */
export function noteDeparture(occurrenceId: string): void {
  const block = shownBlock(occurrenceId);
  if (!block) return;
  departures.set(occurrenceId, block.getBoundingClientRect());
  setTimeout(() => departures.delete(occurrenceId), FORGET_AFTER_MS);
}

/** On each block: glide in if it was noted and has since moved. */
export function useArrival(
  occurrenceId: string,
  ref: RefObject<HTMLElement | null>,
): void {
  useLayoutEffect(() => {
    const from = departures.get(occurrenceId);
    const block = ref.current;
    if (!from || !block) return;
    const to = block.getBoundingClientRect();
    // The hidden layout's copy, or still where it was: wait for the move.
    if (to.width === 0) return;
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    departures.delete(occurrenceId);
    if (prefersReducedMotion()) return;
    block.animate(
      [
        {
          transform: `translate(${dx}px, ${dy}px)`,
          boxShadow: "var(--lift-shadow)",
          zIndex: 30,
        },
        {
          transform: "translate(0, 0)",
          boxShadow: "0 0 0 4px var(--lift-ring)",
          zIndex: 30,
          offset: 0.75,
        },
        {
          transform: "translate(0, 0)",
          boxShadow: "0 0 0 0 transparent",
          zIndex: 30,
        },
      ],
      { duration: duration("--dur-4") + 300, easing: ease("--ease-out") },
    );
  });
}
