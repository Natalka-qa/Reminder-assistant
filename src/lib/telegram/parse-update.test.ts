import { describe, expect, it } from "vitest";
import { parseUpdate } from "./parse-update";
import {
  BUTTON_ACTIONS,
  buttonData,
  CALLBACK_DATA_MAX_BYTES,
  parseButtonData,
} from "./button-data";

const message = (text?: string, chatId = 42) => ({
  message: { text, chat: { id: chatId } },
});

const press = (data: string | undefined) => ({
  callback_query: {
    id: "cb1",
    data,
    message: { message_id: 7, chat: { id: 42 }, text: "Gym at 18:00" },
  },
});

describe("parseUpdate", () => {
  it("reads /start with a link code", () => {
    expect(parseUpdate(message("/start abc12345", 987654321))).toEqual({
      kind: "start",
      chatId: "987654321",
      code: "abc12345",
    });
  });

  it("reads /start without a code", () => {
    expect(parseUpdate(message("/start"))).toEqual({
      kind: "start",
      chatId: "42",
    });
  });

  it("reads the bot's commands, with or without the bot's name", () => {
    expect(parseUpdate(message("/today"))).toEqual({
      kind: "command",
      chatId: "42",
      name: "today",
      args: "",
    });
    expect(parseUpdate(message("/next@Remindyme_bot"))).toMatchObject({
      kind: "command",
      name: "next",
    });
    expect(parseUpdate(message("/HELP"))).toMatchObject({ name: "help" });
  });

  it("keeps the phrase after /add", () => {
    expect(parseUpdate(message("/add  call mom tomorrow at 18 "))).toEqual({
      kind: "command",
      chatId: "42",
      name: "add",
      args: "call mom tomorrow at 18",
    });
  });

  it("reads the keyboard's Today and Next as commands, not tasks", () => {
    expect(parseUpdate(message("Today"))).toEqual({
      kind: "command",
      chatId: "42",
      name: "today",
      args: "",
    });
    expect(parseUpdate(message("next"))).toMatchObject({ name: "next" });
    expect(parseUpdate(message("Today at 18 gym"))).toMatchObject({
      kind: "text",
    });
  });

  it("marks a command it doesn't know", () => {
    expect(parseUpdate(message("/settings"))).toEqual({
      kind: "unknown-command",
      chatId: "42",
    });
  });

  it("reads plain text as text, Cyrillic too", () => {
    expect(parseUpdate(message("Call mom tomorrow"))).toEqual({
      kind: "text",
      chatId: "42",
      text: "Call mom tomorrow",
    });
    expect(parseUpdate(message("Позвонить маме в пятницу"))).toMatchObject({
      kind: "text",
    });
  });

  it("reads a button press", () => {
    expect(parseUpdate(press("done:cmu8a559u0027bo9cfuks9po3"))).toEqual({
      kind: "button",
      chatId: "42",
      callbackId: "cb1",
      messageId: 7,
      messageText: "Gym at 18:00",
      action: "done",
      id: "cmu8a559u0027bo9cfuks9po3",
    });
  });

  it("still answers a press it can't read", () => {
    expect(parseUpdate(press("foo:1"))).toEqual({
      kind: "unknown-button",
      chatId: "42",
      callbackId: "cb1",
    });
    expect(parseUpdate(press(undefined))).toMatchObject({
      kind: "unknown-button",
    });
  });

  it("returns null for what it has nothing to say to", () => {
    expect(parseUpdate({})).toBeNull();
    expect(parseUpdate(message(undefined))).toBeNull();
    expect(parseUpdate(message("   "))).toBeNull();
    expect(parseUpdate({ message: { text: "/start abc" } })).toBeNull();
    expect(
      parseUpdate({ callback_query: { id: "cb1", data: "done:x" } }),
    ).toBeNull();
  });
});

describe("button data", () => {
  it("round-trips and fits Telegram's limit", () => {
    const id = "cmu8a559u0027bo9cfuks9po3";
    for (const action of BUTTON_ACTIONS) {
      const data = buttonData(action, id);
      expect(new TextEncoder().encode(data).length).toBeLessThanOrEqual(
        CALLBACK_DATA_MAX_BYTES,
      );
      expect(parseButtonData(data)).toEqual({ action, id });
    }
  });

  it("rejects what isn't ours", () => {
    expect(parseButtonData("snooze60:abc")).toBeNull();
    expect(parseButtonData("done:")).toBeNull();
    expect(parseButtonData("done")).toBeNull();
  });
});
