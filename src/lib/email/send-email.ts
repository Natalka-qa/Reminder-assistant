import "server-only";
import { env } from "@/lib/env";

// Plain `fetch` against Resend's REST API — the same approach next-auth's
// built-in Resend provider uses for magic-link emails (see
// node_modules/@auth/core/src/providers/resend.ts) — not worth pulling in
// the `resend` SDK for a single call site.
export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html: string,
): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, text, html }),
  });
  if (!res.ok) {
    throw new Error(`Resend error (${res.status}): ${await res.text()}`);
  }
}
