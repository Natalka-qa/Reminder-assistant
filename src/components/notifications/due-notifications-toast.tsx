"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import type { DueNotificationResult } from "@/features/notifications/notification.service";

// Renders nothing — fires one toast per notification the server already
// sent (or attempted to) on this page load. No polling/WebSocket: a fresh
// batch only ever shows up on the next `/dashboard` load or revalidate
// (see "Не входит в Sprint 6" in sprint-6-tasks.md).
export function DueNotificationsToast({
  notifications,
}: {
  notifications: DueNotificationResult[];
}) {
  useEffect(() => {
    for (const notification of notifications) {
      // A stable id (not sonner's default random one) makes this call
      // idempotent — React Strict Mode double-invokes effects in dev,
      // which would otherwise fire this same toast twice per mount.
      toast(notification.title, {
        id: notification.occurrenceId,
        description: notification.timeLabel,
      });
    }
    // Runs once per mount with the batch the server resolved for this
    // request — not meant to re-fire if `notifications` is ever replaced by
    // an equal-looking array from a re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
