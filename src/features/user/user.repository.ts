import { prisma } from "@/lib/db/prisma";

export const userRepository = {
  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  updateTimezone(id: string, timezone: string) {
    return prisma.user.update({
      where: { id },
      data: { timezone, timezoneConfirmedAt: new Date() },
    });
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

  unlinkTelegram(id: string) {
    return prisma.user.update({
      where: { id },
      data: { telegramChatId: null },
    });
  },
};
