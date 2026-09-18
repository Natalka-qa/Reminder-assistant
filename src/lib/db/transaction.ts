import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type Tx = Prisma.TransactionClient;

/**
 * The only way a service orchestrates a cross-repository transaction —
 * keeps `prisma` itself confined to this directory and `*.repository.ts`
 * files (ADR-001), while still letting services coordinate multiple
 * repositories atomically.
 */
export function runInTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn);
}
