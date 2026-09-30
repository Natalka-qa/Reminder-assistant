import { describe, expect, it } from "vitest";
import { reminderChannels } from "./reminder-channels";

describe("reminderChannels", () => {
  it("sends email and Telegram on the first attempt", () => {
    expect(
      reminderChannels({
        emailEnabled: true,
        telegramLinked: true,
        attemptCount: 0,
      }),
    ).toEqual({ email: true, telegram: true });
  });

  it("retries only the email", () => {
    expect(
      reminderChannels({
        emailEnabled: true,
        telegramLinked: true,
        attemptCount: 2,
      }),
    ).toEqual({ email: true, telegram: false });
  });

  it("skips email when the user turned it off", () => {
    expect(
      reminderChannels({
        emailEnabled: false,
        telegramLinked: true,
        attemptCount: 0,
      }),
    ).toEqual({ email: false, telegram: true });
    expect(
      reminderChannels({
        emailEnabled: false,
        telegramLinked: false,
        attemptCount: 0,
      }),
    ).toEqual({ email: false, telegram: false });
  });
});
