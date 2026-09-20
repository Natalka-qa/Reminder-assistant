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

const taskFormFields = {
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(2000).optional(),
  date: dateStringSchema,
  time: timeStringSchema,
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
  // 0 = "at time of task". Shared by every occurrence of the task, cascaded
  // to future notifications on change — see TaskService.updateTask.
  reminderOffsetMinutes: z.coerce
    .number()
    .int()
    .min(0)
    .max(1440)
    .optional()
    .default(0),
  // Set by the conflict dialog's "Create anyway" action (Sprint 4) to skip
  // the conflict check for this one submission — see TaskService.
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

export const createTaskSchema = z
  .object(taskFormFields)
  .refine(requiresWeeklyDays, weeklyDaysRefinement);

export const updateTaskSchema = z
  .object({
    ...taskFormFields,
    active: z.coerce.boolean().optional(),
  })
  .refine(requiresWeeklyDays, weeklyDaysRefinement);

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
