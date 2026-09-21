import { describe, expect, it } from "vitest";
import { buildReminderTelegramMessage } from "./reminder-telegram-message";

describe("buildReminderTelegramMessage", () => {
  it("includes the task title, time, and link", () => {
    const message = buildReminderTelegramMessage({
      title: "Workout",
      timeLabel: "19:00",
      durationMinutes: 60,
      taskUrl: "https://example.com/tasks/1",
    });

    expect(message).toContain("Workout");
    expect(message).toContain("19:00");
    expect(message).toContain("(60 min)");
    expect(message).toContain("https://example.com/tasks/1");
  });

  it("omits the duration parenthetical when durationMinutes is 0", () => {
    const message = buildReminderTelegramMessage({
      title: "Workout",
      timeLabel: "19:00",
      durationMinutes: 0,
      taskUrl: "https://example.com/tasks/1",
    });

    expect(message).not.toContain("(0 min)");
  });
});
