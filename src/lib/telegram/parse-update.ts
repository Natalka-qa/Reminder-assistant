import { parseButtonData, type ButtonAction } from "./button-data";

// Minimal shape of a Telegram Bot API Update — only the fields parseUpdate
// actually reads, not the full API surface.
export type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: { id: number };
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: { message_id: number; chat: { id: number }; text?: string };
  };
};

export type BotCommand = "today" | "next" | "help" | "add";

const COMMANDS: readonly BotCommand[] = ["today", "next", "help", "add"];

export type ParsedUpdate =
  | { kind: "start"; chatId: string; code?: string }
  | { kind: "command"; chatId: string; name: BotCommand; args: string }
  | { kind: "unknown-command"; chatId: string }
  | { kind: "text"; chatId: string; text: string }
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
};

// "/today", "/today@Remindyme_bot", "/add call mom tomorrow".
const COMMAND = /^\/([A-Za-z0-9_]+)(?:@[A-Za-z0-9_]+)?(?:\s+([\s\S]*))?$/;

// Pure — no I/O, so it's unit-testable without a real Telegram payload.
// sprint-15-tasks.md S15-01. Anything this bot has nothing to say to — no
// message, a photo or sticker (no text), blank text, no chat — is null,
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

  const text = update.message?.text?.trim();
  const id = update.message?.chat?.id;
  if (!text || id === undefined) return null;
  const chatId = String(id);

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
