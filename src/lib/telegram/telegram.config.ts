import "server-only";
import { env } from "@/lib/env";

// All three env vars are required together (sprint-10-tasks.md
// "Расхождения" п.3) — a partial setup (e.g. a token but no username, so
// /settings would have nothing to link to) isn't a supported state.
export function isTelegramEnabled(): boolean {
  return Boolean(
    env.TELEGRAM_BOT_TOKEN &&
    env.TELEGRAM_WEBHOOK_SECRET &&
    env.TELEGRAM_BOT_USERNAME,
  );
}
