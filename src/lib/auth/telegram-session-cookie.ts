// sprint-16-tasks.md S16-02 — the session cookie a Mini App sign-in sets.
// Same name Auth.js reads (lib/utils/cookie.js `defaultCookies`: the
// `__Secure-` prefix on https), so auth() and proxy.ts see it as an ordinary
// session. SameSite=None on https so Telegram Web, where the Mini App is an
// iframe, can send it at all ("Расхождения" п.5); http (local dev) can't
// have None, so it stays Lax there.
export function telegramSessionCookie(
  sessionToken: string,
  expires: Date,
  { secure }: { secure: boolean },
) {
  return {
    name: secure ? "__Secure-authjs.session-token" : "authjs.session-token",
    value: sessionToken,
    options: {
      httpOnly: true,
      path: "/",
      secure,
      sameSite: secure ? ("none" as const) : ("lax" as const),
      expires,
    },
  };
}

/**
 * Where to go after signing in: only a path on this site. Anything else —
 * missing, absolute, protocol-relative (`//evil.com`), or a backslash trick
 * browsers treat like `//` — falls back to Home.
 */
export function safeCallbackPath(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\")
  ) {
    return "/dashboard";
  }
  return value;
}
