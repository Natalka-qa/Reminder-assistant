import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { isTelegramEnabled } from "@/lib/telegram/telegram.config";
import { verifyInitData } from "@/lib/telegram/init-data";
import { telegramSessionCookie } from "@/lib/auth/telegram-session-cookie";
import { userService } from "@/features/user/user.service";

// sprint-16-tasks.md S16-02 — the Mini App's sign-in. The page at /telegram
// posts the initData Telegram gave it; a valid string for a linked chat
// gets an ordinary Auth.js session. 401 says nothing about *why* a string
// was refused.
const MAX_AGE_SECONDS = 60 * 60; // "Расхождения" п.3

export async function POST(request: Request) {
  if (!isTelegramEnabled() || !env.TELEGRAM_BOT_TOKEN) {
    return Response.json({ reason: "disabled" }, { status: 404 });
  }

  const body: unknown = await request.json().catch(() => null);
  const initData =
    typeof body === "object" && body !== null && "initData" in body
      ? body.initData
      : undefined;
  if (typeof initData !== "string") {
    return Response.json({ reason: "invalid" }, { status: 400 });
  }

  const verified = verifyInitData(initData, {
    botToken: env.TELEGRAM_BOT_TOKEN,
    now: new Date(),
    maxAgeSeconds: MAX_AGE_SECONDS,
  });
  if (!verified.ok) {
    return Response.json({ reason: "invalid" }, { status: 401 });
  }

  const session = await userService.startTelegramSession(
    verified.telegramUserId,
  );
  if (!session) {
    return Response.json({ reason: "not-linked" }, { status: 404 });
  }

  // Same rule Auth.js uses for its own cookie names (init.js: the request
  // URL's protocol).
  const secure = new URL(request.url).protocol === "https:";
  const cookie = telegramSessionCookie(session.sessionToken, session.expires, {
    secure,
  });
  (await cookies()).set(cookie.name, cookie.value, cookie.options);

  return Response.json({ ok: true });
}
