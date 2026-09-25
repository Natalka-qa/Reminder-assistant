import "server-only";
import { env } from "@/lib/env";

// The Auth.js provider id of the calendar connection, and so also the
// `Account.provider` of its row — a second Google provider next to
// sign-in's "google", so sign-in keeps its minimal scopes and its tokens
// (sprint-11-tasks.md "Расхождения" п.3).
export const GOOGLE_CALENDAR_PROVIDER_ID = "google-calendar";

// The narrowest scope freeBusy.query accepts — busy intervals only, no event
// titles, descriptions or attendees ("Расхождения" п.1).
export const GOOGLE_CALENDAR_FREEBUSY_SCOPE =
  "https://www.googleapis.com/auth/calendar.freebusy";

// Every call to Google gives up after this — a slow Google must not hold up
// saving a task ("Расхождения" п.6).
export const GOOGLE_REQUEST_TIMEOUT_MS = 5000;

export function isGoogleCalendarEnabled(): boolean {
  return env.GOOGLE_CALENDAR_ENABLED === "true";
}
