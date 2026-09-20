import Link from "next/link";
import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { notificationService } from "@/features/notifications/notification.service";
import { formatDateInZone, formatTimeInZone } from "@/lib/date";
import { EmptyState } from "@/components/ui/empty-state";

// design_handoff_reminder_assistant/README.md § Inbox.
//
// The mockup frames this as a feed of AI-generated suggestions ("Send the
// proposal has been snoozed twice. Move it to tomorrow morning?"). Nothing
// in this codebase generates those — same reasoning as the Dashboard's
// dropped InsightCard/AI suggestion and the Task detail page's dropped AI
// suggestion card. What's real and already tracked is sent-reminder
// history (Notification rows with status SENT), so that's what fills this
// screen: the separator-list layout and typography from the mockup, with
// honest content instead of fabricated assistant copy. No "Not now"
// dismiss action either — a past, already-sent reminder isn't a live
// suggestion to dismiss.
export default async function InboxPage() {
  await verifySession();
  const user = await getCurrentUser();
  const timezone = user?.timezone ?? "UTC";
  const history = user
    ? await notificationService.getRecentHistory(user.id)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[45px] leading-[1] font-light">
          Inbox
        </h1>
        <p className="text-text-secondary text-[15px]">
          Reminders that have been sent to you.
        </p>
      </div>

      {history.length === 0 ? (
        <EmptyState
          title="Nothing here yet."
          body="Reminders you receive will show up here."
          ctaLabel="Add a task"
          ctaHref="/tasks/new"
        />
      ) : (
        <div className="flex flex-col">
          {history.map((entry) => (
            <div
              key={entry.id}
              className="border-separator flex items-start justify-between gap-4 border-b py-[22px] last:border-b-0"
            >
              <div className="flex flex-col gap-1">
                <p className="text-text-primary text-[15px] leading-[1.6]">
                  Reminder sent for{" "}
                  <span className="font-medium">{entry.title}</span>
                </p>
                <p className="text-text-secondary text-meta">
                  {formatDateInZone(entry.sentAt, timezone, "LLL d")} ·{" "}
                  {formatTimeInZone(entry.sentAt, timezone)}
                </p>
              </div>
              <Link
                href={`/tasks/${entry.taskId}`}
                className="text-burgundy text-meta shrink-0 font-semibold"
              >
                View task
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
