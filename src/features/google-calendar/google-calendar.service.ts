import { googleCalendarRepository } from "@/features/google-calendar/google-calendar.repository";
import {
  connectionStatusFor,
  hasFreeBusyScope,
  needsTokenRefresh,
  type GoogleCalendarConnectionStatus,
} from "@/features/google-calendar/google-calendar-connection";
import {
  refreshAccessToken,
  type TokenRefreshResult,
} from "@/lib/google-calendar/refresh-access-token";
import { revokeToken } from "@/lib/google-calendar/revoke-token";
import {
  queryFreeBusy,
  type BusyInterval,
} from "@/lib/google-calendar/query-free-busy";

export type AccessTokenResult =
  | { status: "ok"; accessToken: string }
  | { status: "not-connected" }
  // Google didn't answer usefully (network, timeout, outage). The connection
  // itself is kept; this one check just can't happen.
  | { status: "unavailable" };

export type BusyIntervalsResult =
  | { status: "ok"; busy: BusyInterval[] }
  | { status: "not-connected" }
  | { status: "unavailable" };

export const googleCalendarService = {
  async getConnectionStatus(
    userId: string,
  ): Promise<GoogleCalendarConnectionStatus> {
    return connectionStatusFor(
      await googleCalendarRepository.findAccount(userId),
    );
  },

  // Explicit result, not an exception — an expired or revoked connection is
  // an expected outcome, not a bug (same principle as userService
  // .linkTelegramFromCode).
  async getAccessToken(
    userId: string,
    { forceRefresh = false } = {},
  ): Promise<AccessTokenResult> {
    const account = await googleCalendarRepository.findAccount(userId);
    if (!account?.refresh_token || !hasFreeBusyScope(account.scope)) {
      return { status: "not-connected" };
    }
    if (
      !forceRefresh &&
      account.access_token &&
      !needsTokenRefresh(account.expires_at)
    ) {
      return { status: "ok", accessToken: account.access_token };
    }

    let refreshed: TokenRefreshResult;
    try {
      refreshed = await refreshAccessToken(account.refresh_token);
    } catch {
      return { status: "unavailable" };
    }

    switch (refreshed.status) {
      case "revoked":
        // Nothing left to retry with — drop the row so /settings shows
        // "not connected" and conflict checks stop asking Google (S11-03).
        await googleCalendarRepository.deleteAccounts(userId);
        return { status: "not-connected" };
      case "failed":
        return { status: "unavailable" };
      case "refreshed":
        await googleCalendarRepository.updateTokens(account.id, refreshed);
        return { status: "ok", accessToken: refreshed.accessToken };
    }
  },

  // Never throws — whatever goes wrong with Google (or with reading the
  // tokens), the caller saves the task without this check ("Расхождения"
  // п.6, S11-04).
  async getBusyIntervals(
    userId: string,
    timeMin: Date,
    timeMax: Date,
  ): Promise<BusyIntervalsResult> {
    try {
      let token = await googleCalendarService.getAccessToken(userId);
      if (token.status !== "ok") {
        return token;
      }
      let result = await queryFreeBusy(token.accessToken, timeMin, timeMax);
      if (result.status === "unauthorized") {
        // Access revoked at Google within the token's hour: one forced
        // refresh turns that into "not connected" (invalid_grant) instead
        // of failing every check until the stored expiry passes.
        token = await googleCalendarService.getAccessToken(userId, {
          forceRefresh: true,
        });
        if (token.status !== "ok") {
          return token;
        }
        result = await queryFreeBusy(token.accessToken, timeMin, timeMax);
      }
      if (result.status !== "ok") {
        console.error(`google calendar freeBusy failed: ${result.status}`);
        return { status: "unavailable" };
      }
      return result;
    } catch (error) {
      console.error("google calendar freeBusy failed:", error);
      return { status: "unavailable" };
    }
  },

  // Auth.js leaves an already-linked account's row untouched on a repeat
  // connect (sprint-11-tasks.md audit), so a row that can't be used has to
  // go first, or "Connect" would never produce a working one. False when
  // the user is already connected and there's nothing to do.
  async prepareConnect(userId: string): Promise<boolean> {
    const status = await googleCalendarService.getConnectionStatus(userId);
    if (status === "connected") {
      return false;
    }
    if (status === "needs-reconnect") {
      await googleCalendarRepository.deleteAccounts(userId);
    }
    return true;
  },

  // Revoking at Google is best-effort (S11-08): if Google is down or the
  // token is already dead, the row still goes, so conflict checks stop
  // asking Google either way.
  async disconnect(userId: string): Promise<void> {
    const account = await googleCalendarRepository.findAccount(userId);
    const token = account?.refresh_token ?? account?.access_token;
    if (token) {
      await revokeToken(token).catch(() => {});
    }
    await googleCalendarRepository.deleteAccounts(userId);
  },
};
