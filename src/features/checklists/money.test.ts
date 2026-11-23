import { describe, expect, it } from "vitest";
import {
  checklistTotals,
  formatMoney,
  normalizeUrl,
  parsePrice,
  takeExtras,
  totalsLabel,
  urlLabel,
} from "./money";

// sprint-26-tasks.md S26-12
describe("parsePrice", () => {
  it("reads prices as people type them", () => {
    expect(parsePrice("49")).toBe(4900);
    expect(parsePrice("49.99")).toBe(4999);
    expect(parsePrice("49,99")).toBe(4999);
    expect(parsePrice("€ 12.5")).toBe(1250);
    expect(parsePrice("1 299")).toBe(129900);
    expect(parsePrice("1,299.50")).toBe(129950);
    expect(parsePrice("300 грн")).toBe(30000);
  });

  it("empty is no price; anything else is not a price", () => {
    expect(parsePrice("  ")).toBeNull();
    expect(parsePrice("abc")).toBeNaN();
    expect(parsePrice("12.345")).toBeNaN();
    expect(parsePrice("-5")).toBeNaN();
  });
});

describe("formatMoney", () => {
  it("drops cents from whole amounts", () => {
    expect(formatMoney(4999, "EUR")).toBe("€49.99");
    expect(formatMoney(5000, "EUR")).toBe("€50");
    expect(formatMoney(129900, "UAH")).toBe("₴1,299");
    expect(formatMoney(2000, "USD")).toBe("$20");
  });
});

describe("takeExtras", () => {
  it("leaves a line without link or price as it is", () => {
    expect(takeExtras("Milk — 2 l")).toEqual({
      rest: "Milk — 2 l",
      url: null,
      priceCents: null,
    });
  });

  it("drops trailing punctuation from a link", () => {
    expect(takeExtras("See (https://lab.es/tests).").url).toBe(
      "https://lab.es/tests",
    );
  });
});

describe("links", () => {
  it("adds https to a bare address and shows the host", () => {
    expect(normalizeUrl("amazon.es/x")).toBe("https://amazon.es/x");
    expect(normalizeUrl("http://a.b")).toBe("http://a.b");
    expect(urlLabel("https://www.amazon.es/dp/1")).toBe("amazon.es");
  });
});

describe("checklistTotals", () => {
  const items = [
    { priceCents: 4999, checked: true },
    { priceCents: 2000, checked: false },
    { priceCents: null, checked: false },
  ];

  it("sums all priced items and the unchecked ones", () => {
    expect(checklistTotals(items)).toEqual({ total: 6999, left: 2000 });
    expect(checklistTotals([{ priceCents: null, checked: false }])).toBeNull();
  });

  it("labels them", () => {
    expect(totalsLabel({ total: 6999, left: 2000 }, "EUR")).toBe(
      "Total €69.99 · Left €20",
    );
    expect(totalsLabel({ total: 6999, left: 6999 }, "EUR")).toBe(
      "Total €69.99",
    );
    expect(totalsLabel({ total: 6999, left: 0 }, "EUR")).toBe(
      "Total €69.99 · all done",
    );
  });
});
