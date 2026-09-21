import { describe, expect, it } from "vitest";
import {
  buildCollisionSuggestion,
  buildInsightBody,
  countOverlappingToday,
  formatRelativeTimeLabel,
  groupRemainingByTime,
  latestOccurrenceEnd,
  selectUpNext,
  type HomeOccurrence,
} from "./home-view";

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

describe("buildInsightBody", () => {
  it("computes fixed/flexible counts and mentions overlap and evening-free", () => {
    const occurrences: HomeOccurrence[] = [
      occurrence("a", 9, 0, {
        task: {
          id: "ta",
          title: "A",
          flexibility: "FIXED",
          priority: "NORMAL",
          durationMinutes: 30,
        },
      }),
      occurrence("b", 10, 0),
    ];
    const body = buildInsightBody(occurrences, 2, "18:00");
    expect(body).toBe(
      "One fixed task, one flexible one. Two of them overlap. Your evening is free after 18:00.",
    );
  });

  it("omits the overlap/evening sentences when there's nothing to say", () => {
    const body = buildInsightBody([occurrence("a", 9, 0)], 0, null);
    expect(body).toBe("No fixed tasks, one flexible one.");
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
