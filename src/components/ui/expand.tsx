"use client";

import { useRef, type ReactNode } from "react";

// sprint-23-tasks.md S23-05 (MOTION_SPEC §2) — inline expand: height from
// 0 to auto through grid rows (0fr → 1fr) with a fade (--dur-2), so what's
// below glides instead of jumping (globals.css .expand). While it closes
// it still shows what it last had; closed, it's inert — nothing inside can
// be focused or read.
export function Expand({
  open,
  gap,
  children,
}: {
  open: boolean;
  /** The parent column's gap ("0.375rem"): closed, it takes that back. */
  gap?: string;
  children: ReactNode;
}) {
  const last = useRef<ReactNode>(children);
  // eslint-disable-next-line react-hooks/refs -- keeps the closing content
  if (open) last.current = children;
  return (
    <div
      className="expand"
      data-open={open}
      inert={!open}
      style={gap && !open ? { marginTop: `calc(-1 * ${gap})` } : undefined}
    >
      {/* eslint-disable-next-line react-hooks/refs -- see above */}
      <div>{open ? children : last.current}</div>
    </div>
  );
}
