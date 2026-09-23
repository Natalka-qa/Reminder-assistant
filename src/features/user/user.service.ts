import { timezoneSchema } from "@/lib/validation/user";
import { userRepository } from "@/features/user/user.repository";
import { InvalidTimezoneError } from "@/features/user/user.errors";
import {
  createTelegramLinkCode,
  isTelegramLinkCodeActive,
} from "@/features/user/telegram-link-code";

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
    const { code, expiresAt } = createTelegramLinkCode();
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
    if (!user || !isTelegramLinkCodeActive(user.telegramLinkCodeExpiresAt)) {
      return false;
    }
    await userRepository.linkTelegramChat(user.id, chatId);
    return true;
  },
};
