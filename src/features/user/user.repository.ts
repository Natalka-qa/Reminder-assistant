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
};
