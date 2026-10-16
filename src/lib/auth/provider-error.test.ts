import { describe, expect, it } from "vitest";
import { providerErrorRedirect } from "./provider-error";

const at = (path: string) =>
  providerErrorRedirect(
    new URL(`https://app.example${path}`),
    "google-calendar",
  );

describe("providerErrorRedirect (2026-10-16)", () => {
  it("takes a cancelled calendar connection back to Settings", () => {
    expect(at("/api/auth/callback/google-calendar?error=access_denied")).toBe(
      "https://app.example/settings",
    );
  });

  it("takes a cancelled sign-in back to /login", () => {
    expect(at("/api/auth/callback/google?error=access_denied")).toBe(
      "https://app.example/login",
    );
  });

  it("leaves a successful callback and other routes to Auth.js", () => {
    expect(at("/api/auth/callback/google?code=abc&iss=x")).toBeNull();
    expect(at("/api/auth/error?error=Configuration")).toBeNull();
    expect(at("/api/auth/session")).toBeNull();
  });
});
