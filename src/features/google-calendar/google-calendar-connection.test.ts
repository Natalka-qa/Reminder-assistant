import { describe, expect, it } from "vitest";
import {
  TOKEN_REFRESH_MARGIN_SECONDS,
  connectionStatusFor,
  hasFreeBusyScope,
  needsTokenRefresh,
} from "./google-calendar-connection";

const FREEBUSY = "https://www.googleapis.com/auth/calendar.freebusy";
const now = new Date("2026-09-24T12:00:00Z");
const nowSeconds = now.getTime() / 1000;

describe("needsTokenRefresh", () => {
  it("keeps a token that expires more than 60 seconds from now", () => {
    expect(TOKEN_REFRESH_MARGIN_SECONDS).toBe(60);
    expect(needsTokenRefresh(nowSeconds + 61, now)).toBe(false);
    expect(needsTokenRefresh(nowSeconds + 3599, now)).toBe(false);
  });

  it("refreshes at exactly 60 seconds, and anything closer", () => {
    expect(needsTokenRefresh(nowSeconds + 60, now)).toBe(true);
    expect(needsTokenRefresh(nowSeconds + 1, now)).toBe(true);
  });

  it("refreshes a token that has already expired", () => {
    expect(needsTokenRefresh(nowSeconds, now)).toBe(true);
    expect(needsTokenRefresh(nowSeconds - 3600, now)).toBe(true);
  });

  it("refreshes when the expiry isn't known", () => {
    expect(needsTokenRefresh(null, now)).toBe(true);
  });
});

describe("hasFreeBusyScope", () => {
  it("finds the scope in Google's space-separated list", () => {
    expect(
      hasFreeBusyScope(
        `openid ${FREEBUSY} https://www.googleapis.com/auth/userinfo.email`,
      ),
    ).toBe(true);
  });

  it("fails when the user unticked the calendar box", () => {
    expect(
      hasFreeBusyScope(
        "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile",
      ),
    ).toBe(false);
  });

  it("doesn't take a broader-looking scope for this one", () => {
    expect(
      hasFreeBusyScope("https://www.googleapis.com/auth/calendar.events"),
    ).toBe(false);
    expect(hasFreeBusyScope(`${FREEBUSY}.extra`)).toBe(false);
  });

  it("fails with no scope recorded", () => {
    expect(hasFreeBusyScope(null)).toBe(false);
    expect(hasFreeBusyScope("")).toBe(false);
  });
});

describe("connectionStatusFor", () => {
  it("is not connected without an account row", () => {
    expect(connectionStatusFor(null)).toBe("not-connected");
  });

  it("is connected with the calendar scope and a refresh token", () => {
    expect(
      connectionStatusFor({ scope: `openid ${FREEBUSY}`, refresh_token: "r" }),
    ).toBe("connected");
  });

  it("needs a reconnect when calendar access wasn't granted", () => {
    expect(connectionStatusFor({ scope: "openid", refresh_token: "r" })).toBe(
      "needs-reconnect",
    );
  });

  it("needs a reconnect without a refresh token", () => {
    expect(
      connectionStatusFor({ scope: `openid ${FREEBUSY}`, refresh_token: null }),
    ).toBe("needs-reconnect");
  });
});
