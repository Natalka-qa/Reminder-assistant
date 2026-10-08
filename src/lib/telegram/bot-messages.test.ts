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
  removedButtons,
  habitButtons,
  habitsSection,
  type HabitLineItem,
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
        "📅 <b>Today · Wed, Sep 30</b>",
        "⚠️ <i>2 overdue tasks</i>",
        "",
        "✅ <s>08:30 · Pills</s>",
        "✨ Anytime · <b>Read</b> · 30 min",
        "⏭ <s>18:00 · Gym</s> · skipped",
      ].join("\n"),
    );
  });

  it("says so when the day is empty", () => {
    expect(todayMessage("Wed, Sep 30", [], 0)).toBe(
      "📅 <b>Today · Wed, Sep 30</b>\n\n<i>Nothing planned for today.</i>",
    );
    expect(todayMessage("Wed, Sep 30", [], 1)).toContain(
      "<i>1 overdue task</i>\n",
    );
  });

  it("escapes what the user typed (2026-10-08: HTML)", () => {
    expect(
      todayMessage("Wed, Sep 30", [{ ...gym, title: "Call <Bob> & Ann" }], 0),
    ).toContain("🕕 18:00 · <b>Call &lt;Bob&gt; &amp; Ann</b> · 1h");
  });
});

describe("nextMessage", () => {
  it("shows the next task or a clear day", () => {
    expect(nextMessage(gym)).toBe(
      "⏭ <b>Up next</b>\n\n🕕 18:00 · <b>Gym</b> · 1h",
    );
    expect(nextMessage(null)).toBe("<i>Nothing left for today.</i>");
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

  it("Undo of a removed day takes the line back (sprint-19 п.8)", () => {
    const original = "Gym is scheduled for 18:00 (60 min).";
    const removed = buttonResultMessage(original, { action: "remove" });
    expect(buttonResultMessage(removed, { action: "restore" })).toBe(
      `${original}\n\nRestored`,
    );
  });
});

describe("removedButtons", () => {
  it("is one Undo that restores the day, within Telegram's limit", () => {
    const id = "cmuu475iq0006bo51r4hrvvob";
    const [[undo]] = removedButtons(id).inline_keyboard;
    expect(undo.text).toBe("Undo");
    const data = "callback_data" in undo ? undo.callback_data : "";
    expect(parseButtonData(data)).toEqual({ action: "restore", id });
    expect(new TextEncoder().encode(data).length).toBeLessThanOrEqual(
      CALLBACK_DATA_MAX_BYTES,
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
        { text: "✓ Done", callback_data: `done:${id}`, style: "success" },
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
      {
        text: "Remove this one",
        callback_data: `remove:${id}`,
        style: "danger",
      },
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
      [
        { text: "Undo", callback_data: `undo:${id}`, style: "primary" },
        openCreated,
      ],
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
  it("leaves the time out for a task without one (sprint-18 п.20)", () => {
    expect(
      summaryButtons([{ id: "o1", time: null, title: "Buy milk" }])
        ?.inline_keyboard[0][0].text,
    ).toBe("✓ Buy milk");
  });

  const item = (n: number) => ({
    id: `cmu8a559u0027bo9cfuks9p${String(n).padStart(2, "0")}`,
    time: "18:00",
    title: `Task ${n}`,
  });

  it("puts one ✓ button per open task, each on its own row", () => {
    expect(summaryButtons([item(1), item(2)])?.inline_keyboard).toEqual([
      [
        {
          text: "✓ 18:00 Task 1",
          callback_data: `sdone:${item(1).id}`,
          style: "success",
        },
      ],
      [
        {
          text: "✓ 18:00 Task 2",
          callback_data: `sdone:${item(2).id}`,
          style: "success",
        },
      ],
    ]);
  });

  it("stops at eight, and has none for a day with nothing open", () => {
    const many = Array.from({ length: 11 }, (_, n) => item(n));
    expect(summaryButtons(many)?.inline_keyboard).toHaveLength(8);
    expect(summaryButtons([])).toBeUndefined();
  });
});

describe("habits in the morning summary (sprint-21-tasks.md п.9)", () => {
  const exercise: HabitLineItem = {
    id: "cmhabitexercise0000000001",
    title: "Exercise",
    mode: "check",
    met: true,
    progressLabel: null,
    goalAmount: null,
    stepLabel: null,
  };
  const water: HabitLineItem = {
    id: "cmhabitwater000000000001",
    title: "Water",
    mode: "step",
    met: false,
    progressLabel: "0/2 L",
    goalAmount: "2 L",
    stepLabel: "+250 ml",
  };
  const sleep: HabitLineItem = {
    ...water,
    id: "sleep",
    title: "Sleep",
    mode: "goal",
    progressLabel: "0/8 h",
    goalAmount: "8 h",
    stepLabel: "+15 min",
  };
  const stretch: HabitLineItem = {
    ...exercise,
    id: "s",
    title: "Stretch",
    met: false,
  };

  it("puts each habit on its own line in a folding quote, with the news", () => {
    expect(
      habitsSection(
        [
          exercise,
          { ...water, value: 1000, goal: 2000, progressLabel: "1/2 L" },
        ],
        "Exercise — 7 days in a row. Well done!",
      ),
    ).toBe(
      [
        "🌱 <b>Daily · 1/2</b>",
        "<blockquote expandable>✅ Exercise",
        "○ Water ▰▰▱▱▱ 1/2 L</blockquote>",
        "🎉 <i>Exercise — 7 days in a row. Well done!</i>",
      ].join("\n"),
    );
    expect(habitsSection([exercise], null)).toBe(
      "🌱 <b>Daily · all done</b> ✓\n<blockquote expandable>✅ Exercise</blockquote>",
    );
    expect(habitsSection([], "anything")).toBeNull();
  });

  it("offers a button per habit still to do, two a row, up to 8", () => {
    const rows = habitButtons([
      exercise,
      water,
      sleep,
      ...Array.from({ length: 8 }, () => stretch),
    ]);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual([
      {
        text: "Water +250 ml",
        callback_data: `hplus:${water.id}`,
        style: "primary",
      },
      { text: "✓ Sleep 8 h", callback_data: "hdone:sleep", style: "success" },
    ]);
    expect(rows[1][0]).toEqual({
      text: "✓ Stretch",
      callback_data: "hdone:s",
      style: "success",
    });
    expect(rows.flat()).toHaveLength(8);
    expect(habitButtons([exercise])).toEqual([]);
  });

  it("reads its buttons back", () => {
    expect(parseButtonData(`hplus:${water.id}`)).toEqual({
      action: "hplus",
      id: water.id,
    });
    expect(
      Buffer.byteLength(`hplus:${water.id}`) <= CALLBACK_DATA_MAX_BYTES,
    ).toBe(true);
  });
});
