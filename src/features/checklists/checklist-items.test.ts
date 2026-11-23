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
    expect(splitItems("молоко, хлеб; яйца")).toMatchObject([
      { text: "молоко", note: null },
      { text: "хлеб", note: null },
      { text: "яйца", note: null },
    ]);
  });

  it("takes one item per line and keeps commas inside a line", () => {
    expect(splitItems("Eggs, free range\nBread\n\n")).toMatchObject([
      { text: "Eggs, free range", note: null },
      { text: "Bread", note: null },
    ]);
  });

  it("splits a note off after a spaced dash, not a hyphen", () => {
    expect(splitItems("Milk — 2 l\nSquats - 3×12\nPre-workout")).toMatchObject([
      { text: "Milk", note: "2 l" },
      { text: "Squats", note: "3×12" },
      { text: "Pre-workout", note: null },
    ]);
  });

  it("drops list markers and empty parts", () => {
    expect(
      splitItems("- Passport\n• Charger\n[ ] Socks\n[x] Hat"),
    ).toMatchObject([
      { text: "Passport", note: null },
      { text: "Charger", note: null },
      { text: "Socks", note: null },
      { text: "Hat", note: null },
    ]);
    expect(splitItems(" , ;  ")).toMatchObject([]);
    expect(splitItems("")).toMatchObject([]);
  });

  it("caps how many one message adds", () => {
    expect(
      splitItems(Array.from({ length: 70 }, (_, i) => `i${i}`).join(",")),
    ).toHaveLength(50);
  });

  // sprint-26-tasks.md S26-12
  it("takes a link and a price out of a line", () => {
    expect(
      splitItems("Lego Technic — €49.99 https://www.amazon.es/dp/B0?x=1,2"),
    ).toEqual([
      {
        text: "Lego Technic",
        note: null,
        url: "https://www.amazon.es/dp/B0?x=1,2",
        priceCents: 4999,
      },
    ]);
  });

  it("keeps a decimal comma and a link's commas when splitting one line", () => {
    expect(splitItems("Book 12,50 €, Scarf €20")).toMatchObject([
      { text: "Book", priceCents: 1250 },
      { text: "Scarf", priceCents: 2000 },
    ]);
  });

  it("keeps a note next to a price", () => {
    expect(splitItems("Blood test — fasting — 35 €")).toMatchObject([
      { text: "Blood test", note: "fasting", priceCents: 3500, url: null },
    ]);
  });

  it("needs a currency for a price, so amounts stay notes", () => {
    expect(splitItems("Milk — 2 l\nSquats — 3×12\nVitamin D 1000")).toEqual([
      { text: "Milk", note: "2 l", url: null, priceCents: null },
      { text: "Squats", note: "3×12", url: null, priceCents: null },
      { text: "Vitamin D 1000", note: null, url: null, priceCents: null },
    ]);
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
