import { createHmac, timingSafeEqual } from "node:crypto";

// Checks the `initData` string Telegram hands a Mini App, following
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// (sprint-16-tasks.md "Расхождения" п.1, п.3). Pure: the bot token and the
// clock come in as arguments, so tests sign their own strings.

export type InitDataResult =
  | { ok: true; telegramUserId: number; authDate: Date }
  | { ok: false; reason: InitDataFailure };

export type InitDataFailure =
  | "missing-hash"
  | "bad-hash"
  | "missing-auth-date"
  | "expired"
  | "from-future"
  | "bad-user";

export type VerifyInitDataOptions = {
  botToken: string;
  now: Date;
  /** How old `auth_date` may be — 1 hour in production (п.3). */
  maxAgeSeconds: number;
};

// A phone clock a little ahead of the server's shouldn't lock anyone out.
const FUTURE_SKEW_SECONDS = 60;

export function verifyInitData(
  raw: string,
  { botToken, now, maxAgeSeconds }: VerifyInitDataOptions,
): InitDataResult {
  const params = new URLSearchParams(raw);
  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "missing-hash" };
  params.delete("hash");

  if (!hashMatches(hash, signInitData(params, botToken))) {
    return { ok: false, reason: "bad-hash" };
  }

  const authDateSeconds = Number(params.get("auth_date"));
  if (!Number.isInteger(authDateSeconds) || authDateSeconds <= 0) {
    return { ok: false, reason: "missing-auth-date" };
  }
  const ageSeconds = now.getTime() / 1000 - authDateSeconds;
  if (ageSeconds > maxAgeSeconds) return { ok: false, reason: "expired" };
  if (ageSeconds < -FUTURE_SKEW_SECONDS) {
    return { ok: false, reason: "from-future" };
  }

  const telegramUserId = readUserId(params.get("user"));
  if (telegramUserId === null) return { ok: false, reason: "bad-user" };

  return {
    ok: true,
    telegramUserId,
    authDate: new Date(authDateSeconds * 1000),
  };
}

/**
 * The hex HMAC Telegram puts in `hash`: every field except `hash`, sorted by
 * key, `key=value` joined by "\n", signed with HMAC-SHA256("WebAppData",
 * botToken) as the key. Exported so tests and the local check script
 * (п.12) can produce valid strings.
 */
export function signInitData(
  params: URLSearchParams,
  botToken: string,
): string {
  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  return createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
}

function hashMatches(received: string, expected: string): boolean {
  const a = Buffer.from(received, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function readUserId(userJson: string | null): number | null {
  if (!userJson) return null;
  try {
    const user: unknown = JSON.parse(userJson);
    if (typeof user !== "object" || user === null) return null;
    const id = (user as { id?: unknown }).id;
    return typeof id === "number" && Number.isSafeInteger(id) && id > 0
      ? id
      : null;
  } catch {
    return null;
  }
}
