import { describe, expect, it } from "vitest";
import { buildReminderTelegramMessage } from "./reminder-telegram-message";

describe("buildReminderTelegramMessage", () => {
  it("says the task and its time, without a link (Open is a button)", () => {
    expect(
      buildReminderTelegramMessage({
        title: "Workout",
        timeLabel: "19:00",
        durationMinutes: 60,
      }),
    ).toBe("⏰ <b>Workout</b>\nat 19:00 · 60 min");
  });

  it("leaves the length out when durationMinutes is 0", () => {
    expect(
      buildReminderTelegramMessage({
        title: "Workout",
        timeLabel: "19:00",
        durationMinutes: 0,
      }),
    ).toBe("⏰ <b>Workout</b>\nat 19:00");
  });

  it("escapes the title (HTML, 2026-10-08)", () => {
    expect(
      buildReminderTelegramMessage({
        title: "A<b>",
        timeLabel: "19:00",
        durationMinutes: 0,
      }),
    ).toBe("⏰ <b>A&lt;b&gt;</b>\nat 19:00");
  });
});
