import { z } from "zod";

// Matches the wall-clock strings <input type="date">/<input type="time">
// produce. Combining these into an instant happens in the service layer via
// `zonedDateTimeToUtc` (src/lib/date), never here.
const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");
const timeStringSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Time must be in HH:mm format");

export const prioritySchema = z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]);
export const flexibilitySchema = z.enum(["FIXED", "FLEXIBLE"]);

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
  // Disabled placeholders in the form this sprint (Sprint 5 / Sprint 6) —
  // accepted so the form can submit them, not validated or acted on.
  repeat: z.string().optional(),
  reminder: z.string().optional(),
};

export const createTaskSchema = z.object(taskFormFields);

export const updateTaskSchema = z.object({
  ...taskFormFields,
  active: z.coerce.boolean().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
