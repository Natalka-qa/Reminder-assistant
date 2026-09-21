import { env } from "@/lib/env";
import { isTelegramEnabled } from "@/lib/telegram/telegram.config";
import {
  parseStartCommand,
  type TelegramUpdate,
} from "@/lib/telegram/parse-start-command";
import { sendTelegramMessage } from "@/lib/telegram/send-telegram-message";
import { userService } from "@/features/user/user.service";

// Telegram calls this directly (registered once via `setWebhook`, see
// README — sprint-10-tasks.md "Расхождения" п.5), not a Vercel Cron
// endpoint like /api/cron/*. Auth is Telegram's own mechanism for this
// exact purpose: the shared secret set at registration comes back on every
// call in this header, instead of the Authorization-bearer pattern the
// cron routes use.
export async function POST(request: Request) {
  if (!isTelegramEnabled()) {
    return new Response("Not configured", { status: 404 });
  }

  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Always resolves to 200 below, even for a malformed body or a command
  // this bot doesn't understand — Telegram retries the update on anything
  // else, and there's nothing useful to retry here (sprint-10-tasks.md
  // Sprint DoD).
  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return Response.json({ ok: true });
  }

  const command = parseStartCommand(update);
  if (!command) {
    return Response.json({ ok: true });
  }

  try {
    const linked = await userService.linkTelegramFromCode(
      command.code,
      command.chatId,
    );
    await sendTelegramMessage(
      command.chatId,
      linked
        ? "✓ Connected! You'll get reminders here."
        : "That code isn't valid or has expired — generate a new one from Settings.",
    );
  } catch (error) {
    console.error("telegram webhook failed:", error);
  }

  return Response.json({ ok: true });
}
