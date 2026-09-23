import { describe, expect, it } from "vitest";
import { zonedDateTimeToUtc } from "@/lib/date";
import type { RecurrenceRule } from "@/features/recurrence/recurrence-rule";
import {
  buildMeta,
  buildTaskListItems,
  canMoveToToday,
  classifyTask,
  filterByQuery,
  filterByTab,
  findConflicts,
  findRepeatedTimes,
  formatDayLabel,
  formatTaskSummary,
  groupTasks,
  pickListOccurrence,
  taskSummary,
  type TaskListItem,
  type TaskListSource,
} from "./task-list-view";
import type { TaskSort, TaskTab } from "./task-list-params";

// The prototype's library() data (Reminder Assistant v2 Atmosphere.dc.html)
// as fixtures: Sunday, Apr 26 2026, 10:00 in Kyiv (UTC+3 at that date).
const TZ = "Europe/Kyiv";
const at = (date: string, time: string) => zonedDateTimeToUtc(date, time, TZ);
const NOW = at("2026-04-26", "10:00");
const CONTEXT = { now: NOW, timezone: TZ };

const DAILY: RecurrenceRule = { frequency: "DAILY" };
const weekly = (...daysOfWeek: number[]): RecurrenceRule => ({
  frequency: "WEEKLY",
  daysOfWeek,
});

function item(
  title: string,
  date: string,
  time: string,
  overrides: Partial<TaskListItem> = {},
): TaskListItem {
  const scheduledStart = at(date, time);
  const recurrence = overrides.recurrence ?? null;
  return {
    taskId: title,
    occurrenceId: `occ-${title}`,
    title,
    priority: "NORMAL",
    flexibility: "FLEXIBLE",
    durationMinutes: 0,
    recurrence,
    status: "SCHEDULED",
    scheduledStart,
    ...classifyTask({ scheduledStart, recurrence }, NOW, TZ),
    ...overrides,
  };
}

const LONG_TITLE =
  "Book summer flights for the whole family before the prices go up again";

const LIBRARY: TaskListItem[] = [
  item("Pay the invoice", "2026-04-25", "18:00", {
    priority: "HIGH",
    durationMinutes: 15,
  }),
  item("Vitamins", "2026-04-26", "08:00", {
    priority: "LOW",
    flexibility: "FIXED",
    recurrence: DAILY,
  }),
  item("Call the dentist", "2026-04-26", "09:30", {
    priority: "HIGH",
    flexibility: "FIXED",
    durationMinutes: 30,
  }),
  item("Drop off the parcel", "2026-04-26", "09:30", {
    priority: "LOW",
    durationMinutes: 15,
  }),
  item("Send the proposal", "2026-04-26", "13:00", {
    priority: "CRITICAL",
    durationMinutes: 45,
  }),
  item("Coffee with Marta", "2026-04-26", "13:00", { durationMinutes: 45 }),
  item("Team sync", "2026-04-26", "16:30", {
    flexibility: "FIXED",
    durationMinutes: 60,
    recurrence: weekly(7),
  }),
  item("Workout", "2026-04-26", "19:00", {
    priority: "HIGH",
    durationMinutes: 60,
    recurrence: weekly(7),
  }),
  item("Take Bellara", "2026-04-26", "21:00", {
    priority: "HIGH",
    flexibility: "FIXED",
    recurrence: DAILY,
  }),
  item("Spanish lesson", "2026-04-28", "17:00", {
    priority: "HIGH",
    flexibility: "FIXED",
    durationMinutes: 60,
    recurrence: weekly(2),
  }),
  item("Barbería para mi hijo", "2026-04-28", "15:35", {
    flexibility: "FIXED",
    durationMinutes: 40,
  }),
  item("English lesson", "2026-04-30", "18:00", {
    flexibility: "FIXED",
    durationMinutes: 60,
    recurrence: weekly(4),
  }),
  item("Renew the gym membership", "2026-04-30", "12:00", {
    priority: "LOW",
    durationMinutes: 10,
  }),
  item("MK Кампанар", "2026-05-08", "18:05", { flexibility: "FIXED" }),
  item(LONG_TITLE, "2026-05-14", "10:00", { priority: "LOW" }),
];

const byTitle = (title: string) => {
  const found = LIBRARY.find((t) => t.title === title);
  if (!found) throw new Error(`No fixture "${title}"`);
  return found;
};
const titles = (items: { title: string }[]) => items.map((t) => t.title);
const meta = (task: TaskListItem, timeInColumn = false) =>
  buildMeta(task, { timeInColumn, ...CONTEXT });

describe("classifyTask", () => {
  const classify = (date: string, time: string, recurrence = null) =>
    classifyTask({ scheduledStart: at(date, time), recurrence }, NOW, TZ);

  it("buckets by calendar day in the user's timezone", () => {
    expect(classify("2026-04-25", "23:59")).toMatchObject({
      timing: "overdue",
      dayOffset: -1,
    });
    expect(classify("2026-04-26", "00:00")).toMatchObject({
      timing: "today",
      dayOffset: 0,
    });
    expect(classify("2026-04-26", "08:00")).toMatchObject({ timing: "today" });
    expect(classify("2026-04-27", "00:00")).toMatchObject({
      timing: "upcoming",
      dayOffset: 1,
    });
    expect(classify("2026-05-03", "23:00")).toMatchObject({
      timing: "upcoming",
      dayOffset: 7,
    });
    expect(classify("2026-05-04", "08:00")).toMatchObject({
      timing: "later",
      dayOffset: 8,
    });
  });

  it("uses the zoned date, not the UTC one", () => {
    // 22:30 UTC on Apr 25 is already 01:30 on Apr 26 in Kyiv.
    const result = classifyTask(
      { scheduledStart: new Date("2026-04-25T22:30:00Z"), recurrence: null },
      NOW,
      TZ,
    );
    expect(result).toMatchObject({ timing: "today", dayOffset: 0 });
  });

  it("flags recurring tasks", () => {
    expect(
      classifyTask({ scheduledStart: NOW, recurrence: DAILY }, NOW, TZ)
        .isRecurring,
    ).toBe(true);
    expect(classify("2026-04-26", "12:00").isRecurring).toBe(false);
  });
});

describe("pickListOccurrence", () => {
  const occ = (
    id: string,
    status: TaskListItem["status"],
    date: string,
    time = "09:00",
    updatedAt = at("2026-04-20", "09:00"),
  ) => ({ id, status, scheduledStart: at(date, time), updatedAt });

  it("recurring: keeps today's occurrence once it's done instead of jumping ahead", () => {
    const picked = pickListOccurrence(
      [
        occ("today", "DONE", "2026-04-26"),
        occ("tomorrow", "SCHEDULED", "2026-04-27"),
      ],
      true,
      NOW,
      TZ,
    );
    expect(picked?.id).toBe("today");
  });

  it("recurring: skips a missed past occurrence, so it's never overdue", () => {
    const picked = pickListOccurrence(
      [
        occ("missed", "SCHEDULED", "2026-04-24"),
        occ("done-early", "DONE", "2026-04-28"),
        occ("next", "SCHEDULED", "2026-04-30"),
      ],
      true,
      NOW,
      TZ,
    );
    expect(picked?.id).toBe("next");
  });

  it("recurring: nothing from today on means no row", () => {
    expect(
      pickListOccurrence(
        [occ("missed", "SCHEDULED", "2026-04-24")],
        true,
        NOW,
        TZ,
      ),
    ).toBeUndefined();
  });

  it("ignores cancelled occurrences", () => {
    const picked = pickListOccurrence(
      [
        occ("cancelled", "CANCELLED", "2026-04-26"),
        occ("next", "SCHEDULED", "2026-04-27"),
      ],
      true,
      NOW,
      TZ,
    );
    expect(picked?.id).toBe("next");
    expect(
      pickListOccurrence(
        [occ("cancelled", "CANCELLED", "2026-04-28")],
        false,
        NOW,
        TZ,
      ),
    ).toBeUndefined();
  });

  it("one-off: shows today's and future occurrences in any status", () => {
    expect(
      pickListOccurrence([occ("a", "DONE", "2026-04-26")], false, NOW, TZ)?.id,
    ).toBe("a");
    expect(
      pickListOccurrence([occ("b", "SKIPPED", "2026-05-02")], false, NOW, TZ)
        ?.id,
    ).toBe("b");
  });

  it("one-off: shows a past occurrence while it's open (overdue)", () => {
    for (const status of ["SCHEDULED", "SNOOZED"] as const) {
      expect(
        pickListOccurrence([occ("a", status, "2026-04-10")], false, NOW, TZ)
          ?.id,
      ).toBe("a");
    }
  });

  it("one-off: keeps a past occurrence resolved today, drops older history", () => {
    const resolvedToday = occ(
      "today",
      "DONE",
      "2026-04-25",
      "18:00",
      at("2026-04-26", "09:45"),
    );
    const resolvedYesterday = occ(
      "old",
      "DONE",
      "2026-04-24",
      "18:00",
      at("2026-04-25", "20:00"),
    );
    expect(pickListOccurrence([resolvedToday], false, NOW, TZ)?.id).toBe(
      "today",
    );
    expect(
      pickListOccurrence([resolvedYesterday], false, NOW, TZ),
    ).toBeUndefined();
  });
});

describe("buildTaskListItems", () => {
  const source = (
    overrides: Partial<TaskListSource> & Pick<TaskListSource, "id">,
  ): TaskListSource => ({
    title: overrides.id,
    priority: "NORMAL",
    flexibility: "FLEXIBLE",
    durationMinutes: 30,
    recurrenceRule: null,
    occurrences: [],
    ...overrides,
  });
  const updatedAt = at("2026-04-01", "09:00");

  it("builds one classified row per task and drops tasks with nothing to show", () => {
    const items = buildTaskListItems(
      [
        source({
          id: "invoice",
          occurrences: [
            {
              id: "o1",
              status: "SCHEDULED",
              scheduledStart: at("2026-04-25", "18:00"),
              updatedAt,
            },
          ],
        }),
        source({
          id: "vitamins",
          recurrenceRule: JSON.stringify(DAILY),
          occurrences: [
            {
              id: "o2",
              status: "SCHEDULED",
              scheduledStart: at("2026-04-26", "08:00"),
              updatedAt,
            },
            {
              id: "o3",
              status: "SCHEDULED",
              scheduledStart: at("2026-04-27", "08:00"),
              updatedAt,
            },
          ],
        }),
        source({
          id: "old",
          occurrences: [
            {
              id: "o4",
              status: "DONE",
              scheduledStart: at("2026-04-01", "08:00"),
              updatedAt,
            },
          ],
        }),
        source({ id: "empty" }),
      ],
      NOW,
      TZ,
    );

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      taskId: "invoice",
      occurrenceId: "o1",
      timing: "overdue",
      dayOffset: -1,
      isRecurring: false,
      recurrence: null,
    });
    expect(items[1]).toMatchObject({
      taskId: "vitamins",
      occurrenceId: "o2",
      timing: "today",
      isRecurring: true,
      recurrence: DAILY,
    });
  });
});

describe("filterByTab", () => {
  it("All keeps everything", () => {
    expect(filterByTab(LIBRARY, "all")).toHaveLength(LIBRARY.length);
  });

  it("Today = overdue + today, including recurring tasks that happen today", () => {
    expect(titles(filterByTab(LIBRARY, "today"))).toEqual([
      "Pay the invoice",
      "Vitamins",
      "Call the dentist",
      "Drop off the parcel",
      "Send the proposal",
      "Coffee with Marta",
      "Team sync",
      "Workout",
      "Take Bellara",
    ]);
  });

  it("Upcoming = later than today and not recurring", () => {
    expect(titles(filterByTab(LIBRARY, "upcoming"))).toEqual([
      "Barbería para mi hijo",
      "Renew the gym membership",
      "MK Кампанар",
      LONG_TITLE,
    ]);
  });

  it("Recurring = recurring only", () => {
    expect(titles(filterByTab(LIBRARY, "recurring"))).toEqual([
      "Vitamins",
      "Team sync",
      "Workout",
      "Take Bellara",
      "Spanish lesson",
      "English lesson",
    ]);
  });
});

describe("filterByQuery", () => {
  it("matches the title case-insensitively and ignores surrounding spaces", () => {
    expect(titles(filterByQuery(LIBRARY, "  LESSON "))).toEqual([
      "Spanish lesson",
      "English lesson",
    ]);
    expect(titles(filterByQuery(LIBRARY, "кампанар"))).toEqual(["MK Кампанар"]);
  });

  it("keeps everything for a blank query and nothing for a miss", () => {
    expect(filterByQuery(LIBRARY, "   ")).toHaveLength(LIBRARY.length);
    expect(filterByQuery(LIBRARY, "zzz")).toEqual([]);
  });
});

describe("groupTasks", () => {
  const group = (sort: TaskSort, tab: TaskTab) =>
    groupTasks(filterByTab(LIBRARY, tab), sort, tab, CONTEXT);
  const summary = (sort: TaskSort, tab: TaskTab) =>
    group(sort, tab).map((g) => [g.label, titles(g.items)]);

  it("Smart: Overdue → Today → Upcoming → Later → Recurring", () => {
    expect(summary("smart", "all")).toEqual([
      ["Overdue", ["Pay the invoice"]],
      [
        "Today",
        [
          "Call the dentist",
          "Drop off the parcel",
          "Send the proposal",
          "Coffee with Marta",
        ],
      ],
      ["Upcoming", ["Barbería para mi hijo", "Renew the gym membership"]],
      ["Later", ["MK Кампанар", LONG_TITLE]],
      [
        "Recurring",
        // Priority first, then title.
        [
          "Spanish lesson",
          "Take Bellara",
          "Workout",
          "English lesson",
          "Team sync",
          "Vitamins",
        ],
      ],
    ]);
  });

  it("Smart on the Today tab keeps recurring tasks in Today, by time", () => {
    expect(summary("smart", "today")).toEqual([
      ["Overdue", ["Pay the invoice"]],
      [
        "Today",
        [
          "Vitamins",
          "Call the dentist",
          "Drop off the parcel",
          "Send the proposal",
          "Coffee with Marta",
          "Team sync",
          "Workout",
          "Take Bellara",
        ],
      ],
    ]);
  });

  it("drops empty groups", () => {
    expect(group("smart", "upcoming").map((g) => g.key)).toEqual([
      "upcoming",
      "later",
    ]);
    expect(groupTasks([], "time", "all", CONTEXT)).toEqual([]);
  });

  it("Time: Yesterday → Today → each date → Recurring", () => {
    const groups = group("time", "all");
    expect(groups.map((g) => [g.key, g.label, g.tone])).toEqual([
      ["yesterday", "Yesterday", "overdue"],
      ["today", "Today", "default"],
      ["day:2026-04-28", "Tue, Apr 28", "default"],
      ["day:2026-04-30", "Thu, Apr 30", "default"],
      ["day:2026-05-08", "May 8", "default"],
      ["day:2026-05-14", "May 14", "default"],
      ["recurring", "Recurring", "default"],
    ]);
  });

  it("Time: overdue older than yesterday gets its own burgundy date group", () => {
    const groups = groupTasks(
      [
        item("Old", "2026-04-20", "09:00"),
        item("Older", "2026-04-02", "09:00"),
      ],
      "time",
      "all",
      CONTEXT,
    );
    expect(groups.map((g) => [g.label, g.tone])).toEqual([
      ["Apr 2", "overdue"],
      ["Mon, Apr 20", "overdue"],
    ]);
  });

  it("Priority: High (critical + high) → Normal → Low, recurring included", () => {
    expect(summary("priority", "all")).toEqual([
      [
        "High priority",
        [
          "Pay the invoice",
          "Call the dentist",
          "Send the proposal",
          "Workout",
          "Take Bellara",
          "Spanish lesson",
        ],
      ],
      [
        "Normal",
        [
          "Coffee with Marta",
          "Team sync",
          "Barbería para mi hijo",
          "English lesson",
          "MK Кампанар",
        ],
      ],
      [
        "Low",
        [
          "Vitamins",
          "Drop off the parcel",
          "Renew the gym membership",
          LONG_TITLE,
        ],
      ],
    ]);
  });

  it("shows the time column in the Today group only", () => {
    for (const sort of ["smart", "time"] as const) {
      for (const g of group(sort, "all")) {
        expect(g.timeColumn).toBe(g.key === "today");
      }
    }
    expect(group("priority", "all").some((g) => g.timeColumn)).toBe(false);
  });

  it("puts every task in exactly one group, for every sort and tab", () => {
    const sorts: TaskSort[] = ["smart", "time", "priority"];
    const tabs: TaskTab[] = ["all", "today", "upcoming", "recurring"];
    for (const sort of sorts) {
      for (const tab of tabs) {
        const expected = filterByTab(LIBRARY, tab).map((t) => t.taskId);
        const grouped = group(sort, tab).flatMap((g) =>
          g.items.map((t) => t.taskId),
        );
        expect(grouped).toHaveLength(expected.length);
        expect(new Set(grouped)).toEqual(new Set(expected));
      }
    }
  });
});

describe("findConflicts", () => {
  const today = () =>
    groupTasks(filterByTab(LIBRARY, "all"), "smart", "all", CONTEXT).find(
      (g) => g.key === "today",
    )!.items;

  it("points the second and later same-time rows at the first", () => {
    const conflicts = findConflicts(today());
    expect(Object.fromEntries(conflicts)).toEqual({
      "Drop off the parcel": {
        taskId: "Call the dentist",
        title: "Call the dentist",
      },
      "Coffee with Marta": {
        taskId: "Send the proposal",
        title: "Send the proposal",
      },
    });
  });

  it("ignores resolved rows on either side", () => {
    const first = item("First", "2026-04-26", "09:30", { status: "DONE" });
    const second = item("Second", "2026-04-26", "09:30");
    const third = item("Third", "2026-04-26", "09:30", { status: "SKIPPED" });
    const fourth = item("Fourth", "2026-04-26", "09:30", {
      status: "SNOOZED",
    });
    expect(
      Object.fromEntries(findConflicts([first, second, third, fourth])),
    ).toEqual({ Fourth: { taskId: "Second", title: "Second" } });
  });

  it("needs the same day, not just the same time of day", () => {
    const conflicts = findConflicts([
      item("Mon", "2026-04-27", "09:30"),
      item("Tue", "2026-04-28", "09:30"),
    ]);
    expect(conflicts.size).toBe(0);
  });
});

describe("findRepeatedTimes", () => {
  it("marks rows sharing an earlier row's start, whatever their status", () => {
    const repeated = findRepeatedTimes([
      item("A", "2026-04-26", "09:30", { status: "DONE" }),
      item("B", "2026-04-26", "09:30"),
      item("C", "2026-04-26", "13:00"),
    ]);
    expect([...repeated]).toEqual(["B"]);
  });
});

describe("formatDayLabel", () => {
  const label = (date: string) => formatDayLabel(at(date, "12:00"), NOW, TZ);

  it("uses relative words for today and yesterday", () => {
    expect(label("2026-04-26")).toBe("Today");
    expect(label("2026-04-25")).toBe("Yesterday");
  });

  it("adds the weekday within a week, the year when it differs", () => {
    expect(label("2026-04-28")).toBe("Tue, Apr 28");
    expect(label("2026-04-19")).toBe("Sun, Apr 19");
    expect(label("2026-05-08")).toBe("May 8");
    expect(label("2027-01-05")).toBe("Jan 5, 2027");
  });
});

describe("buildMeta", () => {
  it("Today with the time column: flexibility · duration", () => {
    expect(meta(byTitle("Call the dentist"), true)).toEqual([
      "Fixed",
      "30 min",
    ]);
  });

  it("Today without the column (mobile): time · flexibility · duration", () => {
    expect(meta(byTitle("Call the dentist"))).toEqual([
      "09:30",
      "Fixed",
      "30 min",
    ]);
    expect(meta(byTitle("Drop off the parcel"))).toEqual([
      "09:30",
      "Flexible",
      "15 min",
    ]);
  });

  it("Recurring: ↻ rule · time, no duration; the column drops the time", () => {
    expect(meta(byTitle("English lesson"))).toEqual([
      "↻ Weekly on Thu",
      "18:00",
    ]);
    expect(meta(byTitle("Take Bellara"), true)).toEqual(["↻ Daily"]);
  });

  it("Upcoming / Later: date · time · duration", () => {
    expect(meta(byTitle("Barbería para mi hijo"))).toEqual([
      "Tue, Apr 28",
      "15:35",
      "40 min",
    ]);
    expect(meta(byTitle("MK Кампанар"))).toEqual(["May 8", "18:05"]);
  });

  it("Overdue: Yesterday · time · duration", () => {
    expect(meta(byTitle("Pay the invoice"))).toEqual([
      "Yesterday",
      "18:00",
      "15 min",
    ]);
  });

  it("appends the status note last", () => {
    const base = byTitle("Call the dentist");
    expect(
      buildMeta(
        { ...base, status: "SNOOZED" },
        { timeInColumn: true, ...CONTEXT, nextReminderLabel: "14:15" },
      ),
    ).toEqual(["Fixed", "30 min", "Snoozed — next reminder 14:15"]);
    expect(meta({ ...base, status: "PARTIALLY_DONE" }, true).at(-1)).toBe(
      "Partially done",
    );
    expect(meta({ ...base, status: "SKIPPED" }, true).at(-1)).toBe("Skipped");
    expect(meta({ ...base, status: "DONE" }, true)).toEqual([
      "Fixed",
      "30 min",
    ]);
  });

  it("never produces empty segments", () => {
    for (const task of LIBRARY) {
      for (const timeInColumn of [true, false]) {
        const segments = meta(task, timeInColumn);
        expect(segments.length).toBeGreaterThan(0);
        expect(segments.every((s) => s.trim().length > 0)).toBe(true);
      }
    }
  });
});

describe("canMoveToToday", () => {
  it("only offers the move for an open, past, one-off task", () => {
    const invoice = byTitle("Pay the invoice");
    expect(canMoveToToday(invoice)).toBe(true);
    expect(canMoveToToday({ ...invoice, status: "SNOOZED" })).toBe(true);
    expect(canMoveToToday({ ...invoice, status: "DONE" })).toBe(false);
    expect(canMoveToToday({ ...invoice, status: "PARTIALLY_DONE" })).toBe(
      false,
    );
    expect(canMoveToToday(byTitle("Call the dentist"))).toBe(false);
  });
});

describe("taskSummary", () => {
  it("counts active, recurring and overdue from the data", () => {
    const summary = taskSummary(LIBRARY);
    expect(summary).toEqual({ active: 15, recurring: 6, overdue: 1 });
    expect(formatTaskSummary(summary)).toBe(
      "15 active · 6 recurring · 1 overdue",
    );
  });

  it("counts PARTIALLY_DONE as active but not DONE or SKIPPED", () => {
    const summary = taskSummary([
      item("Partial", "2026-04-25", "09:00", { status: "PARTIALLY_DONE" }),
      item("Done", "2026-04-25", "10:00", { status: "DONE" }),
      item("Skipped", "2026-04-26", "11:00", { status: "SKIPPED" }),
      item("Snoozed", "2026-04-27", "12:00", { status: "SNOOZED" }),
    ]);
    expect(summary).toEqual({ active: 2, recurring: 0, overdue: 1 });
  });

  it("leaves the overdue part out when there's none", () => {
    expect(formatTaskSummary({ active: 2, recurring: 0, overdue: 0 })).toBe(
      "2 active · 0 recurring",
    );
  });
});
