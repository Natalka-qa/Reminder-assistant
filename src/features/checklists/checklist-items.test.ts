import { describe, expect, it } from "vitest";
import {
  checklistProgress,
  moveId,
  orderItems,
  progressLabel,
  splitItems,
} from "./checklist-items";

describe("splitItems", () => {
  it("splits one line on commas and semicolons", () => {
    expect(splitItems("молоко, хлеб; яйца")).toEqual([
      { text: "молоко", note: null },
      { text: "хлеб", note: null },
      { text: "яйца", note: null },
    ]);
  });

  it("takes one item per line and keeps commas inside a line", () => {
    expect(splitItems("Eggs, free range\nBread\n\n")).toEqual([
      { text: "Eggs, free range", note: null },
      { text: "Bread", note: null },
    ]);
  });

  it("splits a note off after a spaced dash, not a hyphen", () => {
    expect(splitItems("Milk — 2 l\nSquats - 3×12\nPre-workout")).toEqual([
      { text: "Milk", note: "2 l" },
      { text: "Squats", note: "3×12" },
      { text: "Pre-workout", note: null },
    ]);
  });

  it("drops list markers and empty parts", () => {
    expect(splitItems("- Passport\n• Charger\n[ ] Socks\n[x] Hat")).toEqual([
      { text: "Passport", note: null },
      { text: "Charger", note: null },
      { text: "Socks", note: null },
      { text: "Hat", note: null },
    ]);
    expect(splitItems(" , ;  ")).toEqual([]);
    expect(splitItems("")).toEqual([]);
  });

  it("caps how many one message adds", () => {
    expect(
      splitItems(Array.from({ length: 70 }, (_, i) => `i${i}`).join(",")),
    ).toHaveLength(50);
  });
});

describe("orderItems", () => {
  const at = (n: number) => new Date(2026, 10, 5, 12, n);

  it("puts unchecked first, each group by its order", () => {
    const items = [
      { id: "a", checked: true, sortOrder: 0, createdAt: at(0) },
      { id: "b", checked: false, sortOrder: 2, createdAt: at(1) },
      { id: "c", checked: false, sortOrder: 1, createdAt: at(2) },
      { id: "d", checked: true, sortOrder: 0, createdAt: at(3) },
    ];
    expect(orderItems(items).map((item) => item.id)).toEqual([
      "c",
      "b",
      "a",
      "d",
    ]);
  });
});

describe("checklistProgress / progressLabel", () => {
  it("counts checked of all", () => {
    const progress = checklistProgress([
      { checked: true },
      { checked: false },
      { checked: true },
    ]);
    expect(progress).toEqual({ done: 2, total: 3 });
    expect(progressLabel(progress)).toBe("2/3");
  });

  it("calls an empty list empty", () => {
    expect(progressLabel(checklistProgress([]))).toBe("Empty");
  });
});

describe("moveId", () => {
  it("moves an id to a new place, clamped", () => {
    expect(moveId(["a", "b", "c", "d"], "a", 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveId(["a", "b", "c"], "c", 0)).toEqual(["c", "a", "b"]);
    expect(moveId(["a", "b", "c"], "a", 99)).toEqual(["b", "c", "a"]);
    expect(moveId(["a", "b"], "x", 0)).toEqual(["a", "b"]);
  });
});
