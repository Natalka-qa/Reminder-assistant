import { env } from "@/lib/env";
import { isTelegramEnabled } from "@/lib/telegram/telegram.config";
import { parseUpdate, type TelegramUpdate } from "@/lib/telegram/parse-update";
import { telegramBotService } from "@/features/telegram/telegram-bot.service";

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

  // Always resolves to 200 below, even for a malformed body, an update
  // this bot has nothing to say to, or a failure while answering —
  // Telegram retries the update on anything else, and a retry would do
  // the same thing again (sprint-15-tasks.md Sprint DoD).
  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return Response.json({ ok: true });
  }

  const parsed = parseUpdate(update);
  if (!parsed) {
    return Response.json({ ok: true });
  }

  try {
    await telegramBotService.handleUpdate(parsed);
  } catch (error) {
    console.error("telegram webhook failed:", error);
  }

  return Response.json({ ok: true });
}
