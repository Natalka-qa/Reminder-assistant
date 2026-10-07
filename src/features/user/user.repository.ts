import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type {
  ReminderPreferences,
  SchedulePreferences,
} from "@/lib/validation/user";

type Db = PrismaClient | Prisma.TransactionClient;

export const userRepository = {
  findById(id: string, db: Db = prisma) {
    return db.user.findUnique({ where: { id } });
  },

  updateTimezone(id: string, timezone: string, db: Db = prisma) {
    return db.user.update({
      where: { id },
      data: { timezone, timezoneConfirmedAt: new Date() },
    });
  },

  updateName(id: string, name: string | null) {
    return prisma.user.update({ where: { id }, data: { name } });
  },

  // Only the first time: finishing again (another tab) keeps the date.
  markOnboarded(id: string, at: Date) {
    return prisma.user.updateMany({
      where: { id, onboardedAt: null },
      data: { onboardedAt: at },
    });
  },

  updateSchedulePreferences(id: string, preferences: SchedulePreferences) {
    return prisma.user.update({ where: { id }, data: preferences });
  },

  findSchedulePreferences(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        dayStartMinutes: true,
        dayEndMinutes: true,
        workDays: true,
        workStartMinutes: true,
        workEndMinutes: true,
        workoutLatestStartMinutes: true,
      },
    });
  },

  updateReminderPreferences(id: string, preferences: ReminderPreferences) {
    return prisma.user.update({ where: { id }, data: preferences });
  },

  updateTelegramSummary(id: string, minutes: number | null) {
    return prisma.user.update({
      where: { id },
      data: { telegramSummaryMinutes: minutes },
    });
  },

  // sprint-15-tasks.md S15-11 — who might get a morning summary now: a
  // chat to send it to and a time set. Whether it's their time is
  // isSummaryDue's call.
  findSummaryRecipients() {
    return prisma.user.findMany({
      where: {
        telegramChatId: { not: null },
        telegramSummaryMinutes: { not: null },
      },
    });
  },

  // Marks today's summary as taken before it's sent — only if it wasn't
  // already, so two cron runs racing can't both send it (same idea as
  // notificationRepository.claim). `count === 0`: someone else has it.
  async claimSummary(id: string, today: string): Promise<boolean> {
    const { count } = await prisma.user.updateMany({
      where: {
        id,
        OR: [
          { telegramSummarySentOn: null },
          { telegramSummarySentOn: { not: today } },
        ],
      },
      data: { telegramSummarySentOn: today },
    });
    return count === 1;
  },

  // sprint-21-tasks.md п.10 — the evening habit reminder, the same three
  // steps as the morning summary above: set, who might get it, claim.
  updateHabitReminder(id: string, minutes: number | null) {
    return prisma.user.update({
      where: { id },
      data: { habitReminderMinutes: minutes },
    });
  },

  findHabitReminderRecipients() {
    return prisma.user.findMany({
      where: {
        telegramChatId: { not: null },
        habitReminderMinutes: { not: null },
      },
    });
  },

  async claimHabitReminder(id: string, today: string): Promise<boolean> {
    const { count } = await prisma.user.updateMany({
      where: {
        id,
        OR: [
          { habitReminderSentOn: null },
          { habitReminderSentOn: { not: today } },
        ],
      },
      data: { habitReminderSentOn: today },
    });
    return count === 1;
  },

  findReminderPreferences(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { defaultReminderMinutes: true, emailRemindersEnabled: true },
    });
  },

  // sprint-15-tasks.md S15-05 — whose chat a bot message came from.
  findByTelegramChatId(chatId: string) {
    return prisma.user.findUnique({ where: { telegramChatId: chatId } });
  },

  findByTelegramLinkCode(code: string) {
    return prisma.user.findUnique({ where: { telegramLinkCode: code } });
  },

  setTelegramLinkCode(id: string, code: string, expiresAt: Date) {
    return prisma.user.update({
      where: { id },
      data: { telegramLinkCode: code, telegramLinkCodeExpiresAt: expiresAt },
    });
  },

  // Redeeming a code clears it in the same write — one-time use (sprint-10-
  // tasks.md "Расхождения" п.2): a second /start with the same code no
  // longer finds anyone via findByTelegramLinkCode.
  linkTelegramChat(id: string, chatId: string) {
    return prisma.user.update({
      where: { id },
      data: {
        telegramChatId: chatId,
        telegramLinkCode: null,
        telegramLinkCodeExpiresAt: null,
      },
    });
  },

  // sprint-16-tasks.md S16-02 — the same Session row Auth.js writes after
  // Google ("Расхождения" п.4), so dal.ts, Sign out and expiry all work as is.
  createSession(userId: string, sessionToken: string, expires: Date) {
    return prisma.session.create({
      data: { userId, sessionToken, expires },
    });
  },

  unlinkTelegram(id: string) {
    return prisma.user.update({
      where: { id },
      data: { telegramChatId: null },
    });
  },
};
