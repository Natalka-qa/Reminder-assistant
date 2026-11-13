import { describe, expect, it } from "vitest";
import {
  cronReminderCutoff,
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

describe("cronReminderCutoff", () => {
  it("is 15 minutes after now", () => {
    expect(cronReminderCutoff(new Date("2026-11-12T17:44:00Z"))).toEqual(
      new Date("2026-11-12T17:59:00Z"),
    );
  });

  it("takes an 18:55 reminder on the 18:44 run, not the 18:59 one", () => {
    const sendAt = new Date("2026-11-12T17:55:00Z");
    expect(sendAt <= cronReminderCutoff(new Date("2026-11-12T17:44:00Z"))).toBe(
      true,
    );
    expect(sendAt <= deliveryCutoff(new Date("2026-11-12T17:44:00Z"))).toBe(
      false,
    );
  });
});
