import { describe, expect, it } from "vitest";
import { taskInputFromPhrase, taskInputsFromPhrase } from "./phrase-task-input";

// Thursday, 11:20 in the user's zone.
const context = {
  today: "2026-10-01",
  nowMinutes: 11 * 60 + 20,
  defaultReminderMinutes: 30,
};

function ready(text: string) {
  const result = taskInputFromPhrase(text, context);
  if (result.status !== "ready") throw new Error(`not ready: ${result.status}`);
  return result.input;
}

describe("taskInputFromPhrase", () => {
  it("reads a date and a time as a fixed task", () => {
    expect(ready("Call mom tomorrow at 18")).toEqual({
      title: "Call mom",
      description: undefined,
      date: "2026-10-02",
      time: "18:00",
      durationMinutes: 0,
      priority: "NORMAL",
      flexibility: "FIXED",
      repeatFrequency: "NONE",
      repeatDaysOfWeek: [],
      reminderOffsetMinutes: 30,
      confirmConflicts: true,
    });
  });

  it("starts a task with no time today at the next hour, flexible", () => {
    expect(ready("Read 30 min")).toMatchObject({
      title: "Read",
      date: "2026-10-01",
      time: "12:00",
      durationMinutes: 30,
      flexibility: "FLEXIBLE",
    });
  });

  it("reads Russian", () => {
    expect(ready("Позвонить маме в пятницу в 10")).toMatchObject({
      title: "Позвонить маме",
      date: "2026-10-02",
      time: "10:00",
      flexibility: "FIXED",
    });
  });

  it("keeps the weekly days the phrase names", () => {
    expect(ready("Gym every mon and wed")).toMatchObject({
      title: "Gym",
      repeatFrequency: "WEEKLY",
      repeatDaysOfWeek: [1, 3],
    });
  });

  it("uses the user's default reminder", () => {
    expect(
      taskInputFromPhrase("Water plants", {
        ...context,
        defaultReminderMinutes: 0,
      }),
    ).toMatchObject({ input: { reminderOffsetMinutes: 0 } });
  });

  it("leaves a find-a-time request to the app", () => {
    expect(
      taskInputFromPhrase("Find an hour tomorrow evening for a run", context),
    ).toEqual({ status: "needs-search" });
  });

  it("needs a title", () => {
    expect(taskInputFromPhrase("tomorrow at 18", context)).toEqual({
      status: "empty",
    });
    expect(taskInputFromPhrase("   ", context)).toEqual({ status: "empty" });
  });
});

describe("taskInputsFromPhrase", () => {
  it("makes one task per day when each day has its own time", () => {
    const parts = taskInputsFromPhrase(
      "Dance every Mon at 19 and Wed at 20",
      context,
    );
    expect(
      parts.map((part) => part.status === "ready" && part.input),
    ).toMatchObject([
      {
        title: "Dance",
        repeatFrequency: "WEEKLY",
        repeatDaysOfWeek: [1],
        time: "19:00",
        flexibility: "FIXED",
        reminderOffsetMinutes: 30,
      },
      {
        title: "Dance",
        repeatFrequency: "WEEKLY",
        repeatDaysOfWeek: [3],
        time: "20:00",
      },
    ]);
  });

  it("is one task for anything else", () => {
    expect(taskInputsFromPhrase("Call mom tomorrow at 18", context)).toEqual([
      taskInputFromPhrase("Call mom tomorrow at 18", context),
    ]);
  });
});
