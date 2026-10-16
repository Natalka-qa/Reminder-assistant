import type { NextRequest } from "next/server";
import { handlers } from "@/lib/auth/config";
import { providerErrorRedirect } from "@/lib/auth/provider-error";
import { GOOGLE_CALENDAR_PROVIDER_ID } from "@/lib/google-calendar/google-calendar.config";

// A provider's error (Google's "Отмена") is answered before Auth.js, which
// would show "Server error" for it — see provider-error.ts.
export function GET(request: NextRequest) {
  const redirect = providerErrorRedirect(
    request.nextUrl,
    GOOGLE_CALENDAR_PROVIDER_ID,
  );
  return redirect ? Response.redirect(redirect) : handlers.GET(request);
}

export const { POST } = handlers;
