import "server-only";
import { GOOGLE_REQUEST_TIMEOUT_MS } from "@/lib/google-calendar/google-calendar.config";

// Tells Google to drop the grant behind this token, so a disconnected
// calendar stops being readable with a leaked copy of it too, not only with
// ours. The token goes in the body, not the query string Google's docs show,
// to keep it out of request logs. Throws on failure like
// sendTelegramMessage; the caller treats revoking as best-effort.
export async function revokeToken(token: string): Promise<void> {
  const res = await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
    signal: AbortSignal.timeout(GOOGLE_REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Google revoke error (${res.status}): ${await res.text()}`);
  }
}
