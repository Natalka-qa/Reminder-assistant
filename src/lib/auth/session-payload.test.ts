import { describe, expect, it } from "vitest";
import { toSessionPayload } from "./session-payload";

// The shapes Auth.js passes the session callback in database mode:
// `session` is the adapter's Session row spread together with `user`, and
// `user` is the whole User row.
const userRow = {
  id: "user-1",
  name: "Natalia",
  email: "natalia@example.com",
  emailVerified: new Date("2026-09-23T13:17:13Z"),
  image: "https://lh3.googleusercontent.com/a/avatar",
  timezone: "Europe/Madrid",
  timezoneConfirmedAt: new Date("2026-09-21T15:28:33Z"),
  telegramChatId: "123456",
  telegramLinkCode: "953103d9",
  telegramLinkCodeExpiresAt: new Date("2026-09-23T08:05:51Z"),
  createdAt: new Date("2026-09-16T19:45:59Z"),
  updatedAt: new Date("2026-09-23T13:17:13Z"),
};
const sessionRow = {
  id: "session-1",
  sessionToken: "16f19b02-secret",
  userId: "user-1",
  expires: new Date("2026-10-23T13:17:14.004Z"),
  user: userRow,
};

describe("toSessionPayload", () => {
  const payload = toSessionPayload(sessionRow.expires, userRow);

  it("keeps only expires and the user fields the app reads", () => {
    expect(payload).toEqual({
      expires: "2026-10-23T13:17:14.004Z",
      user: {
        id: "user-1",
        name: "Natalia",
        email: "natalia@example.com",
        image: "https://lh3.googleusercontent.com/a/avatar",
        timezone: "Europe/Madrid",
      },
    });
  });

  it("never carries the session token, session id or other User columns", () => {
    const json = JSON.stringify(payload);
    for (const leaked of [
      "16f19b02-secret",
      "session-1",
      "userId",
      "sessionToken",
      "telegramLinkCode",
      "953103d9",
      "telegramChatId",
      "emailVerified",
    ]) {
      expect(json).not.toContain(leaked);
    }
  });

  it("fills a missing name or image with null, as dal.ts expects", () => {
    expect(
      toSessionPayload("2026-10-23T13:17:14.004Z", {
        id: "user-2",
        email: "someone@example.com",
        name: null,
        image: undefined,
        timezone: "UTC",
      }).user,
    ).toEqual({
      id: "user-2",
      name: null,
      email: "someone@example.com",
      image: null,
      timezone: "UTC",
    });
  });
});
