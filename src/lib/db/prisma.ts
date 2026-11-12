import "server-only";
import { PrismaClient } from "@prisma/client";
import { appDatabaseUrl } from "./app-url";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// 2026-11-12 — more time to connect while Neon wakes (app-url.ts).
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ datasourceUrl: appDatabaseUrl(process.env.DATABASE_URL) });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
