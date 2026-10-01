// The address the Prisma CLI (`prisma migrate deploy` and the rest) uses —
// straight to Postgres, not
// through Neon's connection pooler (PgBouncer, transaction mode). Migrate
// takes a session-level advisory lock and releases it at the end; through
// the pooler the release can land on a different server connection, so the
// lock stays held on a pooled one and every later build times out waiting
// for it (P1002, seen 2026-10-01 after PR #28 — sprint-16-tasks.md S16-08).
// The app itself keeps using DATABASE_URL, pooled (schema.prisma).
// prisma.config.ts passes this as the CLI's `url`: a config `directUrl` is
// only printed by the classic engine, the lock still went through `url`
// (PR #30 did that; reproduced and fixed on the dev branch).
//
// DATABASE_URL_UNPOOLED when set (Neon's Vercel integration and .env.local
// have it); otherwise DATABASE_URL with Neon's `-pooler` taken out of the
// host, which is the same endpoint's direct address.
export function directDatabaseUrl(
  pooled: string | undefined,
  unpooled: string | undefined,
): string | undefined {
  if (unpooled) return unpooled;
  if (!pooled) return undefined;
  const url = new URL(pooled);
  const [endpoint, ...rest] = url.hostname.split(".");
  if (!endpoint.endsWith("-pooler")) return pooled;
  url.hostname = [endpoint.slice(0, -"-pooler".length), ...rest].join(".");
  return url.toString();
}
