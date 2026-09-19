import { z } from "zod";

export type RecurrenceRule =
  | { frequency: "DAILY" }
  | { frequency: "WEEKLY"; daysOfWeek: number[] } // ISO: 1=Mon..7=Sun
  | { frequency: "MONTHLY" };

export const recurrenceRuleSchema = z.discriminatedUnion("frequency", [
  z.object({ frequency: z.literal("DAILY") }),
  z.object({
    frequency: z.literal("WEEKLY"),
    daysOfWeek: z.array(z.number().int().min(1).max(7)).min(1),
  }),
  z.object({ frequency: z.literal("MONTHLY") }),
]);

export function serializeRecurrenceRule(
  rule: RecurrenceRule | null,
): string | null {
  return rule ? JSON.stringify(rule) : null;
}

export function parseRecurrenceRule(raw: string | null): RecurrenceRule | null {
  if (!raw) return null;
  return recurrenceRuleSchema.parse(JSON.parse(raw));
}

// Occurrences are generated (and the window later extended) this many days
// ahead at a time — never years ahead. Used both at creation and extension.
export const RECURRENCE_WINDOW_DAYS = 30;

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Human-readable summary for read-only displays (task detail, locked edit form). */
export function describeRecurrenceRule(rule: RecurrenceRule): string {
  switch (rule.frequency) {
    case "DAILY":
      return "Daily";
    case "WEEKLY":
      return `Weekly on ${[...rule.daysOfWeek]
        .sort((a, b) => a - b)
        .map((day) => WEEKDAY_LABELS[day - 1])
        .join(", ")}`;
    case "MONTHLY":
      return "Monthly";
  }
}
