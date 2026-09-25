import "server-only";
import { z } from "zod";
import { GOOGLE_REQUEST_TIMEOUT_MS } from "@/lib/google-calendar/google-calendar.config";

export type BusyInterval = { start: Date; end: Date };

export type FreeBusyResult =
  | { status: "ok"; busy: BusyInterval[] }
  // The access token was rejected — revoked at Google before it expired.
  // Worth one forced refresh: that either gets a working token or reveals
  // the revocation (invalid_grant).
  | { status: "unauthorized" }
  | { status: "unavailable" };

// Plain `fetch`, same as refresh-access-token.ts. Only the primary calendar
// ("Расхождения" п.9), and only free/busy — the response carries no event
// titles or details to begin with ("Расхождения" п.1). Network errors and
// the timeout throw; googleCalendarService turns them into "unavailable".
export async function queryFreeBusy(
  accessToken: string,
  timeMin: Date,
  timeMax: Date,
): Promise<FreeBusyResult> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: [{ id: "primary" }],
    }),
    signal: AbortSignal.timeout(GOOGLE_REQUEST_TIMEOUT_MS),
  });
  if (res.status === 401) {
    return { status: "unauthorized" };
  }
  if (!res.ok) {
    return { status: "unavailable" };
  }
  return parseFreeBusyResponse(await res.json().catch(() => null));
}

const instant = z
  .string()
  .transform((value) => new Date(value))
  .refine((date) => !Number.isNaN(date.getTime()));

// Unknown keys are dropped by zod, so nothing beyond start/end survives
// parsing even if Google ever adds more.
const freeBusySchema = z.object({
  calendars: z.object({
    primary: z.object({
      busy: z.array(z.object({ start: instant, end: instant })).default([]),
      // Google reports per-calendar failures here (e.g. "notFound",
      // "internalError") alongside a 200 and an empty busy list — which
      // must not read as "free all day".
      errors: z.array(z.unknown()).optional(),
    }),
  }),
});

export function parseFreeBusyResponse(json: unknown): FreeBusyResult {
  const parsed = freeBusySchema.safeParse(json);
  if (!parsed.success) {
    return { status: "unavailable" };
  }
  const { busy, errors } = parsed.data.calendars.primary;
  if (errors && errors.length > 0) {
    return { status: "unavailable" };
  }
  return {
    status: "ok",
    busy: busy
      .filter((interval) => interval.start < interval.end)
      .map(({ start, end }) => ({ start, end })),
  };
}
