import { notificationService } from "@/features/notifications/notification.service";
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
    const sent = await notificationService.sendDueNotifications(new Date());
    return Response.json({ sent: sent.length });
  } catch (error) {
    console.error("send-notifications cron failed:", error);
    return Response.json(
      { error: "Failed to send notifications." },
      { status: 500 },
    );
  }
}
