import { describe, expect, it } from "vitest";
import {
  buildTasksHref,
  parseTaskQuery,
  parseTaskSort,
  parseTaskTab,
} from "./task-list-params";

describe("parseTaskTab / parseTaskSort", () => {
  it("accepts known values", () => {
    expect(parseTaskTab("recurring")).toBe("recurring");
    expect(parseTaskSort("priority")).toBe("priority");
  });

  it("falls back to All / Smart for missing, unknown or repeated params", () => {
    expect(parseTaskTab(undefined)).toBe("all");
    expect(parseTaskTab("everything")).toBe("all");
    expect(parseTaskTab(["today", "upcoming"])).toBe("all");
    expect(parseTaskSort(undefined)).toBe("smart");
    expect(parseTaskSort("alphabetical")).toBe("smart");
  });
});

describe("parseTaskQuery / buildTasksHref", () => {
  it("reads a single ?q= and trims it", () => {
    expect(parseTaskQuery("  lesson ")).toBe("lesson");
    expect(parseTaskQuery(undefined)).toBe("");
    expect(parseTaskQuery(["a", "b"])).toBe("");
  });

  it("leaves defaults out of the URL", () => {
    expect(buildTasksHref({ tab: "all", sort: "smart", query: "" })).toBe(
      "/tasks",
    );
    expect(buildTasksHref({ tab: "all", sort: "smart", query: "  " })).toBe(
      "/tasks",
    );
  });

  it("keeps tab, sort and query together, encoded", () => {
    expect(
      buildTasksHref({ tab: "today", sort: "priority", query: " пара & co " }),
    ).toBe("/tasks?tab=today&sort=priority&q=%D0%BF%D0%B0%D1%80%D0%B0+%26+co");
  });
});
