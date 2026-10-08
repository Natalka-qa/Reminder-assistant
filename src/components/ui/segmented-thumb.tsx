"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// sprint-23-tasks.md S23-05 (MOTION_SPEC §2) — the sliding thumb under a
// segmented control whose choices aren't the same width (Importance):
// it measures the chosen one and slides to it (--dur-2, ease-in-out).
// Put it first inside a `relative` container whose choices are buttons
// with `data-segment` and `relative` (so they sit above it).
export function SegmentedThumb({
  active,
  className,
}: {
  /** The chosen choice's index; -1 hides the thumb. */
  active: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const container = ref.current?.parentElement;
    const segment = container?.querySelectorAll<HTMLElement>("[data-segment]")[
      active
    ];
    setBox(segment ? { left: segment.offsetLeft, width: segment.offsetWidth } : null);
  }, [active]);
  return (
    <span
      ref={ref}
      aria-hidden
      className={cn(
        "absolute top-[3px] bottom-[3px] rounded-full transition-[left,width] duration-(--dur-2) ease-in-out motion-reduce:transition-none",
        box ? "opacity-100" : "opacity-0",
        className,
      )}
      style={box ?? undefined}
    />
  );
}
