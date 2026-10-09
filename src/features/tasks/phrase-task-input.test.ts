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

describe("NEW_TASK_V2_UPDATE.md § 11 examples without a time (sprint-18)", () => {
  it("1. Buy groceries → today, Any time, Flexible, no reminder", () => {
    const input = ready("Buy groceries");
    expect(input).toMatchObject({
      title: "Buy groceries",
      date: "2026-10-01",
      flexibility: "FLEXIBLE",
      reminderKind: "NONE",
    });
    expect(input.time).toBeUndefined();
  });

  it("3. Pay rent on October 1 → Oct 1, Any time, Flexible", () => {
    const input = ready("Pay rent on October 1");
    expect(input).toMatchObject({
      title: "Pay rent",
      date: "2026-10-01",
      flexibility: "FLEXIBLE",
    });
    expect(input.time).toBeUndefined();
  });

  // 2026-10-09 decision 1 — before, every day with no time.
  it("5. Take vitamins every morning → every day at 09:00, Flexible", () => {
    expect(ready("Take vitamins every morning")).toMatchObject({
      title: "Take vitamins",
      repeatFrequency: "DAILY",
      time: "09:00",
      flexibility: "FLEXIBLE",
      reminderKind: "OFFSET",
      reminderOffsetMinutes: 0,
    });
  });

  it("2. a phrase with a time is still Fixed with the default reminder", () => {
    expect(
      ready("Call the dentist tomorrow at 9 for 30 minutes"),
    ).toMatchObject({
      date: "2026-10-02",
      time: "09:00",
      durationMinutes: 30,
      flexibility: "FIXED",
      reminderKind: "OFFSET",
      reminderOffsetMinutes: 30,
    });
  });
});

describe("taskInputFromPhrase", () => {
  it("reads a date and a time as a fixed task", () => {
    expect(ready("Call mom tomorrow at 18")).toEqual({
      title: "Call mom",
      description: undefined,
      date: "2026-10-02",
      time: "18:00",
      // A call — 5 min, guessed from the title.
      durationMinutes: 5,
      priority: "NORMAL",
      flexibility: "FIXED",
      repeatFrequency: "NONE",
      repeatDaysOfWeek: [],
      repeatInterval: 1,
      repeatEnd: "NEVER",
      reminderKind: "OFFSET",
      reminderOffsetMinutes: 30,
      confirmConflicts: true,
    });
  });

  it("keeps a task with no time without one, flexible (sprint-18 п.6, п.20)", () => {
    const input = ready("Read 30 min");
    expect(input).toMatchObject({
      title: "Read",
      date: "2026-10-01",
      durationMinutes: 30,
      flexibility: "FLEXIBLE",
      reminderKind: "NONE",
    });
    expect(input.time).toBeUndefined();
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

describe("a course, one task per dose (sprint-20 п.5–6)", () => {
  it("saves each dose Flexible, reminded at its start, ending with the course", () => {
    const inputs = taskInputsFromPhrase(
      "Таблетки 2 раза в день утром и вечером на месяц",
      context,
    ).map((result) => {
      if (result.status !== "ready") throw new Error(result.status);
      return result.input;
    });
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toMatchObject({
      title: "Таблетки — утро",
      date: "2026-10-01",
      time: "09:00",
      flexibility: "FLEXIBLE",
      repeatFrequency: "DAILY",
      repeatEnd: "ON_DATE",
      repeatUntil: "2026-10-31",
      reminderKind: "OFFSET",
      reminderOffsetMinutes: 0,
    });
    expect(inputs[1]).toMatchObject({
      title: "Таблетки — вечер",
      time: "20:00",
    });
  });

  it("saves a part of the day as its time, Flexible, reminded at start", () => {
    expect(ready("Позвонить маме утром")).toMatchObject({
      title: "Позвонить маме",
      time: "09:00",
      flexibility: "FLEXIBLE",
      reminderKind: "OFFSET",
      reminderOffsetMinutes: 0,
      repeatFrequency: "NONE",
    });
  });

  it("saves a count as After N times", () => {
    expect(ready("приседать утром 5 дней")).toMatchObject({
      title: "Приседать",
      time: "09:00",
      flexibility: "FLEXIBLE",
      repeatFrequency: "DAILY",
      repeatInterval: 1,
      repeatEnd: "AFTER_COUNT",
      repeatCount: 5,
    });
    expect(ready("Отжимания каждый день 3 раза")).toMatchObject({
      title: "Отжимания",
      repeatEnd: "AFTER_COUNT",
      repeatCount: 3,
    });
  });

  it("keeps every other day as a step of 2", () => {
    expect(ready("Medicine every other day for a month")).toMatchObject({
      repeatFrequency: "DAILY",
      repeatInterval: 2,
      repeatEnd: "ON_DATE",
      repeatUntil: "2026-10-31",
    });
  });
});

describe("a usual length from the title", () => {
  it("adds dance on Wed 19 and Fri 20 as two tasks of an hour", () => {
    const inputs = taskInputsFromPhrase(
      "танцы по средам 19 и пятницам в 20",
      context,
    ).map((result) => {
      if (result.status !== "ready") throw new Error(result.status);
      return result.input;
    });
    expect(
      inputs.map((input) => [
        input.title,
        input.repeatDaysOfWeek,
        input.time,
        input.durationMinutes,
      ]),
    ).toEqual([
      ["Танцы", [3], "19:00", 60],
      ["Танцы", [5], "20:00", 60],
    ]);
  });

  it("a duration in the text wins over the guess", () => {
    expect(ready("Massage tomorrow at 18 for 90 minutes").durationMinutes).toBe(
      90,
    );
    expect(ready("Doctor tomorrow at 10").durationMinutes).toBe(30);
  });
});
