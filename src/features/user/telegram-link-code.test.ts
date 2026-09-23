import { describe, expect, it } from "vitest";
import {
  TELEGRAM_LINK_CODE_TTL_MINUTES,
  createTelegramLinkCode,
  isTelegramLinkCodeActive,
} from "./telegram-link-code";

const at = (iso: string) => new Date(iso);
const plusMs = (date: Date, ms: number) => new Date(date.getTime() + ms);

describe("createTelegramLinkCode", () => {
  const now = at("2026-09-23T12:00:00Z");

  it("makes an 8-character lowercase hex code, valid as a /start payload", () => {
    const { code } = createTelegramLinkCode(now);
    expect(code).toMatch(/^[0-9a-f]{8}$/);
    // Telegram's deep-link payload allows only [A-Za-z0-9_-].
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("makes a different code every time", () => {
    const codes = new Set(
      Array.from({ length: 50 }, () => createTelegramLinkCode(now).code),
    );
    expect(codes.size).toBe(50);
  });

  it("expires exactly 10 minutes after it's created", () => {
    expect(TELEGRAM_LINK_CODE_TTL_MINUTES).toBe(10);
    expect(createTelegramLinkCode(now).expiresAt).toEqual(
      at("2026-09-23T12:10:00Z"),
    );
  });
});

describe("isTelegramLinkCodeActive", () => {
  const expiresAt = at("2026-09-23T12:10:00Z");

  it("passes before the expiry, including the exact moment of it", () => {
    expect(
      isTelegramLinkCodeActive(expiresAt, at("2026-09-23T12:00:00Z")),
    ).toBe(true);
    expect(isTelegramLinkCodeActive(expiresAt, plusMs(expiresAt, -1))).toBe(
      true,
    );
    expect(isTelegramLinkCodeActive(expiresAt, expiresAt)).toBe(true);
  });

  it("fails once the code has expired", () => {
    expect(isTelegramLinkCodeActive(expiresAt, plusMs(expiresAt, 1))).toBe(
      false,
    );
    expect(
      isTelegramLinkCodeActive(expiresAt, at("2026-09-24T12:00:00Z")),
    ).toBe(false);
  });

  it("fails when there's no pending code (already used or never generated)", () => {
    expect(isTelegramLinkCodeActive(null, at("2026-09-23T12:00:00Z"))).toBe(
      false,
    );
  });

  it("accepts a fresh code for its whole lifetime and not a moment longer", () => {
    const created = at("2026-09-23T12:00:00Z");
    const { expiresAt: fresh } = createTelegramLinkCode(created);
    expect(isTelegramLinkCodeActive(fresh, created)).toBe(true);
    expect(isTelegramLinkCodeActive(fresh, plusMs(created, 9 * 60_000))).toBe(
      true,
    );
    expect(
      isTelegramLinkCodeActive(fresh, plusMs(created, 10 * 60_000 + 1)),
    ).toBe(false);
  });
});
