import { describe, expect, it } from "vitest";
import { parseTask } from "./index";
import { splitTaskPhrase } from "./split";

describe("splitTaskPhrase", () => {
  it("splits a repeat with a different time on each day", () => {
    expect(splitTaskPhrase("Dance every Mon at 19 and Wed at 20")).toEqual([
      "Dance every Mon at 19",
      "Dance every Wed at 20",
    ]);
    expect(
      splitTaskPhrase("Dance every Mon at 19, every Wed at 20 for 1 hour"),
    ).toEqual([
      "Dance every Mon at 19 for 1 hour",
      "Dance every Wed at 20 for 1 hour",
    ]);
  });

  it("splits Russian and Ukrainian too", () => {
    expect(splitTaskPhrase("Танцы по пн в 19 и по ср в 20")).toEqual([
      "Танцы по пн в 19",
      "Танцы по ср в 20",
    ]);
    expect(splitTaskPhrase("Танці по пн о 19 та ср о 20")).toEqual([
      "Танці по пн о 19",
      "Танці по ср о 20",
    ]);
  });

  it("gives sentences parseTask reads as one task each", () => {
    const [monday, wednesday] = splitTaskPhrase(
      "Dance every Mon at 19 and Wed at 20",
    )!.map((sentence) => parseTask(sentence, "2026-10-01"));
    expect(monday).toMatchObject({
      title: "Dance",
      repeat: "WEEKLY",
      repeatDays: [1],
      time: "19:00",
    });
    expect(wednesday).toMatchObject({
      title: "Dance",
      repeat: "WEEKLY",
      repeatDays: [3],
      time: "20:00",
    });
  });

  it("leaves anything else as it is", () => {
    for (const text of [
      "Dance every Mon at 19",
      "Dance every mon and wed at 19",
      "Call mom tomorrow at 18",
      // No "every"/"on" before the first day: not clearly a repeat.
      "Dance Mon at 19 and Wed at 20",
      // Something else between the pairs.
      "Gym every Mon at 7 then shower on Wed at 8 maybe",
    ]) {
      expect(splitTaskPhrase(text)).toBeNull();
    }
  });
});

describe("a bare hour after the day (по средам 19)", () => {
  it("splits and reads it as the time", () => {
    expect(splitTaskPhrase("танцы по средам 19 и пятницам в 20")).toEqual([
      "танцы по средам 19",
      "танцы по пятницам в 20",
    ]);
  });
});
