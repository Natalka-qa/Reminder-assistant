import { describe, expect, it } from "vitest";
import {
  buildCollisionSuggestion,
  busyRowsForToday,
  countOverlappingToday,
  findMoveTime,
  formatRelativeTimeLabel,
  groupRemainingByTime,
  latestOccurrenceEnd,
  mergeTimeline,
  patternInsight,
  selectUpNext,
  untimedRemaining,
  withoutRemoved,
  type HomeOccurrence,
} from "./home-view";
import type { OccurrenceStatus } from "@/lib/db/types";
import {
  DEFAULT_SCHEDULE_PREFERENCES,
  type SchedulePreferences,
} from "@/lib/validation/user";

function occurrence(
  id: string,
  hour: number,
  minute: number,
  overrides: Partial<HomeOccurrence> = {},
): HomeOccurrence {
  return {
    id,
    status: "SCHEDULED",
    scheduledStart: new Date(Date.UTC(2026, 3, 26, hour, minute)),
    task: {
      id: `task-${id}`,
      title: `Task ${id}`,
      flexibility: "FLEXIBLE",
      priority: "NORMAL",
      durationMinutes: 30,
    },
    ...overrides,
  };
}

const NINE_AM = new Date(Date.UTC(2026, 3, 26, 9, 0));

describe("selectUpNext", () => {
  it("picks the earliest open occurrence at or after 09:00", () => {
    const occurrences = [
      occurrence("early", 7, 0),
      occurrence("a", 9, 30),
      occurrence("b", 11, 0),
    ];
    const result = selectUpNext(occurrences, NINE_AM);
    expect(result?.primary.id).toBe("a");
  });

  it("skips completed/skipped occurrences", () => {
    const occurrences = [
      occurrence("done", 9, 30, { status: "DONE" }),
      occurrence("open", 10, 0),
    ];
    const result = selectUpNext(occurrences, NINE_AM);
    expect(result?.primary.id).toBe("open");
  });

  it("prefers Fixed over Flexible on an exact time tie", () => {
    const occurrences = [
      occurrence("flex", 9, 30, {
        task: {
          id: "t-flex",
          title: "Flex",
          flexibility: "FLEXIBLE",
          priority: "NORMAL",
          durationMinutes: 30,
        },
      }),
      occurrence("fixed", 9, 30, {
        task: {
          id: "t-fixed",
          title: "Fixed",
          flexibility: "FIXED",
          priority: "NORMAL",
          durationMinutes: 30,
        },
      }),
    ];
    const result = selectUpNext(occurrences, NINE_AM);
    expect(result?.primary.id).toBe("fixed");
    expect(result?.alsoNow.map((o) => o.id)).toEqual(["flex"]);
  });

  it("falls back to the earliest open occurrence when none is at/after 09:00", () => {
    const occurrences = [occurrence("early", 6, 0), occurrence("also", 7, 0)];
    const result = selectUpNext(occurrences, NINE_AM);
    expect(result?.primary.id).toBe("early");
  });

  it("falls back to the day's last occurrence when everything is resolved", () => {
    const occurrences = [
      occurrence("first", 8, 0, { status: "DONE" }),
      occurrence("last", 12, 0, { status: "SKIPPED" }),
    ];
    const result = selectUpNext(occurrences, NINE_AM);
    expect(result?.primary.id).toBe("last");
    expect(result?.alsoNow).toEqual([]);
  });

  it("returns null for an empty day", () => {
    expect(selectUpNext([], NINE_AM)).toBeNull();
  });
});

describe("groupRemainingByTime", () => {
  it("groups occurrences by exact scheduledStart, excluding given ids", () => {
    const a = occurrence("a", 10, 0);
    const b = occurrence("b", 11, 0);
    const c = occurrence("c", 11, 0);
    const groups = groupRemainingByTime([a, b, c], new Set(["a"]));

    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((o) => o.id)).toEqual(["b", "c"]);
    expect(groups[0].hasActiveOverlap).toBe(true);
  });

  it("does not flag a group as overlapping when only one item is still open", () => {
    const b = occurrence("b", 11, 0, { status: "DONE" });
    const c = occurrence("c", 11, 0);
    const groups = groupRemainingByTime([b, c], new Set());
    expect(groups[0].hasActiveOverlap).toBe(false);
  });

  it("returns groups sorted by time", () => {
    const groups = groupRemainingByTime(
      [occurrence("late", 15, 0), occurrence("early", 9, 0)],
      new Set(),
    );
    expect(groups.map((g) => g.items[0].id)).toEqual(["early", "late"]);
  });
});

describe("formatRelativeTimeLabel", () => {
  const now = new Date(Date.UTC(2026, 3, 26, 9, 0));

  it("returns 'now' for a time at or before now", () => {
    expect(formatRelativeTimeLabel(now, now)).toBe("now");
  });

  it("formats minutes for under an hour away", () => {
    const target = new Date(now.getTime() + 20 * 60_000);
    expect(formatRelativeTimeLabel(target, now)).toBe("in 20 minutes");
  });

  it("formats hours for an hour or more away", () => {
    const target = new Date(now.getTime() + 125 * 60_000);
    expect(formatRelativeTimeLabel(target, now)).toBe("in 2 hours");
  });
});

describe("countOverlappingToday", () => {
  it("counts the up-next collision and any overlapping timeline groups", () => {
    const primary = occurrence("p", 9, 30);
    const also = occurrence("a", 9, 30);
    const groupA = groupRemainingByTime(
      [occurrence("x", 13, 0), occurrence("y", 13, 0)],
      new Set(),
    );
    const count = countOverlappingToday({ primary, alsoNow: [also] }, groupA);
    expect(count).toBe(4);
  });

  it("is zero with no collisions", () => {
    expect(countOverlappingToday(null, [])).toBe(0);
  });
});

describe("patternInsight", () => {
  // occurrence() builds 2026-04-26 at the given UTC hour; UTC keeps the
  // local hour the same.
  const LATE = { part: "late" as const, percent: 33 };

  it("counts today's open tasks in the weak part of the day", () => {
    const today = [
      occurrence("a", 21, 0),
      occurrence("b", 22, 30, { status: "SNOOZED" }),
      occurrence("c", 9, 0),
    ];
    expect(patternInsight(LATE, today, "UTC")).toBe(
      "You finish 33% of tasks after 20:00 — two of today's are that late.",
    );
  });

  it("says 'then' for the other parts of the day", () => {
    expect(
      patternInsight(
        { part: "afternoon", percent: 40 },
        [occurrence("a", 14, 0)],
        "UTC",
      ),
    ).toBe(
      "You finish 40% of tasks in the afternoon — one of today's is then.",
    );
  });

  it("stays quiet when those tasks are done or there's no weak part", () => {
    expect(
      patternInsight(LATE, [occurrence("a", 21, 0, { status: "DONE" })], "UTC"),
    ).toBeNull();
    expect(patternInsight(LATE, [occurrence("a", 9, 0)], "UTC")).toBeNull();
    expect(patternInsight(null, [occurrence("a", 21, 0)], "UTC")).toBeNull();
  });

  it("reads the hour in the user's timezone", () => {
    // 18:30 UTC is 20:30 in Madrid (CEST, UTC+2) in April.
    expect(
      patternInsight(LATE, [occurrence("a", 18, 30)], "Europe/Madrid"),
    ).not.toBeNull();
    expect(patternInsight(LATE, [occurrence("a", 18, 30)], "UTC")).toBeNull();
  });
});

describe("latestOccurrenceEnd", () => {
  it("returns the latest scheduledStart + duration", () => {
    const end = latestOccurrenceEnd([
      occurrence("a", 9, 0, {
        task: {
          id: "ta",
          title: "A",
          flexibility: "FLEXIBLE",
          priority: "NORMAL",
          durationMinutes: 30,
        },
      }),
      occurrence("b", 12, 0, {
        task: {
          id: "tb",
          title: "B",
          flexibility: "FLEXIBLE",
          priority: "NORMAL",
          durationMinutes: 60,
        },
      }),
    ]);
    expect(end).toEqual(new Date(Date.UTC(2026, 3, 26, 13, 0)));
  });

  it("returns null for no occurrences", () => {
    expect(latestOccurrenceEnd([])).toBeNull();
  });

  it("takes a day's own end over the task's duration", () => {
    // sprint-19-tasks.md п.7 — one day of a series made 2 h long.
    const end = latestOccurrenceEnd([
      occurrence("a", 12, 0, {
        scheduledEnd: new Date(Date.UTC(2026, 3, 26, 14, 0)),
      }),
    ]);
    expect(end).toEqual(new Date(Date.UTC(2026, 3, 26, 14, 0)));
  });

  const at = (hour: number, minute = 0) =>
    new Date(Date.UTC(2026, 3, 26, hour, minute));

  it("ends after Google busy time that runs later than the tasks", () => {
    expect(
      latestOccurrenceEnd(
        [occurrence("a", 9, 0)],
        [{ start: at(18), end: at(20), allDay: false }],
      ),
    ).toEqual(at(20));
  });

  it("keeps the tasks' end when busy time is earlier or all day", () => {
    expect(
      latestOccurrenceEnd(
        [occurrence("a", 9, 0)],
        [
          { start: at(7), end: at(8), allDay: false },
          { start: at(0), end: at(24), allDay: true },
        ],
      ),
    ).toEqual(at(9, 30));
  });
});

describe("busyRowsForToday", () => {
  const at = (day: number, hour: number, minute = 0) =>
    new Date(Date.UTC(2026, 9, day, hour, minute));
  const DAY = { dayStart: at(2, 0), dayEnd: at(3, 0), now: at(2, 11) };

  it("keeps what isn't over yet, merged and in order", () => {
    expect(
      busyRowsForToday(
        [
          { start: at(2, 15), end: at(2, 16) },
          { start: at(2, 9), end: at(2, 10) }, // over
          { start: at(2, 10, 30), end: at(2, 11, 30) }, // still on
          { start: at(2, 15, 30), end: at(2, 17) },
        ],
        DAY,
      ),
    ).toEqual([
      { start: at(2, 10, 30), end: at(2, 11, 30), allDay: false },
      { start: at(2, 15), end: at(2, 17), allDay: false },
    ]);
  });

  it("cuts intervals to today and drops other days", () => {
    expect(
      busyRowsForToday(
        [
          { start: at(2, 22), end: at(3, 1) },
          { start: at(3, 9), end: at(3, 10) },
          { start: at(1, 9), end: at(1, 10) },
        ],
        DAY,
      ),
    ).toEqual([{ start: at(2, 22), end: at(3, 0), allDay: false }]);
  });

  it("is a single all-day row when the whole day is busy", () => {
    expect(
      busyRowsForToday(
        [
          { start: at(2, 15), end: at(2, 16) },
          { start: at(1, 0), end: at(4, 0) },
        ],
        DAY,
      ),
    ).toEqual([{ start: at(2, 0), end: at(3, 0), allDay: true }]);
  });
});

describe("mergeTimeline", () => {
  const at = (hour: number) => new Date(Date.UTC(2026, 9, 2, hour));
  const group = (hour: number) => ({
    when: at(hour),
    items: [hour],
    hasActiveOverlap: false,
  });
  const busy = (from: number, to: number, allDay = false) => ({
    start: at(from),
    end: at(to),
    allDay,
  });

  it("orders groups and busy rows by start, busy first on a tie", () => {
    const entries = mergeTimeline(
      [group(14), group(10)],
      [busy(14, 15), busy(12, 13)],
    );
    expect(
      entries.map((e) =>
        e.kind === "busy"
          ? `busy ${e.row.start.getUTCHours()}`
          : `tasks ${e.group.when.getUTCHours()}`,
      ),
    ).toEqual(["tasks 10", "busy 12", "busy 14", "tasks 14"]);
  });

  it("puts busy all day first", () => {
    const [first] = mergeTimeline([group(7)], [busy(0, 24, true)]);
    expect(first.kind).toBe("busy");
  });
});

describe("buildCollisionSuggestion", () => {
  it("suggests moving the flexible task out of an up-next collision", () => {
    const fixed = occurrence("fixed", 9, 30, {
      task: {
        id: "t-fixed",
        title: "Fixed",
        flexibility: "FIXED",
        priority: "NORMAL",
        durationMinutes: 30,
      },
    });
    const flex = occurrence("flex", 9, 30);
    const suggestion = buildCollisionSuggestion(
      { primary: fixed, alsoNow: [flex] },
      [],
    );
    expect(suggestion?.anchor.id).toBe("fixed");
    expect(suggestion?.movable.id).toBe("flex");
  });

  it("returns null when both colliding tasks are fixed", () => {
    const a = occurrence("a", 9, 30, {
      task: {
        id: "ta",
        title: "A",
        flexibility: "FIXED",
        priority: "NORMAL",
        durationMinutes: 30,
      },
    });
    const b = occurrence("b", 9, 30, {
      task: {
        id: "tb",
        title: "B",
        flexibility: "FIXED",
        priority: "NORMAL",
        durationMinutes: 30,
      },
    });
    expect(
      buildCollisionSuggestion({ primary: a, alsoNow: [b] }, []),
    ).toBeNull();
  });

  it("falls back to a colliding timeline group when up-next has no collision", () => {
    const groups = groupRemainingByTime(
      [
        occurrence("x", 13, 0, {
          task: {
            id: "tx",
            title: "X",
            flexibility: "FIXED",
            priority: "NORMAL",
            durationMinutes: 60,
          },
        }),
        occurrence("y", 13, 0),
      ],
      new Set(),
    );
    const suggestion = buildCollisionSuggestion(null, groups);
    expect(suggestion?.anchor.id).toBe("x");
    expect(suggestion?.movable.id).toBe("y");
  });

  it("returns null with no collisions anywhere", () => {
    expect(buildCollisionSuggestion(null, [])).toBeNull();
  });
});

describe("findMoveTime", () => {
  // UTC, so the hours below are the user's own; Tue Sep 29 is a work day.
  const TZ = "UTC";
  const TUESDAY = "2026-09-29";
  const at = (hour: number, minute = 0) =>
    new Date(Date.UTC(2026, 8, 29, hour, minute));
  const EARLY = at(0);
  const NO_WORK: SchedulePreferences = {
    ...DEFAULT_SCHEDULE_PREFERENCES,
    workDays: [],
  };

  function task(
    id: string,
    hour: number,
    {
      title = `Task ${id}`,
      flexibility = "FLEXIBLE",
      status = "SCHEDULED",
    }: Partial<{
      title: string;
      flexibility: HomeOccurrence["task"]["flexibility"];
      status: HomeOccurrence["status"];
    }> = {},
  ): HomeOccurrence {
    return {
      id,
      status,
      scheduledStart: at(hour),
      scheduledEnd: at(hour + 1),
      task: {
        id: `task-${id}`,
        title,
        flexibility,
        priority: "NORMAL",
        durationMinutes: 60,
      },
    };
  }

  function moveTime(
    anchor: HomeOccurrence,
    movable: HomeOccurrence,
    others: HomeOccurrence[] = [],
    {
      now = EARLY,
      preferences = NO_WORK,
      externalBusy = [] as { start: Date; end: Date }[],
    } = {},
  ) {
    return findMoveTime({ anchor, movable }, [anchor, movable, ...others], {
      today: TUESDAY,
      now,
      timezone: TZ,
      preferences,
      externalBusy,
    });
  }

  const fixedAt = (hour: number) =>
    task("anchor", hour, { title: "Dentist", flexibility: "FIXED" });

  it("skips a task that starts as the anchor ends", () => {
    // The plan's case: anchor 13:00–14:00, another task 14:00–15:00.
    expect(
      moveTime(fixedAt(13), task("movable", 13), [task("next", 14)]),
    ).toEqual(at(15));
  });

  it("doesn't count the task itself or ones already done", () => {
    expect(
      moveTime(fixedAt(13), task("movable", 13), [
        task("done", 14, { status: "DONE" }),
      ]),
    ).toEqual(at(14));
  });

  it("is never in the past", () => {
    expect(
      moveTime(fixedAt(13), task("movable", 13), [], { now: at(16, 10) }),
    ).toEqual(at(16, 15));
  });

  it("keeps to the user's day, and gives up when nothing is left", () => {
    expect(moveTime(fixedAt(20), task("movable", 20))).toBeNull();
    expect(
      moveTime(fixedAt(20), task("movable", 20), [], {
        preferences: { ...NO_WORK, dayEndMinutes: 22 * 60 },
      }),
    ).toEqual(at(21));
  });

  it("stays out of work hours unless the task reads as remote", () => {
    const preferences = DEFAULT_SCHEDULE_PREFERENCES; // Mon–Fri 09:00–17:00
    const groceries = task("movable", 10, { title: "Buy groceries" });
    const call = task("movable", 10, { title: "Call the bank" });
    expect(moveTime(fixedAt(10), groceries, [], { preferences })).toEqual(
      at(17),
    );
    expect(moveTime(fixedAt(10), call, [], { preferences })).toEqual(at(11));
  });

  it("doesn't move a task into Google busy time", () => {
    // Meeting 14:00–15:30 in Google: the first free hour is 15:30.
    expect(
      moveTime(fixedAt(13), task("movable", 13), [], {
        externalBusy: [{ start: at(14), end: at(15, 30) }],
      }),
    ).toEqual(at(15, 30));
  });

  it("gives up on a day busy all day in Google", () => {
    expect(
      moveTime(fixedAt(13), task("movable", 13), [], {
        externalBusy: [{ start: at(0), end: at(24) }],
      }),
    ).toBeNull();
  });

  it("starts a workout by the user's limit", () => {
    const gym = task("movable", 19, { title: "Gym" });
    expect(moveTime(fixedAt(19), gym)).toEqual(at(20));
    expect(
      moveTime(fixedAt(19), gym, [], {
        preferences: { ...NO_WORK, workoutLatestStartMinutes: 19 * 60 + 30 },
      }),
    ).toBeNull();
  });
});

describe("withoutRemoved", () => {
  it("leaves out a day removed from a repeating task, keeps the rest", () => {
    const day = (id: string, status: OccurrenceStatus) => ({ id, status });
    expect(
      withoutRemoved([
        day("a", "SCHEDULED"),
        day("b", "CANCELLED"),
        day("c", "DONE"),
        day("d", "SKIPPED"),
      ]).map((o) => o.id),
    ).toEqual(["a", "c", "d"]);
  });
});

describe("tasks without a time (sprint-18-tasks.md п.17)", () => {
  const untimed = (id: string) =>
    occurrence(id, 0, 0, {
      task: {
        id: `task-${id}`,
        title: `Task ${id}`,
        flexibility: "FLEXIBLE",
        priority: "NORMAL",
        durationMinutes: 0,
        hasTime: false,
      },
    });
  const nine = new Date(Date.UTC(2026, 3, 26, 9, 0));

  it("puts a timed task in Up next before any untimed one", () => {
    const upNext = selectUpNext(
      [untimed("milk"), untimed("plan"), occurrence("gym", 18, 0)],
      nine,
    );
    expect(upNext?.primary.id).toBe("gym");
    expect(upNext?.alsoNow).toEqual([]);
  });

  it("falls back to an untimed task once nothing timed is left open", () => {
    const upNext = selectUpNext(
      [
        untimed("milk"),
        untimed("plan"),
        occurrence("gym", 18, 0, { status: "DONE" }),
      ],
      nine,
    );
    expect(upNext?.primary.id).toBe("milk");
    // Other untimed tasks share its midnight but aren't "also now".
    expect(upNext?.alsoNow).toEqual([]);
  });

  it("keeps untimed tasks out of the time groups, in their own block", () => {
    const all = [untimed("milk"), untimed("plan"), occurrence("gym", 18, 0)];
    const groups = groupRemainingByTime(all, new Set(["gym"]));
    expect(groups).toEqual([]);
    expect(untimedRemaining(all, new Set(["gym"])).map((o) => o.id)).toEqual([
      "milk",
      "plan",
    ]);
    expect(countOverlappingToday(null, groups)).toBe(0);
  });

  it("has no evening-free time with only untimed tasks", () => {
    expect(latestOccurrenceEnd([untimed("milk")])).toBeNull();
    expect(
      latestOccurrenceEnd([untimed("milk"), occurrence("gym", 18, 0)]),
    ).toEqual(new Date(Date.UTC(2026, 3, 26, 18, 30)));
  });
});
