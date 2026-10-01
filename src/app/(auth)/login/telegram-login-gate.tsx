"use client";

import { useEffect } from "react";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  TELEGRAM_WEB_APP_SCRIPT,
  notifyTelegramScriptLoaded,
  useTelegramWebApp,
} from "@/lib/telegram/web-app";

// sprint-16-tasks.md S16-04 ("Расхождения" п.7). Google refuses embedded
// browsers and an email link opens outside Telegram, so inside the Mini App
// /login doesn't offer them: it signs in through /telegram instead. Right
// after Sign out (`signedOut`) it waits for a tap — signing straight back
// in would make Sign out do nothing. Outside Telegram: `children`, the
// usual methods.
export function TelegramLoginGate({
  callbackUrl,
  signedOut,
  children,
}: {
  callbackUrl: string;
  signedOut: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const webApp = useTelegramWebApp();
  const inside = Boolean(webApp?.initData);
  const telegramHref = `/telegram?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  useEffect(() => {
    if (inside && !signedOut) router.replace(telegramHref);
  }, [inside, signedOut, telegramHref, router]);

  return (
    <>
      <Script
        src={TELEGRAM_WEB_APP_SCRIPT}
        onReady={notifyTelegramScriptLoaded}
      />
      {!inside ? (
        children
      ) : signedOut ? (
        <div className="flex flex-col gap-4">
          <p className="text-text-secondary text-[15px] leading-[1.65]">
            You&apos;re signed out.
          </p>
          <Button
            render={<Link href={telegramHref} />}
            nativeButton={false}
            className="h-[52px] w-full"
          >
            Sign in with Telegram
          </Button>
        </div>
      ) : (
        <p className="text-text-secondary text-[15px] leading-[1.65]">
          Signing you in…
        </p>
      )}
    </>
  );
}
