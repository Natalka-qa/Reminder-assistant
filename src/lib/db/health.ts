import "server-only";
import { prisma } from "@/lib/db/prisma";

// Lives in src/lib/db (exempt from the "Prisma only in *.repository.ts"
// layering check — see docs/adr/001-project-structure.md) so /api/health
// doesn't need a repository of its own for a single SELECT 1.
export async function isDatabaseHealthy(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
