import { describe, expect, it } from "vitest";
import { habitInvite, isInviteHidden } from "./habit-invite";

describe("habitInvite", () => {
  it("stays the same all day and varies across days", () => {
    expect(habitInvite("u", "2026-10-08")).toEqual(
      habitInvite("u", "2026-10-08"),
    );
    const questions = new Set(
      Array.from(
        { length: 20 },
        (_, i) =>
          habitInvite("u", `2026-10-${String(i + 1).padStart(2, "0")}`)
            .question,
      ),
    );
    expect(questions.size).toBeGreaterThan(2);
  });
});

describe("isInviteHidden", () => {
  it("hides until the date, then shows again", () => {
    expect(isInviteHidden("2026-10-22", "2026-10-08")).toBe(true);
    expect(isInviteHidden("2026-10-22", "2026-10-22")).toBe(false);
    expect(isInviteHidden(undefined, "2026-10-08")).toBe(false);
    expect(isInviteHidden("garbage", "2026-10-08")).toBe(false);
  });
});
