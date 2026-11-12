import { Prisma } from "@prisma/client";

// 2026-11-12 — errors that mean "couldn't reach or keep the database", not
// a bad query: worth one more try once it's awake (see app-url.ts).
const CONNECTION_CODES = new Set([
  "P1001", // can't reach the database server
  "P1002", // reached, timed out
  "P1008", // operation timed out
  "P1017", // server closed the connection
  "P2024", // timed out waiting for a connection from the pool
]);

export function isConnectionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    CONNECTION_CODES.has(error.code)
  );
}

/** `run`, and once more if the first try couldn't reach the database. */
export async function withConnectionRetry<T>(
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!isConnectionError(error)) throw error;
    console.warn("database connection failed, retrying once:", error);
    return run();
  }
}
