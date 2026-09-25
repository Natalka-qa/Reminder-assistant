import { describe, expect, it } from "vitest";
import { parseTokenRefreshResponse } from "./refresh-access-token";

const now = new Date("2026-09-24T12:00:00Z");
const nowSeconds = now.getTime() / 1000;

describe("parseTokenRefreshResponse", () => {
  it("turns expires_in into an absolute expiry in Unix seconds", () => {
    expect(
      parseTokenRefreshResponse(
        true,
        {
          access_token: "new-access",
          expires_in: 3599,
          scope: "https://www.googleapis.com/auth/calendar.freebusy",
          token_type: "Bearer",
        },
        now,
      ),
    ).toEqual({
      status: "refreshed",
      accessToken: "new-access",
      expiresAt: nowSeconds + 3599,
    });
  });

  it("passes a rotated refresh token along", () => {
    expect(
      parseTokenRefreshResponse(
        true,
        { access_token: "a", expires_in: 3599, refresh_token: "rotated" },
        now,
      ),
    ).toMatchObject({ status: "refreshed", refreshToken: "rotated" });
  });

  it("treats invalid_grant as a revoked connection", () => {
    expect(
      parseTokenRefreshResponse(
        false,
        {
          error: "invalid_grant",
          error_description: "Token has been expired or revoked.",
        },
        now,
      ),
    ).toEqual({ status: "revoked" });
  });

  it("treats any other error as a failure, not a revocation", () => {
    for (const body of [
      { error: "invalid_client", error_description: "Unauthorized" },
      { error: "internal_failure" },
      null,
      "<html>502</html>",
    ]) {
      expect(parseTokenRefreshResponse(false, body, now)).toEqual({
        status: "failed",
      });
    }
  });

  it("treats a success reply without a usable token as a failure", () => {
    for (const body of [
      {},
      { access_token: "", expires_in: 3599 },
      { access_token: "a" },
      { access_token: "a", expires_in: "3599" },
      null,
    ]) {
      expect(parseTokenRefreshResponse(true, body, now)).toEqual({
        status: "failed",
      });
    }
  });
});
