import { notificationService } from "@/features/notifications/notification.service";
import { sendDueSummaries } from "@/features/telegram/telegram-summary.service";
import { env } from "@/lib/env";

// An external scheduler (cron-job.org) hits this every 5 minutes, since the
// Vercel Hobby plan only allows daily crons; a manual/local call
// needs the same bearer token. Not a user-facing endpoint — no session,
// just the shared secret. Backstop for the dashboard-load lazy trigger
// (S6-11), which is the primary delivery channel — see "Расхождения" п.5 in
// sprint-6-tasks.md.
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const now = new Date();
    const sent = await notificationService.sendDueNotifications(now);
    // sprint-15-tasks.md S15-11 — the morning summary rides on this same
    // 5-minute run (Hobby allows only daily crons in vercel.json). Its own
    // try/catch: a failure there never touches the reminders above.
    let summaries = 0;
    try {
      summaries = await sendDueSummaries(now);
    } catch (error) {
      console.error("telegram summaries failed:", error);
    }
    return Response.json({ sent: sent.length, summaries });
  } catch (error) {
    console.error("send-notifications cron failed:", error);
    return Response.json(
      { error: "Failed to send notifications." },
      { status: 500 },
    );
  }
}
