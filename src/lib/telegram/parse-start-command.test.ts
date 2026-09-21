import { describe, expect, it } from "vitest";
import { parseStartCommand } from "./parse-start-command";

describe("parseStartCommand", () => {
  it("extracts the code and chat id from a /start command", () => {
    const result = parseStartCommand({
      message: { text: "/start abc12345", chat: { id: 987654321 } },
    });

    expect(result).toEqual({ code: "abc12345", chatId: "987654321" });
  });

  it("returns null when there's no message", () => {
    expect(parseStartCommand({})).toBeNull();
  });

  it("returns null when the message has no text", () => {
    expect(parseStartCommand({ message: { chat: { id: 1 } } })).toBeNull();
  });

  it("returns null for a different command", () => {
    expect(
      parseStartCommand({
        message: { text: "/help", chat: { id: 1 } },
      }),
    ).toBeNull();
  });

  it("returns null for /start with no code", () => {
    expect(
      parseStartCommand({
        message: { text: "/start", chat: { id: 1 } },
      }),
    ).toBeNull();
  });

  it("returns null when the chat id is missing", () => {
    expect(
      parseStartCommand({ message: { text: "/start abc12345" } }),
    ).toBeNull();
  });
});
