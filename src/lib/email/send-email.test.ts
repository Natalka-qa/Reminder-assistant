import { afterEach, describe, expect, it, vi } from "vitest";
import { sendEmail } from "./send-email";

describe("sendEmail", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws on a non-2xx Resend response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        text: () => Promise.resolve("invalid `to` field"),
      }),
    );

    await expect(
      sendEmail("user@example.com", "Subject", "text", "<p>html</p>"),
    ).rejects.toThrow(/422/);
  });

  it("resolves without throwing on a 2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    );

    await expect(
      sendEmail("user@example.com", "Subject", "text", "<p>html</p>"),
    ).resolves.toBeUndefined();
  });
});
