import { randomBytes } from "node:crypto";
import { timezoneSchema } from "@/lib/validation/user";
import { userRepository } from "@/features/user/user.repository";
import { InvalidTimezoneError } from "@/features/user/user.errors";

// 10 minutes — short enough that a leaked/guessed code is a narrow window,
// long enough that opening the Telegram deep link isn't a race (sprint-10-
// tasks.md "Расхождения" п.2).
const TELEGRAM_LINK_CODE_TTL_MINUTES = 10;

function generateTelegramLinkCodeValue(): string {
  // 8 hex chars — short enough to show on /settings, and Telegram's own
  // /start payload only allows [A-Za-z0-9_-], which hex is safely within.
  return randomBytes(4).toString("hex");
}

export const userService = {
  async setTimezone(userId: string, timezone: string) {
    const result = timezoneSchema.safeParse(timezone);
    if (!result.success) {
      throw new InvalidTimezoneError(timezone);
    }
    return userRepository.updateTimezone(userId, result.data);
  },

  getProfile(userId: string) {
    return userRepository.findById(userId);
  },

  async generateTelegramLinkCode(
    userId: string,
  ): Promise<{ code: string; expiresAt: Date }> {
    const code = generateTelegramLinkCodeValue();
    const expiresAt = new Date(
      Date.now() + TELEGRAM_LINK_CODE_TTL_MINUTES * 60_000,
    );
    await userRepository.setTelegramLinkCode(userId, code, expiresAt);
    return { code, expiresAt };
  },

  async disconnectTelegram(userId: string): Promise<void> {
    await userRepository.unlinkTelegram(userId);
  },

  // Explicit boolean, not an exception — an invalid/expired/already-used
  // code from a Telegram webhook call is an expected outcome, not a bug
  // (same "explicit failure over exception" principle as task-draft.service
  // .ts's TaskDraftResult, Sprint 8).
  async linkTelegramFromCode(code: string, chatId: string): Promise<boolean> {
    const user = await userRepository.findByTelegramLinkCode(code);
    if (
      !user ||
      !user.telegramLinkCodeExpiresAt ||
      user.telegramLinkCodeExpiresAt < new Date()
    ) {
      return false;
    }
    await userRepository.linkTelegramChat(user.id, chatId);
    return true;
  },
};
