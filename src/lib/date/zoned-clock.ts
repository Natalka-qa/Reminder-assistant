import { useEffect, useState } from "react";

// The user's wall clock (date + minutes since midnight in their timezone)
// for client components that follow real time — the Calendar's now line,
// New task's "already passed" notice. Intl only, no Luxon, so it stays out
// of the client bundle; server code uses zonedNow() from ./index.

export type ZonedClock = { date: string; minutes: number };

const TICK_MS = 30_000;

export function readZonedClock(timezone: string, now = new Date()): ZonedClock {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "0";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    minutes: Number(part("hour")) * 60 + Number(part("minute")),
  };
}

// Starts from the server's reading so the first client render matches the
// HTML; ticks from there.
export function useZonedClock(
  timezone: string,
  initial: ZonedClock,
): ZonedClock {
  const [clock, setClock] = useState(initial);
  useEffect(() => {
    const id = setInterval(() => setClock(readZonedClock(timezone)), TICK_MS);
    return () => clearInterval(id);
  }, [timezone]);
  return clock;
}
