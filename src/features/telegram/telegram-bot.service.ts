import "server-only";
import { revalidatePath } from "next/cache";
import type { User } from "@prisma/client";
import { env } from "@/lib/env";
import { addMinutes, formatDateInZone, formatTimeInZone } from "@/lib/date";
import { runInTransaction } from "@/lib/db/transaction";
import {
  ALREADY_CLOSED_MESSAGE,
  buttonResultMessage,
  connectedMessage,
  createdButtons,
  createdMessage,
  EMPTY_PHRASE_MESSAGE,
  helpMessage,
  INVALID_CODE_MESSAGE,
  linkedMessage,
  NEEDS_SEARCH_MESSAGE,
  nextMessage,
  notLinkedMessage,
  occurrenceButtons,
  openAppButton,
  replyKeyboard,
  todayMessage,
  TOO_LATE_TO_CHANGE_MESSAGE,
  TOO_LATE_TO_UNDO_MESSAGE,
  unknownCommandMessage,
} from "@/lib/telegram/bot-messages";
import type { ParsedUpdate } from "@/lib/telegram/parse-update";
import {
  answerTelegramButton,
  editTelegramMessage,
  sendTelegramMessage,
} from "@/lib/telegram/send-telegram-message";
import { dashboardService } from "@/features/scheduling/dashboard.service";
import { occurrenceService } from "@/features/scheduling/occurrence.service";
import {
  InvalidOccurrenceTransitionError,
  OccurrenceNotFoundError,
  OccurrenceNotRemovableError,
} from "@/features/scheduling/occurrence.errors";
import { slotService } from "@/features/scheduling/slot.service";
import { notificationService } from "@/features/notifications/notification.service";
import {
  formatWhenDate,
  overlapNotice,
  pastNotice,
  repeatHint,
} from "@/features/tasks/new-task-fields";
import { taskInputsFromPhrase } from "@/features/tasks/phrase-task-input";
import { taskService } from "@/features/tasks/task.service";
import {
  TaskNotFoundError,
  TaskValidationError,
} from "@/features/tasks/task.errors";
import { userService } from "@/features/user/user.service";
import {
  canFixCreatedTask,
  dayItem,
  dayItems,
  localNow,
  pickNext,
  shiftedTaskInput,
} from "./bot-view";
import { buildSummary } from "./telegram-summary.service";
import { pickCurrentOccurrence } from "@/features/scheduling/occurrence-selection";
import { editTaskValues } from "@/features/tasks/edit-task-fields";
import type { CreateTaskInput } from "@/lib/validation/task";

type Button = Extract<ParsedUpdate, { kind: "button" }>;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// The same pages the web actions revalidate after a change, so Home, Tasks
// and Calendar show what the chat just did.
function revalidateAfterChange(taskId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/calendar");
}

function isClosedError(error: unknown): boolean {
  return (
    error instanceof OccurrenceNotFoundError ||
    error instanceof InvalidOccurrenceTransitionError ||
    error instanceof OccurrenceNotRemovableError ||
    error instanceof TaskNotFoundError
  );
}

/**
 * sprint-15-tasks.md S15-05 — the bot: every update the webhook reads,
 * answered from the same services and database as the web, as the user
 * whose chat it came from (п.6). Ownership is each service's own check: a
 * button carrying someone else's id finds nothing.
 */
export const telegramBotService = {
  async handleUpdate(update: ParsedUpdate, now = new Date()): Promise<void> {
    if (update.kind === "start" && update.code) {
      const linked = await userService.linkTelegramFromCode(
        update.code,
        update.chatId,
      );
      await (linked
        ? sendTelegramMessage(
            update.chatId,
            connectedMessage(),
            replyKeyboard(),
          )
        : sendTelegramMessage(update.chatId, INVALID_CODE_MESSAGE));
      return;
    }

    const user = await userService.getUserByTelegramChat(update.chatId);
    if (!user) {
      await (update.kind === "button" || update.kind === "unknown-button"
        ? answerTelegramButton(update.callbackId, notLinkedMessage())
        : sendTelegramMessage(update.chatId, notLinkedMessage()));
      return;
    }

    switch (update.kind) {
      case "start":
        return sendTelegramMessage(
          update.chatId,
          linkedMessage(),
          replyKeyboard(),
        );
      case "unknown-command":
        return sendTelegramMessage(
          update.chatId,
          unknownCommandMessage(),
          replyKeyboard(),
        );
      case "unknown-button":
        return answerTelegramButton(update.callbackId, ALREADY_CLOSED_MESSAGE);
      case "text":
        return addTask(user, update.chatId, update.text, now);
      case "button":
        return pressButton(user, update, now);
      case "command":
        switch (update.name) {
          case "help":
            return sendTelegramMessage(
              update.chatId,
              helpMessage(),
              replyKeyboard(),
            );
          case "today":
            return showToday(user, update.chatId, now);
          case "next":
            return showNext(user, update.chatId, now);
          case "add":
            return update.args
              ? addTask(user, update.chatId, update.args, now)
              : sendTelegramMessage(update.chatId, EMPTY_PHRASE_MESSAGE);
        }
    }
  },
};

async function showToday(user: User, chatId: string, now: Date) {
  const [today, overdue] = await Promise.all([
    dashboardService.getTodayTasks(user.id, user.timezone, now),
    dashboardService.getOverdueTasks(user.id, user.timezone, now),
  ]);
  const dateLabel = formatDateInZone(now, user.timezone, "ccc, LLL d");
  await sendTelegramMessage(
    chatId,
    todayMessage(dateLabel, dayItems(today, user.timezone), overdue.length),
  );
}

async function showNext(user: User, chatId: string, now: Date) {
  const today = await dashboardService.getTodayTasks(
    user.id,
    user.timezone,
    now,
  );
  const next = pickNext(today, now);
  if (!next) {
    await sendTelegramMessage(chatId, nextMessage(null));
    return;
  }
  await sendTelegramMessage(
    chatId,
    nextMessage(dayItem(next, user.timezone)),
    occurrenceButtons({
      id: next.id,
      taskId: next.taskId,
      appUrl: env.AUTH_URL,
      recurring: next.task.recurrenceRule !== null,
    }),
  );
}

async function addTask(user: User, chatId: string, text: string, now: Date) {
  const { today, nowMinutes } = localNow(now, user.timezone);
  // "Dance every Mon at 19 and Wed at 20" is two tasks, each with its own
  // reply and buttons; anything else is one.
  const phrases = taskInputsFromPhrase(text, {
    today,
    nowMinutes,
    defaultReminderMinutes: user.defaultReminderMinutes,
  });
  const [first] = phrases;
  if (first.status === "empty") {
    await sendTelegramMessage(chatId, EMPTY_PHRASE_MESSAGE);
    return;
  }
  if (first.status === "needs-search") {
    await sendTelegramMessage(chatId, NEEDS_SEARCH_MESSAGE, {
      inline_keyboard: [
        [openAppButton("Open New task", env.AUTH_URL, "/tasks/new")],
      ],
    });
    return;
  }

  for (const phrase of phrases) {
    if (phrase.status !== "ready") continue;
    const { input } = phrase;
    let taskId: string;
    try {
      const { task } = await taskService.createTask(
        user.id,
        user.timezone,
        input,
      );
      taskId = task.id;
    } catch (error) {
      if (error instanceof TaskValidationError) {
        await sendTelegramMessage(chatId, error.message);
        return;
      }
      throw error;
    }
    revalidateAfterChange(taskId);

    const reply = await createdReply(user, taskId, input, now);
    await sendTelegramMessage(chatId, reply.text, reply.buttons);
  }
}

/**
 * "Added: …" with its notices and buttons — for a task just added, and
 * again after +1 h / Tomorrow moved it. Overlaps are checked with the task
 * itself left out (S14-02), so it's the same notice the form shows before
 * saving. A failed check only drops the overlap line.
 */
async function createdReply(
  user: User,
  taskId: string,
  saved: Pick<
    CreateTaskInput,
    | "title"
    | "date"
    | "time"
    | "durationMinutes"
    | "repeatFrequency"
    | "repeatDaysOfWeek"
  >,
  now: Date,
) {
  const { today, nowMinutes } = localNow(now, user.timezone);
  // A task without a time overlaps nothing and is never "already past"
  // today (sprint-18-tasks.md); the chat's own handling of it is S18-08.
  const time = saved.time;
  const preview = time
    ? await slotService
        .previewOverlaps(user.id, user.timezone, {
          date: saved.date,
          time,
          durationMinutes: saved.durationMinutes,
          excludeTaskId: taskId,
        })
        .catch(() => null)
    : null;
  const notices = [
    preview ? overlapNotice(preview.tasks, preview.busyCount) : null,
    time ? pastNotice(saved.date, time, today, nowMinutes) : null,
  ].filter((notice): notice is string => notice !== null);
  return {
    text: createdMessage(
      {
        title: saved.title,
        // "Tomorrow · Oct 2" reads as two parts of the line's own "·" list.
        dateLabel: formatWhenDate(saved.date, today).replace(" · ", ", "),
        time: time ?? null,
        durationMinutes: saved.durationMinutes,
        repeatLabel: repeatLabel(
          saved.repeatFrequency,
          saved.repeatDaysOfWeek,
          saved.date,
          today,
          time ?? null,
        ),
      },
      notices,
    ),
    buttons: createdButtons({
      id: taskId,
      appUrl: env.AUTH_URL,
      time: time ?? null,
      recurring: saved.repeatFrequency !== "NONE",
    }),
  };
}

function repeatLabel(
  repeat: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY",
  repeatDays: number[],
  date: string,
  today: string,
  time: string | null,
): string | null {
  if (repeat === "NONE") return null;
  if (repeat === "WEEKLY") {
    return `Every ${repeatDays.map((day) => WEEKDAYS[day - 1]).join(", ")}`;
  }
  return repeat === "DAILY"
    ? "Every day"
    : (repeatHint(repeat, date, today, time) ?? "Every month");
}

async function pressButton(user: User, press: Button, now: Date) {
  const { chatId, callbackId, messageId, messageText, action, id } = press;
  try {
    switch (action) {
      case "done":
      case "skip":
      case "remove": {
        const occurrence = await (action === "done"
          ? occurrenceService.completeOccurrence(user.id, id)
          : action === "skip"
            ? occurrenceService.skipOccurrence(user.id, id)
            : occurrenceService.removeOccurrence(user.id, id));
        revalidateAfterChange(occurrence.taskId);
        await editTelegramMessage(
          chatId,
          messageId,
          buttonResultMessage(messageText, { action }),
        );
        break;
      }
      case "snooze15": {
        const occurrence = await runInTransaction((tx) =>
          notificationService.snoozeOccurrence(
            user.id,
            id,
            "15m",
            user.timezone,
            tx,
            now,
          ),
        );
        revalidateAfterChange(occurrence.taskId);
        await editTelegramMessage(
          chatId,
          messageId,
          buttonResultMessage(messageText, {
            action: "snooze15",
            until: formatTimeInZone(addMinutes(now, 15), user.timezone),
          }),
        );
        break;
      }
      case "undo": {
        const task = await taskService.getTask(user.id, id);
        if (!task) throw new TaskNotFoundError(id);
        if (!canFixCreatedTask(task, now)) {
          await answerTelegramButton(callbackId, TOO_LATE_TO_UNDO_MESSAGE);
          return;
        }
        await taskService.deleteTask(user.id, id);
        revalidateAfterChange(id);
        await editTelegramMessage(
          chatId,
          messageId,
          buttonResultMessage(messageText, { action: "undo" }),
        );
        break;
      }
      case "sdone": {
        // п.19 — Done from the morning summary: mark it, then redraw the
        // summary as it now stands (✓ in the list, no button for it).
        const occurrence = await occurrenceService.completeOccurrence(
          user.id,
          id,
        );
        revalidateAfterChange(occurrence.taskId);
        const summary = await buildSummary(user, now);
        if (summary) {
          await editTelegramMessage(
            chatId,
            messageId,
            summary.text,
            summary.buttons,
          );
        }
        break;
      }
      case "later1h":
      case "tomorrow": {
        // п.15 — the same window as Undo, then the task as the edit form
        // would save it with only the time or the date moved.
        const task = await taskService.getTask(user.id, id);
        if (!task) throw new TaskNotFoundError(id);
        if (!canFixCreatedTask(task, now)) {
          await answerTelegramButton(callbackId, TOO_LATE_TO_CHANGE_MESSAGE);
          return;
        }
        const start =
          pickCurrentOccurrence(task.occurrences, now)?.scheduledStart ?? now;
        const input = shiftedTaskInput(
          editTaskValues(task, {
            date: formatDateInZone(start, user.timezone, "yyyy-LL-dd"),
            time: formatTimeInZone(start, user.timezone),
          }),
          action,
        );
        if (!input) {
          await answerTelegramButton(callbackId, ALREADY_CLOSED_MESSAGE);
          return;
        }
        try {
          await taskService.updateTask(user.id, id, user.timezone, input);
        } catch (error) {
          if (error instanceof TaskValidationError) {
            await answerTelegramButton(callbackId, error.message);
            return;
          }
          throw error;
        }
        revalidateAfterChange(id);
        const reply = await createdReply(user, id, input, now);
        await editTelegramMessage(chatId, messageId, reply.text, reply.buttons);
        break;
      }
    }
  } catch (error) {
    if (isClosedError(error)) {
      await answerTelegramButton(callbackId, ALREADY_CLOSED_MESSAGE);
      return;
    }
    await answerTelegramButton(callbackId).catch(() => {});
    throw error;
  }
  await answerTelegramButton(callbackId);
}
