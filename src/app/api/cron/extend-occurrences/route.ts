import { occurrenceService } from "@/features/scheduling/occurrence.service";
import { env } from "@/lib/env";

// Vercel Cron (vercel.json) hits this daily; a manual/local call needs the
// same bearer token. Not a user-facing endpoint — no session, just the
// shared secret.
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const extended = await occurrenceService.extendOccurrencesForAllActiveTasks(
    new Date(),
  );

  return Response.json({ extended });
}
