import { parseButtonData, type ButtonAction } from "./button-data";
import { listIdFromUrl } from "./checklist-messages";

// Minimal shape of a Telegram Bot API Update — only the fields parseUpdate
// actually reads, not the full API surface.
export type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: { id: number };
    // sprint-24-tasks.md — a picture: sizes of one photo, smallest first;
    // or a file sent "as a document" (an uncompressed screenshot, a PDF).
    photo?: { file_id: string; file_size?: number }[];
    document?: { file_id: string; mime_type?: string; file_size?: number };
    // sprint-25-tasks.md Q1 — an answer to "Send items for Groceries": the
    // list's name there is a link to it.
    reply_to_message?: {
      from?: { is_bot?: boolean };
      entities?: { type: string; url?: string }[];
    };
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: { message_id: number; chat: { id: number }; text?: string };
  };
};

export type BotCommand = "today" | "next" | "help" | "add" | "lists";

const COMMANDS: readonly BotCommand[] = [
  "today",
  "next",
  "help",
  "add",
  "lists",
];

export type ParsedUpdate =
  | { kind: "start"; chatId: string; code?: string }
  | { kind: "command"; chatId: string; name: BotCommand; args: string }
  | { kind: "unknown-command"; chatId: string }
  | { kind: "text"; chatId: string; text: string }
  /** sprint-25-tasks.md Q1 — items sent in reply to "+ Add items". */
  | { kind: "list-items"; chatId: string; checklistId: string; text: string }
  /** sprint-24-tasks.md — a picture to read a task from (S24-03). */
  | { kind: "picture"; chatId: string; fileId: string }
  /** 2026-11-13 — a PDF ticket, read from its own text. */
  | { kind: "pdf"; chatId: string; fileId: string }
  | {
      kind: "button";
      chatId: string;
      callbackId: string;
      messageId: number;
      /** The pressed message's own text — what its outcome is added to. */
      messageText: string;
      action: ButtonAction;
      id: string;
    }
  // A press whose data isn't ours. Still its own kind, not null: every
  // button press has to be answered (answerCallbackQuery), or Telegram
  // keeps a spinner on it.
  | { kind: "unknown-button"; chatId: string; callbackId: string };

// The persistent keyboard under the input (replyKeyboard, п.14) sends its
// labels as ordinary messages; they're read as the commands they stand
// for, never as a new task called "Today".
const KEYBOARD_COMMANDS: Record<string, BotCommand> = {
  today: "today",
  next: "next",
  lists: "lists",
};

// "/today", "/today@Remindyme_bot", "/add call mom tomorrow".
const COMMAND = /^\/([A-Za-z0-9_]+)(?:@[A-Za-z0-9_]+)?(?:\s+([\s\S]*))?$/;

// Pure — no I/O, so it's unit-testable without a real Telegram payload.
// sprint-15-tasks.md S15-01. Anything this bot has nothing to say to — no
// message, a sticker (no text), blank text, no chat — is null; a photo is
// a picture to read (sprint-24-tasks.md),
// not an error: the webhook route responds 200 either way (Telegram
// retries on non-2xx).
export function parseUpdate(update: TelegramUpdate): ParsedUpdate | null {
  const press = update.callback_query;
  if (press) {
    const chatId = press.message?.chat.id;
    if (chatId === undefined || !press.message) return null;
    const data = parseButtonData(press.data);
    if (!data) {
      return {
        kind: "unknown-button",
        chatId: String(chatId),
        callbackId: press.id,
      };
    }
    return {
      kind: "button",
      chatId: String(chatId),
      callbackId: press.id,
      messageId: press.message.message_id,
      messageText: press.message.text ?? "",
      ...data,
    };
  }

  const id = update.message?.chat?.id;
  if (id === undefined) return null;
  const picture = pictureOf(update.message!);
  if (picture) return { ...picture, chatId: String(id) };

  const text = update.message?.text?.trim();
  if (!text) return null;
  const chatId = String(id);

  const checklistId = replyListId(update.message!);
  if (checklistId) return { kind: "list-items", chatId, checklistId, text };

  const keyboard = KEYBOARD_COMMANDS[text.toLowerCase()];
  if (keyboard) return { kind: "command", chatId, name: keyboard, args: "" };

  const command = COMMAND.exec(text);
  if (!command) return { kind: "text", chatId, text };

  const name = command[1].toLowerCase();
  const args = command[2]?.trim() ?? "";
  if (name === "start") {
    // The deep-link code is one token (telegram-link-code.ts); anything
    // else after /start isn't a code.
    const code = /^\S+$/.test(args) ? args : undefined;
    return code ? { kind: "start", chatId, code } : { kind: "start", chatId };
  }
  const known = COMMANDS.find((candidate) => candidate === name);
  return known
    ? { kind: "command", chatId, name: known, args }
    : { kind: "unknown-command", chatId };
}

/**
 * The list a message answers: a reply to the bot's "Send items for …",
 * whose link to the list (checklist-messages.ts addItemsPrompt) carries
 * its id. Any other reply is an ordinary message.
 */
function replyListId(
  message: NonNullable<TelegramUpdate["message"]>,
): string | null {
  const reply = message.reply_to_message;
  if (!reply?.from?.is_bot) return null;
  for (const entity of reply.entities ?? []) {
    if (entity.type !== "text_link" || !entity.url) continue;
    const id = listIdFromUrl(entity.url);
    if (id) return id;
  }
  return null;
}

/** Telegram's own cap on what a bot may download (getFile) is 20 MB. */
export const PICTURE_MAX_BYTES = 20 * 1024 * 1024;

function pictureOf(
  message: NonNullable<TelegramUpdate["message"]>,
):
  { kind: "picture"; fileId: string } | { kind: "pdf"; fileId: string } | null {
  const largest = message.photo?.at(-1);
  if (largest && (largest.file_size ?? 0) <= PICTURE_MAX_BYTES) {
    return { kind: "picture", fileId: largest.file_id };
  }
  const document = message.document;
  if (!document) return null;
  if (
    document.mime_type === "application/pdf" &&
    (document.file_size ?? 0) <= PICTURE_MAX_BYTES
  ) {
    return { kind: "pdf", fileId: document.file_id };
  }
  if (
    document.mime_type?.startsWith("image/") &&
    (document.file_size ?? 0) <= PICTURE_MAX_BYTES
  ) {
    return { kind: "picture", fileId: document.file_id };
  }
  return null;
}
