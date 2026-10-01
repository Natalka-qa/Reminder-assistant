import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signInitData, verifyInitData } from "./init-data";

const BOT_TOKEN = "123456:TEST-token-for-init-data";
const OTHER_TOKEN = "654321:another-bot";
const NOW = new Date("2026-10-01T12:00:00Z");
const NOW_SECONDS = NOW.getTime() / 1000;
const OPTIONS = { botToken: BOT_TOKEN, now: NOW, maxAgeSeconds: 3600 };

const USER = JSON.stringify({ id: 987654321, first_name: "Natalia" });

// Builds an initData string the way Telegram does: the fields, plus `hash`
// signed with the given token.
function signed(
  fields: Record<string, string>,
  token: string = BOT_TOKEN,
): string {
  const params = new URLSearchParams(fields);
  params.set("hash", signInitData(params, token));
  return params.toString();
}

function fresh(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    query_id: "AAHdF6IQAAAAAN0XohDhrOrc",
    user: USER,
    auth_date: String(NOW_SECONDS - 60),
    ...overrides,
  };
}

describe("signInitData", () => {
  it("matches the algorithm in Telegram's docs, computed by hand", () => {
    // Sorted by key, key=value, "\n"-joined; key = HMAC("WebAppData", token).
    const dataCheckString = `auth_date=1700000000\nquery_id=Q\nuser=${USER}`;
    const secret = createHmac("sha256", "WebAppData")
      .update(BOT_TOKEN)
      .digest();
    const expected = createHmac("sha256", secret)
      .update(dataCheckString)
      .digest("hex");

    const params = new URLSearchParams({
      user: USER,
      query_id: "Q",
      auth_date: "1700000000",
    });
    expect(signInitData(params, BOT_TOKEN)).toBe(expected);
  });
});

describe("verifyInitData", () => {
  it("accepts a fresh string signed with our token", () => {
    expect(verifyInitData(signed(fresh()), OPTIONS)).toEqual({
      ok: true,
      telegramUserId: 987654321,
      authDate: new Date((NOW_SECONDS - 60) * 1000),
    });
  });

  it("rejects a string with a changed field", () => {
    const raw = signed(fresh()).replace("987654321", "111111111");
    expect(verifyInitData(raw, OPTIONS)).toEqual({
      ok: false,
      reason: "bad-hash",
    });
  });

  it("rejects an added field", () => {
    const raw = `${signed(fresh())}&chat_type=private`;
    expect(verifyInitData(raw, OPTIONS)).toEqual({
      ok: false,
      reason: "bad-hash",
    });
  });

  it("rejects a string signed by another bot", () => {
    expect(verifyInitData(signed(fresh(), OTHER_TOKEN), OPTIONS)).toEqual({
      ok: false,
      reason: "bad-hash",
    });
  });

  it("rejects a hash of the wrong length without throwing", () => {
    const params = new URLSearchParams(fresh());
    params.set("hash", "abc");
    expect(verifyInitData(params.toString(), OPTIONS)).toEqual({
      ok: false,
      reason: "bad-hash",
    });
  });

  it("rejects a string without hash", () => {
    const raw = new URLSearchParams(fresh()).toString();
    expect(verifyInitData(raw, OPTIONS)).toEqual({
      ok: false,
      reason: "missing-hash",
    });
    expect(verifyInitData("", OPTIONS)).toEqual({
      ok: false,
      reason: "missing-hash",
    });
  });

  it("rejects auth_date older than an hour", () => {
    const raw = signed(fresh({ auth_date: String(NOW_SECONDS - 3601) }));
    expect(verifyInitData(raw, OPTIONS)).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("accepts auth_date exactly an hour old", () => {
    const raw = signed(fresh({ auth_date: String(NOW_SECONDS - 3600) }));
    expect(verifyInitData(raw, OPTIONS).ok).toBe(true);
  });

  it("allows a minute of clock skew, not more", () => {
    const ahead = (s: number) =>
      signed(fresh({ auth_date: String(NOW_SECONDS + s) }));
    expect(verifyInitData(ahead(60), OPTIONS).ok).toBe(true);
    expect(verifyInitData(ahead(61), OPTIONS)).toEqual({
      ok: false,
      reason: "from-future",
    });
  });

  it("rejects a signed string without a usable auth_date", () => {
    const noDate = fresh();
    delete noDate.auth_date;
    expect(verifyInitData(signed(noDate), OPTIONS)).toEqual({
      ok: false,
      reason: "missing-auth-date",
    });
    expect(
      verifyInitData(signed(fresh({ auth_date: "soon" })), OPTIONS),
    ).toEqual({ ok: false, reason: "missing-auth-date" });
  });

  it.each([
    ["missing", undefined],
    ["not JSON", "{id:1"],
    ["not an object", "42"],
    ["no id", JSON.stringify({ first_name: "N" })],
    ["string id", JSON.stringify({ id: "987654321" })],
    ["zero id", JSON.stringify({ id: 0 })],
  ])("rejects a signed string with a bad user (%s)", (_label, user) => {
    const fields = fresh();
    if (user === undefined) delete fields.user;
    else fields.user = user;
    expect(verifyInitData(signed(fields), OPTIONS)).toEqual({
      ok: false,
      reason: "bad-user",
    });
  });
});
