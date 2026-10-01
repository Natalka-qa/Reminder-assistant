import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { safeCallbackPath } from "@/lib/auth/telegram-session-cookie";
import { TelegramSignIn } from "./telegram-sign-in";

// sprint-16-tasks.md S16-03 — where the Mini App opens (the bot's menu
// button and Open buttons). Public: proxy.ts doesn't guard it. Already
// signed in (an earlier open left the cookie) → straight on, no new session.
export default async function TelegramPage({
  searchParams,
}: PageProps<"/telegram">) {
  const { callbackUrl } = await searchParams;
  const destination = safeCallbackPath(callbackUrl);

  const session = await auth();
  if (session?.user) {
    redirect(destination);
  }

  return <TelegramSignIn callbackUrl={destination} />;
}
