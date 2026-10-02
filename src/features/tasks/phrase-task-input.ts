import { parseTask, type ParsedTask } from "@/lib/parse-task";
import { splitTaskPhrase } from "@/lib/parse-task/split";
import type { CreateTaskInput } from "@/lib/validation/task";
import {
  newTaskDefaults,
  resolveTaskFields,
  taskInput,
  type ResolvedTaskFields,
} from "./new-task-fields";

export type PhraseTaskInput =
  | {
      status: "ready";
      input: CreateTaskInput;
      fields: ResolvedTaskFields;
      parsed: ParsedTask;
    }
  /** "Find an hour tomorrow evening" — the search lives in the app (п.5). */
  | { status: "needs-search" }
  /** Nothing left for a title once the date and time are taken out. */
  | { status: "empty" };

/**
 * sprint-15-tasks.md S15-03 — a task written as one phrase, read the way
 * the New task form reads it with nothing changed by hand: lib/parse-task,
 * then resolveTaskFields over the form's defaults, then taskInput. `today`
 * and `nowMinutes` are the user's, in their timezone. Pure, so the
 * Telegram bot's quick add is testable without a chat.
 */
export function taskInputFromPhrase(
  text: string,
  context: {
    today: string;
    nowMinutes: number;
    defaultReminderMinutes: number;
  },
): PhraseTaskInput {
  const parsed = parseTask(text.trim(), context.today);
  if (parsed.timeSearch) return { status: "needs-search" };
  if (parsed.title.length === 0) return { status: "empty" };

  const fields = resolveTaskFields(
    parsed,
    {},
    {
      ...newTaskDefaults(context.today),
      reminderOffsetMinutes: context.defaultReminderMinutes,
    },
  );
  return {
    status: "ready",
    input: taskInput(parsed.title, fields),
    fields,
    parsed,
  };
}

/**
 * "Dance every Mon at 19 and Wed at 20" — a repeat with its own time on
 * each day is one task per day (splitTaskPhrase), since a task has one
 * time for all its days. Each part is read like any phrase; anything that
 * can't be split is the one-task reading above.
 */
export function taskInputsFromPhrase(
  text: string,
  context: Parameters<typeof taskInputFromPhrase>[1],
): PhraseTaskInput[] {
  const parts = splitTaskPhrase(text);
  if (parts) {
    const read = parts.map((part) => taskInputFromPhrase(part, context));
    if (read.every((part) => part.status === "ready")) return read;
  }
  return [taskInputFromPhrase(text, context)];
}
