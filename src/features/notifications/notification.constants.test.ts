import { describe, expect, it } from "vitest";
import { staleNotificationCutoff } from "./notification.constants";

describe("staleNotificationCutoff", () => {
  it("is 24 hours before now", () => {
    expect(staleNotificationCutoff(new Date("2026-11-01T08:00:00Z"))).toEqual(
      new Date("2026-10-31T08:00:00Z"),
    );
  });
});
