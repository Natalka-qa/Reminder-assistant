import { formatMinutes } from "@/features/scheduling/calendar-layout";
import type { SchedulePreferences } from "@/lib/validation/user";

// 2026-10-08 — Settings' one line for the hours that moved to
// /settings/day, short enough for a phone row: "8–21 · Mon–Fri 9–17" —
// the row's hint says which is which.

const SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function daysLabel(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 7) return "every day";
  const consecutive = sorted.every(
    (day, index) => index === 0 || day === sorted[index - 1] + 1,
  );
  if (consecutive && sorted.length > 2) {
    return `${SHORT[sorted[0] - 1]}–${SHORT[sorted.at(-1)! - 1]}`;
  }
  return sorted.map((day) => SHORT[day - 1]).join(", ");
}

/** "9" for 09:00, "9:30" for 09:30. */
function hour(minutes: number): string {
  const [h, m] = formatMinutes(minutes).split(":");
  return m === "00" ? String(Number(h)) : `${Number(h)}:${m}`;
}

export function daySummary(prefs: SchedulePreferences): string {
  const day = `${hour(prefs.dayStartMinutes)}–${hour(prefs.dayEndMinutes)}`;
  const work =
    prefs.workDays.length === 0
      ? "no work hours"
      : `${daysLabel(prefs.workDays)} ${hour(prefs.workStartMinutes)}–${hour(prefs.workEndMinutes)}`;
  return `${day} · ${work}`;
}
