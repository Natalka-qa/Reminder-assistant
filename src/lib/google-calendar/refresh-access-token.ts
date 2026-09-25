import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";
import { GOOGLE_REQUEST_TIMEOUT_MS } from "@/lib/google-calendar/google-calendar.config";

export type TokenRefreshResult =
  | {
      status: "refreshed";
      accessToken: string;
      // Unix seconds, like Account.expires_at.
      expiresAt: number;
      // Google usually keeps the old refresh token; only set when it rotates.
      refreshToken?: string;
    }
  // The refresh token no longer works — the user revoked access, or Google
  // expired it (Testing mode's 7 days, 6 months unused, the 100-tokens-per-
  // client limit). Only reconnecting helps.
  | { status: "revoked" }
  // Anything else — our misconfiguration (invalid_client), a Google outage,
  // a malformed reply. Not the user's doing, so the connection stays.
  | { status: "failed" };

// Plain `fetch` against Google's OAuth token endpoint — same approach as
// lib/telegram/send-telegram-message.ts, and no `googleapis` SDK for two
// endpoints (sprint-11-tasks.md, audit). Network errors and the timeout
// throw, like sendTelegramMessage's; googleCalendarService turns them into
// "unavailable".
export async function refreshAccessToken(
  refreshToken: string,
): Promise<TokenRefreshResult> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
    signal: AbortSignal.timeout(GOOGLE_REQUEST_TIMEOUT_MS),
  });
  const body: unknown = await res.json().catch(() => null);
  return parseTokenRefreshResponse(res.ok, body);
}

const refreshedSchema = z.object({
  access_token: z.string().min(1),
  // Seconds from now — Google sends 3599.
  expires_in: z.number().positive(),
  refresh_token: z.string().min(1).optional(),
});

const revokedSchema = z.object({ error: z.literal("invalid_grant") });

export function parseTokenRefreshResponse(
  ok: boolean,
  body: unknown,
  now = new Date(),
): TokenRefreshResult {
  if (!ok) {
    return revokedSchema.safeParse(body).success
      ? { status: "revoked" }
      : { status: "failed" };
  }

  const parsed = refreshedSchema.safeParse(body);
  if (!parsed.success) {
    return { status: "failed" };
  }
  return {
    status: "refreshed",
    accessToken: parsed.data.access_token,
    expiresAt: Math.floor(now.getTime() / 1000) + parsed.data.expires_in,
    ...(parsed.data.refresh_token
      ? { refreshToken: parsed.data.refresh_token }
      : {}),
  };
}
