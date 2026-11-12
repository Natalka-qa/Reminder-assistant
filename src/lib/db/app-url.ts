// 2026-11-12 — the app's DATABASE_URL with more time to connect. Neon's
// free compute sleeps after 5 minutes idle, so nearly every cron run wakes
// it; at the top of the hour, when crons everywhere fire, waking took
// longer than Prisma's default 5 s and the run failed with a 500 (seen in
// cron-job.org's history: :00 runs failing after ~6.5 s, :12 / :36 / :48
// fine). Values already in the URL are kept.
export const CONNECT_TIMEOUT_SECONDS = 20;
export const POOL_TIMEOUT_SECONDS = 20;

export function appDatabaseUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  const parsed = new URL(url);
  if (!parsed.searchParams.has("connect_timeout")) {
    parsed.searchParams.set("connect_timeout", String(CONNECT_TIMEOUT_SECONDS));
  }
  if (!parsed.searchParams.has("pool_timeout")) {
    parsed.searchParams.set("pool_timeout", String(POOL_TIMEOUT_SECONDS));
  }
  return parsed.toString();
}
