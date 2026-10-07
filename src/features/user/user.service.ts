import {
  nameSchema,
  reminderPreferencesSchema,
  telegramSummarySchema,
  schedulePreferencesSchema,
  timezoneSchema,
  type ReminderPreferences,
  type SchedulePreferences,
} from "@/lib/validation/user";
import { userRepository } from "@/features/user/user.repository";
import { runInTransaction } from "@/lib/db/transaction";
import { occurrenceService } from "@/features/scheduling/occurrence.service";
import {
  InvalidNameError,
  InvalidReminderPreferencesError,
  InvalidTelegramSummaryError,
  InvalidSchedulePreferencesError,
  InvalidTimezoneError,
} from "@/features/user/user.errors";
import { randomBytes } from "node:crypto";
import {
  createTelegramLinkCode,
  isTelegramLinkCodeActive,
} from "@/features/user/telegram-link-code";

// Auth.js's own default session.maxAge — the same 30 days as after Google
// ("Расхождения" п.4).
const TELEGRAM_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export const userService = {
  // sprint-18-tasks.md п.5 — tasks without a time move with the zone, so
  // they stay on their day; in one transaction with the zone itself.
  async setTimezone(userId: string, timezone: string, now = new Date()) {
    const result = timezoneSchema.safeParse(timezone);
    if (!result.success) {
      throw new InvalidTimezoneError(timezone);
    }
    return runInTransaction(async (tx) => {
      const before = await userRepository.findById(userId, tx);
      const user = await userRepository.updateTimezone(userId, result.data, tx);
      if (before) {
        await occurrenceService.reanchorUntimedOccurrences(
          userId,
          before.timezone,
          result.data,
          now,
          tx,
        );
      }
      return user;
    });
  },

  // Onboarding and Settings — the name the app calls you by.
  async setName(userId: string, input: unknown) {
    const result = nameSchema.safeParse(input ?? "");
    if (!result.success) {
      throw new InvalidNameError(
        result.error.issues[0]?.message ?? "Invalid name",
      );
    }
    return userRepository.updateName(userId, result.data);
  },

  // /onboarding finished or skipped: the app stops sending them there.
  completeOnboarding(userId: string, now = new Date()) {
    return userRepository.markOnboarded(userId, now);
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

  /**
   * sprint-16-tasks.md S16-02 — a sign-in from the Mini App, for a chat
   * already linked on /settings ("Расхождения" п.2). Null: nobody has this
   * Telegram account, and no session is created. In a private chat the
   * chat id is the Telegram user id, so `telegramChatId` finds them.
   */
  async startTelegramSession(
    telegramUserId: number,
    now: Date = new Date(),
  ): Promise<{ sessionToken: string; expires: Date } | null> {
    const user = await userRepository.findByTelegramChatId(
      String(telegramUserId),
    );
    if (!user) return null;
    const sessionToken = randomBytes(32).toString("hex");
    const expires = new Date(now.getTime() + TELEGRAM_SESSION_MAX_AGE_MS);
    await userRepository.createSession(user.id, sessionToken, expires);
    return { sessionToken, expires };
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
