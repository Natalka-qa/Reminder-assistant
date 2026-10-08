import { describe, expect, it } from "vitest";
import { backTarget, isNestedPath, nextDepth } from "./back-target";

describe("isNestedPath", () => {
  it.each([
    "/tasks/abc",
    "/tasks/abc/edit",
    "/tasks/new",
    "/inbox",
    "/progress/habits/new",
    "/progress/habits/abc",
  ])("%s is nested — Back is shown", (path) => {
    expect(isNestedPath(path)).toBe(true);
  });

  it.each([
    "/dashboard",
    "/tasks",
    "/calendar",
    "/progress",
    "/settings",
    "/",
    "/telegram",
  ])("%s is top level — no Back", (path) => {
    expect(isNestedPath(path)).toBe(false);
  });

  it("ignores a trailing slash", () => {
    expect(isNestedPath("/tasks/abc/")).toBe(true);
    expect(isNestedPath("/tasks/")).toBe(false);
  });

  it("doesn't treat unknown deeper task paths as nested pages", () => {
    expect(isNestedPath("/tasks/abc/other")).toBe(false);
    expect(isNestedPath("/tasks/abc/edit/more")).toBe(false);
  });
});

describe("backTarget", () => {
  it.each([
    ["/tasks/abc", "/tasks"],
    ["/tasks/abc/edit", "/tasks/abc"],
    ["/tasks/new", "/dashboard"],
    ["/inbox", "/settings"],
    ["/settings/day", "/settings"],
    ["/progress/habits/new", "/progress"],
    ["/progress/how", "/progress"],
    ["/progress/habits/abc", "/progress"],
  ])("%s falls back to %s without history", (path, parent) => {
    expect(backTarget(path)).toBe(parent);
  });

  it("is null on a top-level page", () => {
    expect(backTarget("/calendar")).toBeNull();
  });
});

describe("nextDepth", () => {
  it("starts at 0 on the first page", () => {
    expect(nextDepth(-1, false)).toBe(0);
    expect(nextDepth(-1, true)).toBe(0);
  });

  it("counts steps in and back out, never below 0", () => {
    // Opened on a task (0) → Edit (1) → Back (0) → Back has no history.
    let depth = nextDepth(-1, false);
    depth = nextDepth(depth, false);
    expect(depth).toBe(1);
    depth = nextDepth(depth, true);
    expect(depth).toBe(0);
    expect(nextDepth(depth, true)).toBe(0);
  });
});
