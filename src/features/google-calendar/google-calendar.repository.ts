import { prisma } from "@/lib/db/prisma";
import { GOOGLE_CALENDAR_PROVIDER_ID } from "@/lib/google-calendar/google-calendar.config";

// Only ever touches the calendar connection's own Account rows (provider
// "google-calendar"), never sign-in's "google" row for the same person.
export const googleCalendarRepository = {
  findAccount(userId: string) {
    return prisma.account.findFirst({
      where: { userId, provider: GOOGLE_CALENDAR_PROVIDER_ID },
      select: {
        id: true,
        access_token: true,
        refresh_token: true,
        expires_at: true,
        scope: true,
      },
    });
  },

  updateTokens(
    accountId: string,
    tokens: { accessToken: string; expiresAt: number; refreshToken?: string },
  ) {
    return prisma.account.update({
      where: { id: accountId },
      data: {
        access_token: tokens.accessToken,
        expires_at: tokens.expiresAt,
        ...(tokens.refreshToken ? { refresh_token: tokens.refreshToken } : {}),
      },
    });
  },

  deleteAccounts(userId: string) {
    return prisma.account.deleteMany({
      where: { userId, provider: GOOGLE_CALENDAR_PROVIDER_ID },
    });
  },
};
