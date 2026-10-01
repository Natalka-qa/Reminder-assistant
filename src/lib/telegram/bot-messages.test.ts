import { describe, expect, it } from "vitest";
import {
  buttonResultMessage,
  createdMessage,
  nextMessage,
  createdButtons,
  occurrenceButtons,
  replyKeyboard,
  summaryButtons,
  todayMessage,
  type DayItem,
  type InlineKeyboard,
  openAppButton,
} from "./bot-messages";
import { CALLBACK_DATA_MAX_BYTES, parseButtonData } from "./button-data";

const gym: DayItem = {
  time: "18:00",
  title: "Gym",
  durationMinutes: 60,
  status: "open",
};

describe("todayMessage", () => {
  it("lists the day with status marks and the overdue count", () => {
    expect(
      todayMessage(
        "Wed, Sep 30",
        [
          { time: "08:30", title: "Pills", durationMinutes: 0, status: "done" },
          { time: null, title: "Read", durationMinutes: 30, status: "open" },
          { ...gym, status: "skipped" },
        ],
        2,
      ),
    ).toBe(
      [
        "Today · Wed, Sep 30",
        "2 overdue tasks",
        "",
        "✓ 08:30 · Pills",
        "Anytime · Read · 30 min",
        "· skipped · 18:00 · Gym · 1h",
      ].join("\n"),
    );
  });

  it("says so when the day is empty", () => {
    expect(todayMessage("Wed, Sep 30", [], 0)).toBe(
      "Today · Wed, Sep 30\n\nNothing planned for today.",
    );
    expect(todayMessage("Wed, Sep 30", [], 1)).toContain("1 overdue task\n");
  });
});

describe("nextMessage", () => {
  it("shows the next task or a clear day", () => {
    expect(nextMessage(gym)).toBe("Up next\n\n18:00 · Gym · 1h");
    expect(nextMessage(null)).toBe("Nothing left for today.");
  });
});

describe("createdMessage", () => {
  it("shows what was added and when, then the notices", () => {
    expect(
      createdMessage(
        {
          title: "Call mom",
          dateLabel: "Thu, Oct 1",
          time: "18:00",
          durationMinutes: 0,
          repeatLabel: null,
        },
        ["Overlaps with Gym at 18:00."],
      ),
    ).toBe("Added: Call mom · Thu, Oct 1 · 18:00\nOverlaps with Gym at 18:00.");
  });

  it("includes duration and repeat when there are any", () => {
    expect(
      createdMessage(
        {
          title: "Gym",
          dateLabel: "Mon, Oct 5",
          time: null,
          durationMinutes: 90,
          repeatLabel: "Every Mon, Wed",
        },
        [],
      ),
    ).toBe("Added: Gym · Mon, Oct 5 · Anytime · 1h 30min · Every Mon, Wed");
  });
});

describe("buttonResultMessage", () => {
  it("adds the outcome under the original message", () => {
    const original = "Gym is scheduled for 18:00 (60 min).";
    expect(buttonResultMessage(original, { action: "done" })).toBe(
      `${original}\n\n✓ Done`,
    );
    expect(
      buttonResultMessage(original, { action: "snooze15", until: "18:15" }),
    ).toBe(`${original}\n\nSnoozed until 18:15`);
    expect(buttonResultMessage(original, { action: "skip" })).toContain(
      "Skipped",
    );
    expect(buttonResultMessage(original, { action: "undo" })).toContain(
      "Removed",
    );
    expect(buttonResultMessage(original, { action: "remove" })).toContain(
      "Removed this one",
    );
  });
});

describe("openAppButton", () => {
  it("opens the path as the Mini App, signed in through /telegram", () => {
    expect(
      openAppButton("Open", "https://reminder.example", "/tasks/abc"),
    ).toEqual({
      text: "Open",
      web_app: {
        url: "https://reminder.example/telegram?callbackUrl=%2Ftasks%2Fabc",
      },
    });
  });

  it("keeps a query in the path inside callbackUrl", () => {
    const button = openAppButton(
      "Open New task",
      "https://reminder.example",
      "/tasks/new?date=2026-10-02",
    );
    if (!("web_app" in button)) throw new Error("expected a web_app button");
    const url = new URL(button.web_app.url);
    expect(url.pathname).toBe("/telegram");
    expect(url.searchParams.get("callbackUrl")).toBe(
      "/tasks/new?date=2026-10-02",
    );
  });

  it("stays a plain link on http — Telegram rejects non-https Mini Apps", () => {
    expect(
      openAppButton("Open", "http://localhost:3000", "/tasks/abc"),
    ).toEqual({ text: "Open", url: "http://localhost:3000/tasks/abc" });
  });
});

describe("buttons", () => {
  const id = "cmu8a559u0027bo9cfuks9po3";
  const appUrl = "https://example.test";
  const taskId = "task1";
  const open = {
    text: "Open",
    web_app: { url: `${appUrl}/telegram?callbackUrl=%2Ftasks%2Ftask1` },
  };
  const openCreated = {
    text: "Open",
    web_app: { url: `${appUrl}/telegram?callbackUrl=%2Ftasks%2F${id}` },
  };
  const callbackData = (keyboard: InlineKeyboard) =>
    keyboard.inline_keyboard
      .flat()
      .flatMap((button) =>
        "callback_data" in button ? [button.callback_data] : [],
      );

  it("puts Done, Snooze 15 min and Skip on one row, Open below", () => {
    const keyboard = occurrenceButtons({
      id,
      taskId,
      appUrl,
      recurring: false,
    });
    expect(keyboard.inline_keyboard).toEqual([
      [
        { text: "Done", callback_data: `done:${id}` },
        { text: "Snooze 15 min", callback_data: `snooze15:${id}` },
        { text: "Skip", callback_data: `skip:${id}` },
      ],
      [open],
    ]);
  });

  it("offers Remove this one for a repeating task", () => {
    const [, second] = occurrenceButtons({
      id,
      taskId,
      appUrl,
      recurring: true,
    }).inline_keyboard;
    expect(second).toEqual([
      { text: "Remove this one", callback_data: `remove:${id}` },
      open,
    ]);
  });

  it("keeps every button's data readable and under Telegram's limit", () => {
    const all = [
      ...callbackData(
        occurrenceButtons({ id, taskId, appUrl, recurring: true }),
      ),
      ...callbackData(
        createdButtons({ id, appUrl, time: "18:00", recurring: false }),
      ),
    ];
    expect(all).toHaveLength(7);
    for (const data of all) {
      expect(parseButtonData(data)).not.toBeNull();
      expect(new TextEncoder().encode(data).length).toBeLessThanOrEqual(
        CALLBACK_DATA_MAX_BYTES,
      );
    }
  });

  it("offers +1 h and Tomorrow, then Undo and Open, under a new task", () => {
    expect(
      createdButtons({ id, appUrl, time: "18:00", recurring: false })
        .inline_keyboard,
    ).toEqual([
      [
        { text: "+1 h", callback_data: `later1h:${id}` },
        { text: "Tomorrow", callback_data: `tomorrow:${id}` },
      ],
      [{ text: "Undo", callback_data: `undo:${id}` }, openCreated],
    ]);
  });

  it("leaves out the fixes that don't apply", () => {
    const labels = (time: string | null, recurring: boolean) =>
      createdButtons({ id, appUrl, time, recurring })
        .inline_keyboard.flat()
        .map((button) => button.text);
    // No time of its own, or an hour later is tomorrow: no +1 h.
    expect(labels(null, false)).toEqual(["Tomorrow", "Undo", "Open"]);
    expect(labels("23:30", false)).toEqual(["Tomorrow", "Undo", "Open"]);
    // Repeating: the date is fixed, as in the edit form.
    expect(labels("18:00", true)).toEqual(["+1 h", "Undo", "Open"]);
    expect(labels(null, true)).toEqual(["Undo", "Open"]);
  });

  it("keeps Today and Next under the input", () => {
    expect(replyKeyboard()).toEqual({
      keyboard: [[{ text: "Today" }, { text: "Next" }]],
      resize_keyboard: true,
      is_persistent: true,
    });
  });
});

describe("summaryButtons", () => {
  const item = (n: number) => ({
    id: `cmu8a559u0027bo9cfuks9p${String(n).padStart(2, "0")}`,
    time: "18:00",
    title: `Task ${n}`,
  });

  it("puts one ✓ button per open task, each on its own row", () => {
    expect(summaryButtons([item(1), item(2)])?.inline_keyboard).toEqual([
      [{ text: "✓ 18:00 Task 1", callback_data: `sdone:${item(1).id}` }],
      [{ text: "✓ 18:00 Task 2", callback_data: `sdone:${item(2).id}` }],
    ]);
  });

  it("stops at eight, and has none for a day with nothing open", () => {
    const many = Array.from({ length: 11 }, (_, n) => item(n));
    expect(summaryButtons(many)?.inline_keyboard).toHaveLength(8);
    expect(summaryButtons([])).toBeUndefined();
  });
});
