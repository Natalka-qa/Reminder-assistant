import { describe, expect, it } from "vitest";
import { reminderChannels } from "./reminder-channels";

describe("reminderChannels", () => {
  it("sends email and Telegram on the first attempt, retrying the email", () => {
    expect(
      reminderChannels({
        emailEnabled: true,
        telegramLinked: true,
        attemptCount: 0,
      }),
    ).toEqual({ email: true, telegram: true, retryOn: "email" });
  });

  it("retries only the email while email is on", () => {
    expect(
      reminderChannels({
        emailEnabled: true,
        telegramLinked: true,
        attemptCount: 2,
      }),
    ).toEqual({ email: true, telegram: false, retryOn: "email" });
  });

  it("with email off, retries Telegram until it gets through", () => {
    for (const attemptCount of [0, 1, 2]) {
      expect(
        reminderChannels({
          emailEnabled: false,
          telegramLinked: true,
          attemptCount,
        }),
      ).toEqual({ email: false, telegram: true, retryOn: "telegram" });
    }
  });

  it("has nothing to send or retry with email off and no Telegram", () => {
    expect(
      reminderChannels({
        emailEnabled: false,
        telegramLinked: false,
        attemptCount: 0,
      }),
    ).toEqual({ email: false, telegram: false, retryOn: null });
  });
});
