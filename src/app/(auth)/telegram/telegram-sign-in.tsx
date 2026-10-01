"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  TELEGRAM_WEB_APP_SCRIPT,
  notifyTelegramScriptLoaded,
  useTelegramWebApp,
} from "@/lib/telegram/web-app";

type Outcome = "signing-in" | "not-linked" | "error";

// The four outcomes in S16-03: signed in (→ callbackUrl), not linked,
// opened outside Telegram, or a failed request.
export function TelegramSignIn({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const webApp = useTelegramWebApp();
  const [outcome, setOutcome] = useState<Outcome>("signing-in");
  const [scriptFailed, setScriptFailed] = useState(false);
  // One POST per page load — React's dev double-run would otherwise create
  // two sessions.
  const started = useRef(false);

  const initData = webApp?.initData ?? "";

  useEffect(() => {
    if (!webApp || started.current) return;
    started.current = true;
    webApp.ready();
    webApp.expand();
    if (!initData) return;

    fetch("/api/telegram/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
    })
      .then(async (response) => {
        if (response.ok) {
          router.replace(callbackUrl);
          return;
        }
        const body: { reason?: string } = await response
          .json()
          .catch(() => ({}));
        setOutcome(body.reason === "not-linked" ? "not-linked" : "error");
      })
      .catch(() => setOutcome("error"));
  }, [webApp, initData, callbackUrl, router]);

  // The script itself didn't load: inside Telegram (its data is in the
  // hash) that's an error; in a plain browser it's just "not in Telegram".
  const insideTelegramHash =
    typeof window !== "undefined" &&
    window.location.hash.includes("tgWebAppData");
  const outside =
    (webApp && !initData) || (scriptFailed && !insideTelegramHash);
  const failed = outcome === "error" || (scriptFailed && insideTelegramHash);

  let content: React.ReactNode;
  if (outside) {
    content = (
      <>
        <Heading>Open this page from the bot in Telegram</Heading>
        <Body>Here, sign in the usual way instead.</Body>
        <Button
          render={<Link href="/login" />}
          nativeButton={false}
          className="h-[52px] w-full"
        >
          Go to sign in
        </Button>
      </>
    );
  } else if (failed) {
    content = (
      <>
        <Heading>Couldn&apos;t sign you in</Heading>
        <Body>Close the app and open it again from the bot.</Body>
      </>
    );
  } else if (outcome === "not-linked") {
    content = (
      <>
        <Heading>Connect this Telegram account first</Heading>
        <Body>
          Sign in in your browser, open Settings and press Connect in the
          Telegram block. Then open the app here again.
        </Body>
        <Button
          className="h-[52px] w-full"
          onClick={() =>
            webApp?.openLink(new URL("/settings", window.location.href).href)
          }
        >
          Open Settings in the browser
        </Button>
      </>
    );
  } else {
    content = <Body>Signing you in…</Body>;
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <Script
        src={TELEGRAM_WEB_APP_SCRIPT}
        onReady={notifyTelegramScriptLoaded}
        onError={() => setScriptFailed(true)}
      />
      <div
        role="status"
        aria-live="polite"
        className="flex w-full max-w-[380px] flex-col gap-4"
      >
        {content}
      </div>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="font-display text-[34px] leading-[1.1] font-light">
      {children}
    </h1>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-text-secondary text-[15px] leading-[1.65]">{children}</p>
  );
}
