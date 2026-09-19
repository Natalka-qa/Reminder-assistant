import { describe, expect, it } from "vitest";
import { buildReminderEmail } from "./reminder-email";

describe("buildReminderEmail", () => {
  it("includes the task title and time in the subject and body", () => {
    const email = buildReminderEmail({
      title: "Workout",
      timeLabel: "19:00",
      durationMinutes: 60,
      taskUrl: "https://example.com/tasks/1",
    });

    expect(email.subject).toContain("Workout");
    expect(email.subject).toContain("19:00");
    expect(email.text).toContain("Workout");
    expect(email.text).toContain("19:00");
    expect(email.text).toContain("https://example.com/tasks/1");
    expect(email.html).toContain("Workout");
    expect(email.html).toContain("19:00");
  });

  it("escapes HTML in a user-provided title", () => {
    const email = buildReminderEmail({
      title: "<script>alert(1)</script>",
      timeLabel: "19:00",
      durationMinutes: 0,
      taskUrl: "https://example.com/tasks/1",
    });

    expect(email.html).not.toContain("<script>");
  });
});
