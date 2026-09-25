import { GOOGLE_CALENDAR_FREEBUSY_SCOPE } from "@/lib/google-calendar/google-calendar.config";

// The calendar connection's pure parts (sprint-11-tasks.md S11-02, S11-03),
// kept out of google-calendar.service.ts so they're unit-testable without a
// database (S11-09).

// Refresh this long before the stored expiry, not at it, so a token that's
// still valid when read can't expire on its way to freeBusy.
export const TOKEN_REFRESH_MARGIN_SECONDS = 60;

/**
 * Whether the stored access token has to be refreshed before use. No known
 * expiry counts as expired.
 */
export function needsTokenRefresh(
  expiresAtSeconds: number | null,
  now = new Date(),
): boolean {
  if (expiresAtSeconds === null) {
    return true;
  }
  return (
    expiresAtSeconds * 1000 - now.getTime() <=
    TOKEN_REFRESH_MARGIN_SECONDS * 1000
  );
}

/**
 * `Account.scope` is Google's space-separated list of what the user actually
 * granted. With granular consent they can untick the calendar box even though
 * we asked for it, so a linked account alone doesn't mean calendar access.
 */
export function hasFreeBusyScope(scope: string | null): boolean {
  return scope?.split(" ").includes(GOOGLE_CALENDAR_FREEBUSY_SCOPE) ?? false;
}

export type GoogleCalendarConnectionStatus =
  | "connected"
  // An Account row that can't be used — calendar access not granted, or no
  // refresh token to keep it working past the first hour. Needs Connect again.
  | "needs-reconnect"
  | "not-connected";

export function connectionStatusFor(
  account: { scope: string | null; refresh_token: string | null } | null,
): GoogleCalendarConnectionStatus {
  if (!account) {
    return "not-connected";
  }
  return hasFreeBusyScope(account.scope) && account.refresh_token
    ? "connected"
    : "needs-reconnect";
}
