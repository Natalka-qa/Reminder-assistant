import type { Session } from "next-auth";

type SessionUser = {
  id: string;
  name?: string | null;
  email: string;
  image?: string | null;
  timezone: string;
};

/**
 * What /api/auth/session and auth() hand out. With database sessions Auth.js
 * calls the session callback with `{ ...adapterSession, user }` — the raw
 * session token, userId and the whole User row (telegramLinkCode included) —
 * and returns whatever the callback returns as JSON to any script on the
 * page (@auth/core lib/actions/session.js). A token readable that way
 * defeats the cookie's httpOnly, so the payload is built field by field:
 * only what lib/auth/dal.ts reads.
 */
export function toSessionPayload(
  expires: Date | string,
  user: SessionUser,
): Session {
  return {
    expires: expires instanceof Date ? expires.toISOString() : expires,
    user: {
      id: user.id,
      name: user.name ?? null,
      email: user.email,
      image: user.image ?? null,
      timezone: user.timezone,
    },
  };
}
