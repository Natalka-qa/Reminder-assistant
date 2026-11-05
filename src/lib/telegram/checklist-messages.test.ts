import { describe, expect, it } from "vitest";
import { CALLBACK_DATA_MAX_BYTES } from "./button-data";
import {
  addedItemsMessage,
  addItemsPrompt,
  listButtons,
  listButtonText,
  listIdFromUrl,
  listMessage,
  listsButtons,
  listsMessage,
} from "./checklist-messages";

const APP = "https://app.example.com";
const ID = "cmw3thq0u0001bo191kcs5gmc";
const groceries = {
  id: ID,
  title: "Groceries",
  icon: "🛒",
  done: 1,
  total: 3,
};

describe("/lists", () => {
  it("lists each one as a button with its progress", () => {
    expect(listsMessage([groceries])).toBe("📋 <b>Your lists</b>");
    expect(listsButtons([groceries], APP).inline_keyboard).toEqual([
      [{ text: "🛒 Groceries · 1/3", callback_data: `lopen:${ID}` }],
    ]);
  });

  it("invites to make one when there are none", () => {
    expect(listsMessage([])).toMatch(/^No lists yet/);
    const [[button]] = listsButtons([], APP).inline_keyboard;
    expect(button.text).toBe("Make a list");
  });

  it("calls an empty list empty", () => {
    expect(listButtonText({ ...groceries, done: 0, total: 0 })).toBe(
      "🛒 Groceries · empty",
    );
  });
});

describe("one list", () => {
  const items = [
    { id: "i1", text: "Milk", note: "2 l", checked: false },
    { id: "i2", text: "Bread", note: null, checked: true },
  ];

  it("shows the name, escaped, and the progress", () => {
    expect(listMessage({ ...groceries, title: "Tom & Jerry <3" })).toBe(
      "🛒 <b>Tom &amp; Jerry &lt;3</b> · 1/3",
    );
    expect(listMessage({ ...groceries, done: 3 })).toMatch(/All done ✓$/);
    expect(listMessage({ ...groceries, done: 0, total: 0 })).toMatch(
      /No items yet/,
    );
  });

  it("makes each item a button, then Add, Lists and Open", () => {
    const rows = listButtons(groceries, items, APP, {
      back: true,
    }).inline_keyboard;
    expect(rows[0]).toEqual([
      { text: "○ Milk · 2 l", callback_data: "ltog:i1" },
    ]);
    expect(rows[1]).toEqual([{ text: "✓ Bread", callback_data: "ltog:i2" }]);
    expect(rows[2].map((button) => button.text)).toEqual([
      "+ Add items",
      "‹ Lists",
      "Open",
    ]);
  });

  it("cuts a long item and keeps callback data within Telegram's cap", () => {
    const [[button]] = listButtons(
      groceries,
      [{ id: ID, text: "x".repeat(200), note: null, checked: false }],
      APP,
      { back: false },
    ).inline_keyboard;
    expect(button.text.length).toBeLessThanOrEqual(48);
    expect(button.text.endsWith("…")).toBe(true);
    if ("callback_data" in button) {
      expect(
        new TextEncoder().encode(button.callback_data).length,
      ).toBeLessThanOrEqual(CALLBACK_DATA_MAX_BYTES);
    }
  });
});

describe("adding items (Q1)", () => {
  it("links the list in the prompt, and reads the id back", () => {
    const prompt = addItemsPrompt(groceries, APP);
    expect(prompt).toContain(`<a href="${APP}/lists/${ID}">Groceries</a>`);
    expect(listIdFromUrl(`${APP}/lists/${ID}`)).toBe(ID);
    expect(listIdFromUrl(`${APP}/tasks/${ID}`)).toBeNull();
  });

  it("says how many were added", () => {
    expect(addedItemsMessage(2, groceries)).toBe(
      "Added 2 to 🛒 <b>Groceries</b>.",
    );
    expect(addedItemsMessage(0, groceries)).toMatch(/^Nothing to add/);
  });
});
