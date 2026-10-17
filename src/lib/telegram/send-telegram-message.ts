import "server-only";
import { env } from "@/lib/env";
import type { InlineKeyboard, ReplyKeyboard } from "./bot-messages";

// Plain `fetch` against the Telegram Bot API — same approach as
// lib/email/send-email.ts takes with Resend, for the same reason: a few
// call sites don't justify pulling in a full SDK. Plain text, or HTML
// with `{ html: true }` for the day's messages (bot-messages.ts,
// 2026-10-08) — their user text is escaped there.
async function telegramApi(
  method: string,
  body: Record<string, unknown>,
): Promise<void> {
  await telegramResult(method, body);
}

/** The call's `result` — the sent message, the file to download. */
async function telegramResult(
  method: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    throw new Error(`Telegram error (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { result?: unknown };
  return json.result;
}

type Options = { html?: boolean };

function format(options?: Options) {
  return options?.html ? { parse_mode: "HTML" } : {};
}

export function sendTelegramMessage(
  chatId: string,
  text: string,
  replyMarkup?: InlineKeyboard | ReplyKeyboard,
  options?: Options,
): Promise<void> {
  return telegramApi("sendMessage", {
    chat_id: chatId,
    text,
    ...format(options),
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

// sprint-15-tasks.md S15-04 — a button press is answered once, or Telegram
// keeps a spinner on it; `text` shows as a short toast.
export function answerTelegramButton(
  callbackId: string,
  text?: string,
): Promise<void> {
  return telegramApi("answerCallbackQuery", {
    callback_query_id: callbackId,
    ...(text ? { text } : {}),
  });
}

// Rewrites a message the bot sent. Without `replyMarkup` its buttons go —
// what a reminder turns into once one of them is pressed.
export function editTelegramMessage(
  chatId: string,
  messageId: number,
  text: string,
  replyMarkup?: InlineKeyboard,
  options?: Options,
): Promise<void> {
  return telegramApi("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    ...format(options),
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

// 2026-10-13 — only the buttons: the summary's task menu and back, the
// text (HTML) left as it is.
export function editTelegramButtons(
  chatId: string,
  messageId: number,
  replyMarkup: InlineKeyboard,
): Promise<void> {
  return telegramApi("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: replyMarkup,
  });
}

// sprint-24-tasks.md — "Reading the picture…", later edited into the draft:
// the same as sendTelegramMessage, with the sent message's id.
export async function sendTelegramMessageForId(
  chatId: string,
  text: string,
  options?: Options,
): Promise<number> {
  const result = (await telegramResult("sendMessage", {
    chat_id: chatId,
    text,
    ...format(options),
  })) as { message_id: number };
  return result.message_id;
}

/**
 * sprint-24-tasks.md решение 11 — a picture the user sent, into memory
 * only: getFile, then the file itself. Never written anywhere.
 */
export async function downloadTelegramFile(fileId: string): Promise<Buffer> {
  const file = (await telegramResult("getFile", { file_id: fileId })) as {
    file_path?: string;
  };
  if (!file.file_path) throw new Error("Telegram file has no path");
  const res = await fetch(
    `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`,
  );
  if (!res.ok) throw new Error(`Telegram file error (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
