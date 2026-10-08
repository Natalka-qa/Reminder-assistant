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
