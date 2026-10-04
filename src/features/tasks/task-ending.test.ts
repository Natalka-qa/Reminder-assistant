import { describe, expect, it } from "vitest";
import { zonedDateTimeToUtc } from "@/lib/date";
import {
  END_LABELS,
  daysToReopen,
  deleteDialog,
  endDialog,
  endedLabel,
  endedRows,
  taskEndKind,
} from "./task-ending";

const TZ = "Europe/Kyiv";
const at = (date: string, time: string) => zonedDateTimeToUtc(date, time, TZ);

describe("what ending a task is called and says (п.10–11)", () => {
  it("ends a series, archives a one-off task", () => {
    expect(END_LABELS[taskEndKind(true)]).toMatchObject({
      end: "End series",
      resume: "Resume series",
    });
    expect(END_LABELS[taskEndKind(false)]).toMatchObject({
      end: "Archive",
      resume: "Restore",
    });
  });

  it("says what stays and how to come back before it acts", () => {
    expect(endDialog("series")).toEqual({
      title: "End this series?",
      body: [
        "Days from today on are removed with their reminders. Days you've already done or skipped stay, and still count in Progress.",
        "You can resume it later from Tasks → Ended.",
      ],
    });
    expect(endDialog("archive").title).toBe("Archive this task?");
    expect(endDialog("archive").body[1]).toBe(
      "You can restore it from Tasks → Ended.",
    );
  });

  it("Delete says the history goes too, and names the softer way", () => {
    expect(deleteDialog("series").body).toEqual([
      "The task, all its days and reminders are deleted for good, and its history disappears from Progress.",
      "To stop it but keep its history, use End series.",
    ]);
    expect(deleteDialog("archive").body[1]).toBe(
      "To stop it but keep its history, use Archive.",
    );
  });
});

describe("endedLabel (п.12)", () => {
  const endedAt = at("2026-10-02", "21:00");

  it("dates it on the page and in the list", () => {
    expect(endedLabel("series", endedAt, TZ, "page")).toBe(
      "Series ended Oct 2",
    );
    expect(endedLabel("series", endedAt, TZ, "list")).toBe("Ended Oct 2");
    expect(endedLabel("archive", endedAt, TZ, "page")).toBe("Archived Oct 2");
    expect(endedLabel("archive", null, TZ, "list")).toBe("Archived");
  });
});

describe("endedRows (п.12)", () => {
  const tasks = [
    {
      id: "walk",
      title: "Evening walk",
      recurrenceRule: '{"frequency":"DAILY"}',
      endedAt: at("2026-10-01", "10:00"),
      updatedAt: at("2026-10-03", "10:00"),
    },
    {
      id: "visa",
      title: "Visa photos",
      recurrenceRule: null,
      endedAt: at("2026-10-02", "10:00"),
      updatedAt: at("2026-10-02", "10:00"),
    },
  ];

  it("lists the latest ended first, by when it ended, not its last edit", () => {
    expect(endedRows(tasks, TZ, "")).toEqual([
      { taskId: "visa", title: "Visa photos", meta: ["Archived Oct 2"] },
      {
        taskId: "walk",
        title: "Evening walk",
        meta: ["↻ Daily", "Ended Oct 1"],
      },
    ]);
  });

  it("applies the search", () => {
    expect(endedRows(tasks, TZ, "WALK").map((r) => r.taskId)).toEqual(["walk"]);
  });
});

describe("daysToReopen (п.13)", () => {
  const endedAt = at("2026-10-04", "12:00");
  const now = at("2026-10-06", "12:00");
  const day = (
    id: string,
    date: string,
    status: "CANCELLED" | "DONE",
    cancelledAt: Date,
  ) => ({
    id,
    status,
    scheduledStart: at(date, "18:00"),
    updatedAt: cancelledAt,
  });
  const days = [
    day("done", "2026-10-03", "DONE", at("2026-10-03", "19:00")),
    day("removed", "2026-10-08", "CANCELLED", at("2026-10-01", "09:00")),
    day("passed", "2026-10-05", "CANCELLED", endedAt),
    day("ahead", "2026-10-07", "CANCELLED", endedAt),
  ];

  it("a series gets back the days the end cancelled that are still ahead", () => {
    const ids = daysToReopen(days, {
      endedAt,
      recurring: true,
      hasTime: true,
      now,
      timezone: TZ,
    }).map((o) => o.id);
    expect(ids).toEqual(["ahead"]);
  });

  it("an archived one-off gets its day back even once it has passed", () => {
    const ids = daysToReopen([days[2]], {
      endedAt,
      recurring: false,
      hasTime: true,
      now,
      timezone: TZ,
    }).map((o) => o.id);
    expect(ids).toEqual(["passed"]);
  });

  it("nothing without an end date", () => {
    expect(
      daysToReopen(days, {
        endedAt: null,
        recurring: true,
        hasTime: true,
        now,
        timezone: TZ,
      }),
    ).toEqual([]);
  });
});
