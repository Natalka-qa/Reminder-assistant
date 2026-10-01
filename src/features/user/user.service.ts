import {
  reminderPreferencesSchema,
  telegramSummarySchema,
  schedulePreferencesSchema,
  timezoneSchema,
  type ReminderPreferences,
  type SchedulePreferences,
} from "@/lib/validation/user";
import { userRepository } from "@/features/user/user.repository";
import {
  InvalidReminderPreferencesError,
  InvalidTelegramSummaryError,
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

  // sprint-14-tasks.md S14-06 — "Default reminder" and "Email reminders".
  async setReminderPreferences(userId: string, input: unknown) {
    const result = reminderPreferencesSchema.safeParse(input);
    if (!result.success) {
      throw new InvalidReminderPreferencesError(
        result.error.issues[0]?.message ?? "Invalid reminder settings",
      );
    }
    return userRepository.updateReminderPreferences(userId, result.data);
  },

  // sprint-15-tasks.md S15-10 — "Morning summary" in the Telegram block.
  // Disconnecting keeps it: without a chat there's just nowhere to send it.
  async setTelegramSummary(userId: string, input: unknown) {
    const result = telegramSummarySchema.safeParse(input);
    if (!result.success) {
      throw new InvalidTelegramSummaryError(
        result.error.issues[0]?.message ?? "Invalid summary time",
      );
    }
    return userRepository.updateTelegramSummary(userId, result.data);
  },

  /** S15-11 — users with a chat and a summary time. */
  getSummaryRecipients() {
    return userRepository.findSummaryRecipients();
  },

  /** S15-11 — true for the one caller that gets to send today's summary. */
  claimSummary(userId: string, today: string) {
    return userRepository.claimSummary(userId, today);
  },

  getReminderPreferences(userId: string): Promise<ReminderPreferences | null> {
    return userRepository.findReminderPreferences(userId);
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
  /** sprint-15-tasks.md S15-05 — the account a Telegram chat belongs to. */
  getUserByTelegramChat(chatId: string) {
    return userRepository.findByTelegramChatId(chatId);
  },

  async linkTelegramFromCode(code: string, chatId: string): Promise<boolean> {
    const user = await userRepository.findByTelegramLinkCode(code);
    if (!user || !isTelegramLinkCodeActive(user.telegramLinkCodeExpiresAt)) {
      return false;
    }
    await userRepository.linkTelegramChat(user.id, chatId);
    return true;
  },
};
