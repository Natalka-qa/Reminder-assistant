import { describe, expect, it } from "vitest";
import {
  deliveryCutoff,
  staleNotificationCutoff,
} from "./notification.constants";

describe("staleNotificationCutoff", () => {
  it("is 24 hours before now", () => {
    expect(staleNotificationCutoff(new Date("2026-11-01T08:00:00Z"))).toEqual(
      new Date("2026-10-31T08:00:00Z"),
    );
  });
});

describe("deliveryCutoff", () => {
  it("is 2 minutes after now", () => {
    expect(deliveryCutoff(new Date("2026-11-12T06:59:00Z"))).toEqual(
      new Date("2026-11-12T07:01:00Z"),
    );
  });
});
