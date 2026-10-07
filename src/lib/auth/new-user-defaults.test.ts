import { describe, expect, it } from "vitest";
import { newUserDefaults } from "./new-user-defaults";

describe("newUserDefaults", () => {
  it("starts email reminders off while email reaches only the owner", () => {
    expect(newUserDefaults(false)).toEqual({ emailRemindersEnabled: false });
  });

  it("keeps the column defaults once email reaches anyone", () => {
    expect(newUserDefaults(true)).toEqual({});
  });
});
