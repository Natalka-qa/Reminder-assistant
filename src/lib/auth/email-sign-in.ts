import "server-only";
import { env } from "@/lib/env";

// Whether email reaches anyone — EMAIL_SIGN_IN_ENABLED in lib/env.ts, set
// once EMAIL_FROM is a sender on a verified domain. Until then /login
// offers Google only, and new accounts start with email reminders off.
export function isEmailSignInEnabled(): boolean {
  return env.EMAIL_SIGN_IN_ENABLED === "true";
}
