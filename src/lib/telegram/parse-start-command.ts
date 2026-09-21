// Minimal shape of a Telegram Bot API Update — only the fields
// parseStartCommand actually reads, not the full API surface.
export type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: { id: number };
  };
};

export type StartCommand = {
  code: string;
  chatId: string;
};

// Pure — no I/O, so it's unit-testable without a real Telegram payload.
// Only recognizes "/start <code>" (the one command this bot understands,
// sprint-10-tasks.md "Не входит" — no other bot commands this sprint);
// anything else (no message, no text, a different command, malformed
// payload) is null, not an error — the webhook route responds 200 either
// way (Telegram retries on non-2xx).
export function parseStartCommand(update: TelegramUpdate): StartCommand | null {
  const text = update.message?.text;
  const chatId = update.message?.chat?.id;
  if (!text || chatId === undefined) return null;

  const match = /^\/start\s+(\S+)$/.exec(text.trim());
  if (!match) return null;

  return { code: match[1], chatId: String(chatId) };
}
