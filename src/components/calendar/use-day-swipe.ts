"use client";

import { useEffect, useRef, type RefObject, type TouchEvent } from "react";
import { flushSync } from "react-dom";

// 2026-10-17 — changing the day by moving sideways, beyond the arrows.
// Phone: the day follows the finger and slides out past SWIPE_MIN_PX (or a
// fifth of its width); the next one slides in from the other side.
// Desktop: a sideways trackpad scroll (or Shift + wheel) steps a day — one
// step per gesture, so the trackpad's momentum doesn't run through the week.

/** § 3 — a horizontal swipe longer than this changes the day. */
const SWIPE_MIN_PX = 50;
/** Until the finger has moved this far, it isn't yet a swipe or a scroll. */
const AXIS_SLOP_PX = 10;
const WHEEL_STEP_PX = 60;
/** A gesture ends when the wheel is quiet this long. */
const WHEEL_QUIET_MS = 220;

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function setSlide(
  el: HTMLElement,
  x: number,
  opacity: number,
  transition?: string,
) {
  el.style.transition = transition ?? "none";
  el.style.transform = x === 0 ? "" : `translateX(${x}px)`;
  el.style.opacity = opacity === 1 ? "" : String(opacity);
}

function afterTransition(el: HTMLElement, then: () => void) {
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    el.removeEventListener("transitionend", finish);
    then();
  };
  el.addEventListener("transitionend", finish);
  // In case the event never comes (a hidden tab, nothing to move).
  setTimeout(finish, 400);
}

/**
 * The touch handlers for `area`, the part that follows the finger. `onStep(±1)` changes the day and returns whether it changed
 * in place (false: another week is loading, so the area stays out of view
 * until the page replaces it). `blocked()` — a block is being dragged.
 */
export function useDaySwipe({
  area,
  onStep,
  blocked,
}: {
  area: RefObject<HTMLElement | null>;
  onStep: (delta: number) => boolean;
  blocked: () => boolean;
}) {
  const gesture = useRef<{
    x: number;
    y: number;
    axis: "x" | "y" | null;
  } | null>(null);

  function onTouchStart(event: TouchEvent) {
    if (event.touches.length !== 1) {
      gesture.current = null;
      return;
    }
    const touch = event.touches[0];
    gesture.current = { x: touch.clientX, y: touch.clientY, axis: null };
  }

  function onTouchMove(event: TouchEvent) {
    const start = gesture.current;
    const el = area.current;
    if (!start || !el) return;
    if (blocked()) {
      gesture.current = null;
      setSlide(el, 0, 1);
      return;
    }
    const touch = event.touches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (start.axis === null) {
      if (Math.hypot(dx, dy) < AXIS_SLOP_PX) return;
      // Mostly-vertical movement is scrolling the page, not a swipe.
      start.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (start.axis !== "x") return;
    const width = el.offsetWidth || 1;
    setSlide(el, dx, 1 - Math.min(Math.abs(dx) / width, 1) * 0.6);
  }

  function onTouchEnd(event: TouchEvent) {
    const start = gesture.current;
    gesture.current = null;
    const el = area.current;
    if (!start || !el || start.axis !== "x") return;
    const dx = event.changedTouches[0].clientX - start.x;
    const width = el.offsetWidth || 1;
    if (blocked() || Math.abs(dx) < Math.min(SWIPE_MIN_PX, width / 5)) {
      setSlide(
        el,
        0,
        1,
        "transform var(--dur-2) var(--ease-out), opacity var(--dur-2) var(--ease-out)",
      );
      return;
    }
    const delta = dx < 0 ? 1 : -1;
    if (reducedMotion()) {
      setSlide(el, 0, 1);
      onStep(delta);
      return;
    }
    // Out the way it was going…
    setSlide(
      el,
      -delta * width,
      0,
      "transform var(--dur-2) var(--ease-in), opacity var(--dur-2) var(--ease-in)",
    );
    afterTransition(el, () => {
      let inPlace = false;
      flushSync(() => {
        inPlace = onStep(delta);
      });
      if (!inPlace) return;
      // …and the next day in from the other side.
      setSlide(el, delta * width * 0.3, 0);
      void el.offsetWidth;
      setSlide(
        el,
        0,
        1,
        "transform var(--dur-3) var(--ease-out), opacity var(--dur-3) var(--ease-out)",
      );
    });
  }

  function onTouchCancel() {
    gesture.current = null;
    if (area.current) setSlide(area.current, 0, 1);
  }

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel };
}

/**
 * A sideways wheel over `target` steps the day: one step per gesture. The
 * listener isn't passive, so the sideways scroll doesn't also go back in
 * the browser's history.
 */
export function useWheelDays(
  target: RefObject<HTMLElement | null>,
  onStep: (delta: number) => void,
) {
  const step = useRef(onStep);
  useEffect(() => {
    step.current = onStep;
  });

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    let sum = 0;
    let stepped = false;
    let quiet: ReturnType<typeof setTimeout> | null = null;

    function onWheel(event: WheelEvent) {
      const dx =
        event.shiftKey && event.deltaX === 0 ? event.deltaY : event.deltaX;
      if (Math.abs(dx) <= Math.abs(event.shiftKey ? 0 : event.deltaY)) return;
      event.preventDefault();
      if (quiet) clearTimeout(quiet);
      quiet = setTimeout(() => {
        sum = 0;
        stepped = false;
      }, WHEEL_QUIET_MS);
      if (stepped) return;
      // Lines or pages (a mouse wheel), not pixels: one notch is a step.
      sum += event.deltaMode === 0 ? dx : Math.sign(dx) * WHEEL_STEP_PX;
      if (Math.abs(sum) >= WHEEL_STEP_PX) {
        stepped = true;
        step.current(sum > 0 ? 1 : -1);
      }
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (quiet) clearTimeout(quiet);
    };
  }, [target]);
}
