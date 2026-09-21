import "server-only";
import { env } from "@/lib/env";

// Plain `fetch` against the Telegram Bot API — same approach as
// lib/email/send-email.ts takes with Resend, for the same reason: one call
// site doesn't justify pulling in a full SDK.
export async function sendTelegramMessage(
  chatId: string,
  text: string,
): Promise<void> {
  const res = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    },
  );
  if (!res.ok) {
    throw new Error(`Telegram error (${res.status}): ${await res.text()}`);
  }
}
