"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

// The task was saved, but Google Calendar couldn't be asked about it
// (sprint-11-tasks.md "Расхождения" п.6) — createTaskAction/updateTaskAction
// flag that with ?calendarCheck=unavailable. Shown once, then the parameter
// is dropped so a reload or a shared link doesn't repeat it.
export function CalendarCheckToast({ unavailable }: { unavailable: boolean }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!unavailable) {
      return;
    }
    // A fixed id, so React's dev-mode double effect still shows one toast.
    toast.warning("Couldn't check Google Calendar — saved without that check", {
      id: "calendar-check-unavailable",
    });
    router.replace(pathname, { scroll: false });
  }, [unavailable, pathname, router]);

  return null;
}
