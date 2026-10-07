import { formatDuration } from "@/lib/format";
import { buttonData } from "./button-data";

// sprint-15-tasks.md S15-02 — everything the bot says, as plain text (no
// parse_mode, same as buildReminderTelegramMessage, so nothing needs
// escaping). Pure: dates and times arrive already formatted in the user's
// zone, so this module has no Luxon and no clock.

export type InlineButton =
  | { text: string; callback_data: string }
  // Opens the task in the app (п.12) — no round trip through the webhook.
  | { text: string; url: string }
  // The same, inside Telegram as the Mini App (sprint-16-tasks.md S16-06).
  | { text: string; web_app: { url: string } };

export type InlineKeyboard = { inline_keyboard: InlineButton[][] };

export type ReplyKeyboard = {
  keyboard: { text: string }[][];
  resize_keyboard: true;
  is_persistent: true;
};

export type DayItemStatus = "open" | "done" | "partial" | "skipped";

export type DayItem = {
  /** "18:00", or null for a flexible task with no time of its own. */
  time: string | null;
  title: string;
  durationMinutes: number;
  status: DayItemStatus;
};

const STATUS_MARK: Record<DayItemStatus, string> = {
  open: "",
  done: "✓ ",
  partial: "◐ ",
  skipped: "· skipped · ",
};

function dayLine(item: DayItem): string {
  const duration =
    item.durationMinutes > 0
      ? ` · ${formatDuration(item.durationMinutes)}`
      : "";
  return `${STATUS_MARK[item.status]}${item.time ?? "Anytime"} · ${item.title}${duration}`;
}

function overdueLine(count: number): string {
  return count === 1 ? "1 overdue task" : `${count} overdue tasks`;
}

/** `/today` — "Today · Wed, Sep 30", then one line per task. */
export function todayMessage(
  dateLabel: string,
  items: DayItem[],
  overdueCount: number,
): string {
  const lines = [`Today · ${dateLabel}`];
  if (overdueCount > 0) lines.push(overdueLine(overdueCount));
  lines.push("");
  lines.push(
    items.length > 0
      ? items.map(dayLine).join("\n")
      : "Nothing planned for today.",
  );
  return lines.join("\n");
}

/** `/next` — the nearest open task, or that the day is clear. */
export function nextMessage(item: DayItem | null): string {
  return item ? `Up next\n\n${dayLine(item)}` : "Nothing left for today.";
}

/**
 * Reply to a task added from a message: "Added: Call mom · Thu, Oct 1 ·
 * 18:00", then the same notices the New task form shows (overlapNotice,
 * pastNotice), one per line.
 */
export function createdMessage(
  created: {
    title: string;
    dateLabel: string;
    time: string | null;
    durationMinutes: number;
    repeatLabel: string | null;
  },
  notices: string[],
): string {
  const parts = [created.title, created.dateLabel, created.time ?? "Anytime"];
  if (created.durationMinutes > 0) {
    parts.push(formatDuration(created.durationMinutes));
  }
  if (created.repeatLabel) parts.push(created.repeatLabel);
  return [`Added: ${parts.join(" · ")}`, ...notices].join("\n");
}

/** What a reminder message turns into once one of its buttons is pressed. */
const REMOVED_LINE = "Removed this one";

export function buttonResultMessage(
  original: string,
  result:
    | { action: "done" | "skip" | "remove" | "undo" | "restore" }
    | { action: "snooze15"; until: string },
): string {
  // sprint-19-tasks.md п.8 — Undo under "Removed this one" takes that line
  // back rather than stacking a second one under it.
  if (result.action === "restore") {
    const base = original.endsWith(`\n\n${REMOVED_LINE}`)
      ? original.slice(0, -`\n\n${REMOVED_LINE}`.length)
      : original;
    return `${base}\n\nRestored`;
  }
  const line =
    result.action === "snooze15"
      ? `Snoozed until ${result.until}`
      : {
          done: "✓ Done",
          skip: "Skipped",
          remove: REMOVED_LINE,
          undo: "Removed",
        }[result.action];
  return `${original}\n\n${line}`;
}

export const ALREADY_CLOSED_MESSAGE = "This one is no longer open.";

export const TOO_LATE_TO_UNDO_MESSAGE =
  "Too late to undo — open it in the app.";

export const TOO_LATE_TO_CHANGE_MESSAGE =
  "Too late to change — open it in the app.";

export const NEEDS_SEARCH_MESSAGE =
  "Finding a free time is in the app for now:";

export function helpMessage(): string {
  return [
    "Write a task the way you'd say it — “Call mom tomorrow at 18” — and I'll add it.",
    "",
    "/today — what's planned for today",
    "/next — the next task",
    "/help — this message",
    "",
    "Reminders come with Done, Snooze 15 min and Skip buttons.",
    "Today and Next are also on the keyboard below.",
  ].join("\n");
}

export function unknownCommandMessage(): string {
  return `I don't know that command.\n\n${helpMessage()}`;
}

export function notLinkedMessage(): string {
  return "This chat isn't connected to an account. Connect it from Settings in the app.";
}

/** After /start with a valid link code, the Sprint 10 confirmation. */
export function connectedMessage(): string {
  return `✓ Connected! You'll get reminders here.\n\n${helpMessage()}`;
}

export const INVALID_CODE_MESSAGE =
  "That code isn't valid or has expired — generate a new one from Settings.";

/** /start again in a chat that's already connected. */
export function linkedMessage(): string {
  return `You're connected.\n\n${helpMessage()}`;
}

export const EMPTY_PHRASE_MESSAGE =
  "Write what to add, the way you'd say it — “Call mom tomorrow at 18”.";

export const BUTTON_FAILED_MESSAGE = "Something went wrong — try again.";

/**
 * sprint-16-tasks.md S16-06 ("Расхождения" п.8) — a button that opens
 * `path` of the app: inside Telegram as the Mini App, through /telegram so
 * it's already signed in. Telegram only takes https Mini App URLs, so with
 * an http `appUrl` (local `next dev`) it stays a plain link.
 */
export function openAppButton(
  text: string,
  appUrl: string,
  path: string,
): InlineButton {
  if (!appUrl.startsWith("https://")) return { text, url: `${appUrl}${path}` };
  return {
    text,
    web_app: {
      url: `${appUrl}/telegram?callbackUrl=${encodeURIComponent(path)}`,
    },
  };
}

/**
 * Under a reminder and under `/next`: Done · Snooze 15 min · Skip, then
 * Open — with "Remove this one" in front of it for a repeating task.
 */
export function occurrenceButtons(occurrence: {
  id: string;
  taskId: string;
  /** `AUTH_URL` — where the app is (openAppButton). */
  appUrl: string;
  recurring: boolean;
}): InlineKeyboard {
  const { id, taskId, appUrl, recurring } = occurrence;
  const second: InlineButton[] = recurring
    ? [{ text: "Remove this one", callback_data: buttonData("remove", id) }]
    : [];
  second.push(openAppButton("Open", appUrl, `/tasks/${taskId}`));
  return {
    inline_keyboard: [
      [
        { text: "Done", callback_data: buttonData("done", id) },
        { text: "Snooze 15 min", callback_data: buttonData("snooze15", id) },
        { text: "Skip", callback_data: buttonData("skip", id) },
      ],
      second,
    ],
  };
}

/**
 * Under a task just added from a message: "+1 h · Tomorrow" to fix what
 * the phrase got wrong (п.15), then Undo · Open. +1 h only when the task
 * has a time and an hour later is still the same day; Tomorrow only for a
 * one-off task — a repeating task's date is fixed, as in the edit form.
 */
/**
 * sprint-19-tasks.md п.8 — what "Remove this one" leaves under the message:
 * Undo, for the same 10 minutes as Undo under a new task.
 */
export function removedButtons(occurrenceId: string): InlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: "Undo", callback_data: buttonData("restore", occurrenceId) }],
    ],
  };
}

export function createdButtons(task: {
  id: string;
  /** `AUTH_URL` — where the app is (openAppButton). */
  appUrl: string;
  time: string | null;
  recurring: boolean;
}): InlineKeyboard {
  const fix: InlineButton[] = [];
  if (task.time && task.time < "23:00") {
    fix.push({ text: "+1 h", callback_data: buttonData("later1h", task.id) });
  }
  if (!task.recurring) {
    fix.push({
      text: "Tomorrow",
      callback_data: buttonData("tomorrow", task.id),
    });
  }
  const rows: InlineButton[][] = fix.length > 0 ? [fix] : [];
  rows.push([
    { text: "Undo", callback_data: buttonData("undo", task.id) },
    openAppButton("Open", task.appUrl, `/tasks/${task.id}`),
  ]);
  return { inline_keyboard: rows };
}

// sprint-21-tasks.md п.9 — habits in the morning summary.
export type HabitLineItem = {
  id: string;
  title: string;
  /** Доработка п.2 — what its button does: tick, fill the goal, add a step. */
  mode: "check" | "goal" | "step";
  met: boolean;
  /** "0/2 L" for an amount; null for CHECK. */
  progressLabel: string | null;
  /** "8 h" — today's goal for an amount; null for CHECK. */
  goalAmount: string | null;
  /** "+250 ml" for an amount; null for CHECK. */
  stepLabel: string | null;
};

/**
 * "Daily · 1/3", then a line per habit ("✓ Exercise", "Water 0/2 L"),
 * and the day's good news below (п.8). Null with no habit today.
 * Доработка п.7 — a line each, so 5–7 habits stay readable.
 */
export function habitsSection(
  items: HabitLineItem[],
  praise: string | null,
): string | null {
  if (items.length === 0) return null;
  const done = items.filter((item) => item.met).length;
  const lines = [
    done === items.length
      ? "Daily · all done ✓"
      : `Daily · ${done}/${items.length}`,
    ...items.map(
      (item) =>
        `${item.met ? "✓" : "○"} ${item.title}${item.progressLabel ? ` · ${item.progressLabel}` : ""}`,
    ),
  ];
  if (praise) lines.push("", `🎉 ${praise}`);
  return lines.join("\n");
}

/** п.10 — "Evening check-in", then what's left ("2 habits left today: …"). */
export function habitReminderMessage(left: string): string {
  return `Evening check-in\n\n${left}`;
}

export const HABIT_BUTTONS_MAX = 8;

/**
 * п.9 — two habits a row, the ones not done yet, up to 8: "✓ Exercise",
 * "✓ Sleep 8 h", "Water +250 ml". A press redraws the summary, as ✓ on a
 * task does.
 */
export function habitButtons(items: HabitLineItem[]): InlineButton[][] {
  const buttons: InlineButton[] = items
    .filter((item) => !item.met)
    .slice(0, HABIT_BUTTONS_MAX)
    .map((item) =>
      item.mode === "step"
        ? {
            text: `${item.title} ${item.stepLabel}`,
            callback_data: buttonData("hplus", item.id),
          }
        : {
            text:
              item.mode === "goal"
                ? `✓ ${item.title} ${item.goalAmount}`
                : `✓ ${item.title}`,
            callback_data: buttonData("hdone", item.id),
          },
    );
  const rows: InlineButton[][] = [];
  for (let index = 0; index < buttons.length; index += 2) {
    rows.push(buttons.slice(index, index + 2));
  }
  return rows;
}

export const SUMMARY_BUTTONS_MAX = 8;

/**
 * п.19 — under the morning summary: "✓ 18:00 Gym", one row per task still
 * open, up to 8 (the text above lists the whole day). Done from here
 * redraws the summary rather than adding a line, as a reminder does.
 */
export function summaryButtons(
  open: { id: string; time: string | null; title: string }[],
): InlineKeyboard | undefined {
  if (open.length === 0) return undefined;
  return {
    inline_keyboard: open.slice(0, SUMMARY_BUTTONS_MAX).map((item) => [
      {
        // "✓ Buy groceries" for a task without a time (sprint-18 п.20).
        text: item.time ? `✓ ${item.time} ${item.title}` : `✓ ${item.title}`,
        callback_data: buttonData("sdone", item.id),
      },
    ]),
  };
}

/**
 * п.14 — Today · Next under the message input, kept there by Telegram once
 * sent (with the "connected" and help messages).
 */
export function replyKeyboard(): ReplyKeyboard {
  return {
    keyboard: [[{ text: "Today" }, { text: "Next" }]],
    resize_keyboard: true,
    is_persistent: true,
  };
}
