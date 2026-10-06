import { z } from "zod";

// Matches the wall-clock strings <input type="date">/<input type="time">
// produce. Combining these into an instant happens in the service layer via
// `zonedDateTimeToUtc` (src/lib/date), never here.
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");
export const timeStringSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Time must be in HH:mm format");

export const prioritySchema = z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]);
export const flexibilitySchema = z.enum(["FIXED", "FLEXIBLE"]);
export const repeatFrequencySchema = z.enum([
  "NONE",
  "DAILY",
  "WEEKLY",
  "MONTHLY",
]);
// sprint-20-tasks.md п.3 — how a series ends: never, on a date (its last
// day) or after N times (turned into that last day when saved).
export const repeatEndSchema = z.enum(["NEVER", "ON_DATE", "AFTER_COUNT"]);

const emptyAsUndefined = (value: unknown) =>
  value === "" || value === null ? undefined : value;

// sprint-20-tasks.md п.3–4 — a repeat's step and end. Also read by the
// edit form's overlap preview, so a preview sees the series a save would.
export const repeatShapeFields = {
  // п.4 — every N days; only a daily repeat steps.
  repeatInterval: z.coerce.number().int().min(1).max(30).optional().default(1),
  repeatEnd: repeatEndSchema.optional().default("NEVER"),
  repeatUntil: z.preprocess(emptyAsUndefined, dateStringSchema.optional()),
  repeatCount: z.preprocess(
    emptyAsUndefined,
    z.coerce
      .number()
      .int()
      .min(1, "Repeat at least once")
      .max(366, "Up to 366 times")
      .optional(),
  ),
};

const taskFormFields = {
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(2000).optional(),
  date: dateStringSchema,
  // sprint-18-tasks.md — optional: no time is a task without one ("Any
  // time"). The forms send an empty field for that.
  time: z.preprocess(emptyAsUndefined, timeStringSchema.optional()),
  durationMinutes: z.coerce
    .number()
    .int()
    .min(0, "Duration can't be negative")
    .max(1440, "Duration can't exceed 24 hours"),
  priority: prioritySchema,
  flexibility: flexibilitySchema,
  repeatFrequency: repeatFrequencySchema.optional().default("NONE"),
  repeatDaysOfWeek: z
    .array(z.coerce.number().int().min(1).max(7))
    .optional()
    .default([]),
  ...repeatShapeFields,
  // 0 = "at time of task". Shared by every occurrence of the task, cascaded
  // to future notifications on change — see TaskService.updateTask.
  reminderOffsetMinutes: z.coerce
    .number()
    .int()
    .min(0)
    .max(1440)
    .optional()
    .default(0),
  // sprint-18-tasks.md п.11–12 — none, minutes before (OFFSET, with
  // reminderOffsetMinutes), or a fixed hour for a task without a time. Not
  // given: minutes before with a time, none without (TaskService).
  reminderKind: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z
      .enum(["NONE", "OFFSET", "MORNING_OF", "EVENING_BEFORE", "BEFORE_DUE"])
      .optional(),
  ),
  // sprint-20-tasks.md п.7 — "by 12:00": a deadline for a task without a
  // time; ignored with one (TaskService).
  dueTime: z.preprocess(emptyAsUndefined, timeStringSchema.optional()),
  // Skips the conflict check for this one submission — see TaskService.
  // Sprint 4's dialog set it on "Create anyway"; since New task v2 and Edit
  // task v2 (S14-04) both forms always set it and show overlaps as a notice.
  confirmConflicts: z.coerce.boolean().optional().default(false),
};

// WEEKLY without any selected day isn't "weekly on no days" — it's an
// incomplete form. Depends on two fields at once, so it has to be a
// `.refine` on the object rather than on `repeatDaysOfWeek` alone.
function requiresWeeklyDays(data: {
  repeatFrequency: string;
  repeatDaysOfWeek: number[];
}) {
  return data.repeatFrequency !== "WEEKLY" || data.repeatDaysOfWeek.length > 0;
}

const weeklyDaysRefinement = {
  message: "Select at least one day of the week",
  path: ["repeatDaysOfWeek"],
};

// п.3 — "On date" needs a date not before the task's, "After N times" a
// number; a one-off task ignores both.
type RepeatEndData = {
  date: string;
  repeatFrequency: string;
  repeatEnd: string;
  repeatUntil?: string;
  repeatCount?: number;
};

function hasEnd(data: RepeatEndData) {
  if (data.repeatFrequency === "NONE") return true;
  if (data.repeatEnd === "ON_DATE") return data.repeatUntil !== undefined;
  if (data.repeatEnd === "AFTER_COUNT") return data.repeatCount !== undefined;
  return true;
}

// A new series can't end before it starts. An edit isn't held to its
// date: an ended series' page may show a day past its last.
function hasValidEnd(data: RepeatEndData) {
  return (
    hasEnd(data) &&
    (data.repeatFrequency === "NONE" ||
      data.repeatEnd !== "ON_DATE" ||
      data.repeatUntil! >= data.date)
  );
}

const endRefinement = {
  message: "Pick a last day on or after the start, or how many times",
  path: ["repeatUntil"],
};

export const createTaskSchema = z
  .object(taskFormFields)
  .refine(requiresWeeklyDays, weeklyDaysRefinement)
  .refine(hasValidEnd, endRefinement);

export const updateTaskSchema = z
  .object({
    ...taskFormFields,
    active: z.coerce.boolean().optional(),
  })
  .refine(requiresWeeklyDays, weeklyDaysRefinement)
  .refine(hasEnd, endRefinement);

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
