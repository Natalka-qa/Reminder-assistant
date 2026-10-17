import { z } from "zod";
import type { PictureOption } from "@/features/telegram/picture-task";
import {
  newTaskDefaults,
  resolveTaskFields,
  taskInput,
} from "@/features/tasks/new-task-fields";
import type { CreateTaskInput } from "@/lib/validation/task";

// sprint-24-tasks.md решение 4 — a draft's readings to choose from, as the
// `options` column keeps them. Anything that isn't one is dropped rather
// than trusted: the column is JSON.
const optionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
  durationMinutes: z
    .number()
    .int()
    .min(0)
    .max(24 * 60)
    .nullable(),
});

export function draftOptions(value: unknown): PictureOption[] {
  const parsed = z.array(optionSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

/** How long a draft waits for Add, Edit or Cancel (решение 12). */
export const DRAFT_LIFETIME_MS = 24 * 60 * 60 * 1000;

export type DraftFields = {
  title: string;
  date: string;
  time: string | null;
  durationMinutes: number | null;
  notes: string | null;
};

/**
 * решение 2 — what Add saves: the draft's fields as the New task form
 * would save them with nothing else changed — Fixed at a given time, the
 * user's default reminder — and the notes as the task's note.
 */
export function draftTaskInput(
  draft: DraftFields,
  context: { today: string; defaultReminderMinutes: number },
): CreateTaskInput {
  const fields = resolveTaskFields(
    {
      date: draft.date,
      ...(draft.time ? { time: draft.time } : {}),
      ...(draft.durationMinutes !== null
        ? { durationMinutes: draft.durationMinutes }
        : {}),
    },
    {},
    {
      ...newTaskDefaults(context.today),
      reminderOffsetMinutes: context.defaultReminderMinutes,
    },
  );
  return taskInput(draft.title, fields, draft.notes ?? "");
}
