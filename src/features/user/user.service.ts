import {
  schedulePreferencesSchema,
  timezoneSchema,
  type SchedulePreferences,
} from "@/lib/validation/user";
import { userRepository } from "@/features/user/user.repository";
import {
  InvalidSchedulePreferencesError,
  InvalidTimezoneError,
} from "@/features/user/user.errors";
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

  // sprint-12-tasks.md S12-09 — the searchable day and work hours.
  async setSchedulePreferences(userId: string, input: unknown) {
    const result = schedulePreferencesSchema.safeParse(input);
    if (!result.success) {
      throw new InvalidSchedulePreferencesError(
        result.error.issues[0]?.message ?? "Invalid hours",
      );
    }
    return userRepository.updateSchedulePreferences(userId, result.data);
  },

  // Null for a user that doesn't exist — every real row has the defaults.
  getSchedulePreferences(userId: string): Promise<SchedulePreferences | null> {
    return userRepository.findSchedulePreferences(userId);
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
  // code from a Telegram webhook call is an expected outcome, not a bug.
  async linkTelegramFromCode(code: string, chatId: string): Promise<boolean> {
    const user = await userRepository.findByTelegramLinkCode(code);
    if (!user || !isTelegramLinkCodeActive(user.telegramLinkCodeExpiresAt)) {
      return false;
    }
    await userRepository.linkTelegramChat(user.id, chatId);
    return true;
  },
};
