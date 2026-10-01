import { describe, expect, it } from "vitest";
import {
  safeCallbackPath,
  telegramSessionCookie,
} from "./telegram-session-cookie";

const EXPIRES = new Date("2026-10-31T12:00:00Z");

describe("telegramSessionCookie", () => {
  it("uses Auth.js's secure name and SameSite=None on https", () => {
    expect(telegramSessionCookie("tok", EXPIRES, { secure: true })).toEqual({
      name: "__Secure-authjs.session-token",
      value: "tok",
      options: {
        httpOnly: true,
        path: "/",
        secure: true,
        sameSite: "none",
        expires: EXPIRES,
      },
    });
  });

  it("falls back to the plain name and Lax on http", () => {
    const cookie = telegramSessionCookie("tok", EXPIRES, { secure: false });
    expect(cookie.name).toBe("authjs.session-token");
    expect(cookie.options).toMatchObject({ secure: false, sameSite: "lax" });
  });
});

describe("safeCallbackPath", () => {
  it.each(["/dashboard", "/tasks/abc", "/tasks/new?date=2026-10-02"])(
    "keeps a path on this site: %s",
    (path) => {
      expect(safeCallbackPath(path)).toBe(path);
    },
  );

  it.each([
    undefined,
    "",
    ["/tasks"],
    "https://evil.example/",
    "//evil.example/x",
    "/\\evil.example",
    "tasks",
  ])("falls back to Home for %j", (value) => {
    expect(safeCallbackPath(value)).toBe("/dashboard");
  });
});
