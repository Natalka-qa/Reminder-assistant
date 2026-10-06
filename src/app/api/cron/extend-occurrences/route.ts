import { occurrenceService } from "@/features/scheduling/occurrence.service";
import { taskService } from "@/features/tasks/task.service";
import { env } from "@/lib/env";

// Vercel Cron (vercel.json) hits this daily; a manual/local call needs the
// same bearer token. Not a user-facing endpoint — no session, just the
// shared secret.
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const now = new Date();
    // sprint-20-tasks.md п.2 — series past their last day end first, so
    // the extension only tops up the ones still running.
    const ended = await taskService.endFinishedSeries(now);
    const extended =
      await occurrenceService.extendOccurrencesForAllActiveTasks(now);
    return Response.json({ ended, extended });
  } catch (error) {
    console.error("extend-occurrences cron failed:", error);
    return Response.json(
      { error: "Failed to extend occurrences." },
      { status: 500 },
    );
  }
}
