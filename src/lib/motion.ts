// sprint-23-tasks.md S23-05 (MOTION_SPEC §1) — the motion tokens for
// animations started from script (element.animate), read from the same
// CSS variables the stylesheets use, so there's one set of curves and
// durations. Fallbacks match globals.css.

const FALLBACK = {
  "--ease-out": "cubic-bezier(0.33, 1, 0.68, 1)",
  "--ease-in-out": "cubic-bezier(0.65, 0, 0.35, 1)",
  "--ease-in": "cubic-bezier(0.32, 0, 0.67, 0)",
  "--dur-1": "120ms",
  "--dur-2": "200ms",
  "--dur-3": "280ms",
  "--dur-4": "420ms",
} as const;

type Token = keyof typeof FALLBACK;

function read(token: Token): string {
  if (typeof document === "undefined") return FALLBACK[token];
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
  return value || FALLBACK[token];
}

/** An easing for element.animate, e.g. ease("--ease-out"). */
export function ease(token: "--ease-out" | "--ease-in-out" | "--ease-in") {
  return read(token);
}

/** A duration in milliseconds, e.g. duration("--dur-3") → 280. */
export function duration(
  token: "--dur-1" | "--dur-2" | "--dur-3" | "--dur-4",
): number {
  return Number.parseFloat(read(token));
}

/** Whether the person asked for less motion. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
