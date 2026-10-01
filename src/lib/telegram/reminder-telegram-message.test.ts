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
    ).toBe("Workout is scheduled for 19:00 (60 min).");
  });

  it("omits the duration parenthetical when durationMinutes is 0", () => {
    expect(
      buildReminderTelegramMessage({
        title: "Workout",
        timeLabel: "19:00",
        durationMinutes: 0,
      }),
    ).toBe("Workout is scheduled for 19:00.");
  });
});
