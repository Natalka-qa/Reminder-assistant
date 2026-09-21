"use client";

import { signOutAction } from "@/app/(auth)/login/actions";

// design_handoff_reminder_assistant/README.md § Settings ends here. The
// header (Sidebar/BottomNav) dropped its own sign-out control in Phase 3 —
// this is Settings' only one now, same as the design.
export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOutAction()}
      className="text-burgundy self-start text-[15px] font-medium"
    >
      Sign out
    </button>
  );
}
