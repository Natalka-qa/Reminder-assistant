import { randomBytes } from "node:crypto";

// The Telegram link code's pure parts (sprint-10-tasks.md S10-04), kept out
// of user.service.ts so they're unit-testable without a database (S10-08).

// 10 minutes — short enough that a leaked/guessed code is a narrow window,
// long enough that opening the Telegram deep link isn't a race (sprint-10-
// tasks.md "Расхождения" п.2).
export const TELEGRAM_LINK_CODE_TTL_MINUTES = 10;

export function createTelegramLinkCode(now = new Date()): {
  code: string;
  expiresAt: Date;
} {
  return {
    // 8 hex chars — short enough to show on /settings, and Telegram's own
    // /start payload only allows [A-Za-z0-9_-], which hex is safely within.
    code: randomBytes(4).toString("hex"),
    expiresAt: new Date(
      now.getTime() + TELEGRAM_LINK_CODE_TTL_MINUTES * 60_000,
    ),
  };
}

/**
 * Whether a stored code can still link an account. No expiry means no
 * pending code (it's cleared on use), so that never passes either.
 */
export function isTelegramLinkCodeActive(
  expiresAt: Date | null,
  now = new Date(),
): boolean {
  return expiresAt !== null && expiresAt >= now;
}
