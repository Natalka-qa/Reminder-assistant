import { z } from "zod";

const validTimezones = new Set(Intl.supportedValuesOf("timeZone"));

// The name this runtime lists for a zone, or null for none. Browsers
// differ in which name they report: newer ones say "Europe/Kyiv" where
// Node's list has "Europe/Kiev" — both are accepted, and the listed one is
// what's stored, so Settings' list still finds it.
function canonicalTimezone(tz: string): string | null {
  if (validTimezones.has(tz)) return tz;
  try {
    const resolved = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
    }).resolvedOptions().timeZone;
    return validTimezones.has(resolved) ? resolved : null;
  } catch {
    return null;
  }
}

export const timezoneSchema = z.string().transform((tz, ctx) => {
  const canonical = canonicalTimezone(tz);
  if (canonical === null) {
    ctx.addIssue({
      code: "custom",
      message: "Not a valid IANA timezone identifier",
    });
    return z.NEVER;
  }
  return canonical;
});

const minutesOfDay = z.coerce
  .number()
  .int()
  .min(0)
  .max(24 * 60);

// sprint-12-tasks.md S12-09 — when free time may be suggested, per user.
// Minutes since local midnight; workDays are ISO weekdays (1 = Monday),
// and an empty list means no work hours.
export const schedulePreferencesSchema = z
  .object({
    dayStartMinutes: minutesOfDay,
    dayEndMinutes: minutesOfDay,
    workDays: z
      .array(z.coerce.number().int().min(1).max(7))
      .transform((days) => [...new Set(days)].sort((a, b) => a - b)),
    workStartMinutes: minutesOfDay,
    workEndMinutes: minutesOfDay,
    // The latest a workout may start; empty/null = no limit.
    workoutLatestStartMinutes: z.preprocess(
      (value) => (value === "" || value == null ? null : value),
      minutesOfDay.nullable(),
    ),
  })
  .refine((prefs) => prefs.dayEndMinutes - prefs.dayStartMinutes >= 60, {
    message: "The day has to end at least an hour after it starts.",
    path: ["dayEndMinutes"],
  })
  .refine(
    (prefs) =>
      prefs.workDays.length === 0 ||
      prefs.workEndMinutes > prefs.workStartMinutes,
    {
      message: "Work has to end after it starts.",
      path: ["workEndMinutes"],
    },
  );

export type SchedulePreferences = z.output<typeof schedulePreferencesSchema>;

// The column defaults (prisma/schema.prisma), for callers that have no row.
export const DEFAULT_SCHEDULE_PREFERENCES: SchedulePreferences = {
  dayStartMinutes: 8 * 60,
  dayEndMinutes: 21 * 60,
  workDays: [1, 2, 3, 4, 5],
  workStartMinutes: 9 * 60,
  workEndMinutes: 17 * 60,
  workoutLatestStartMinutes: 20 * 60,
};

// sprint-14-tasks.md S14-06 — the reminder offsets the task forms offer
// (REMINDER_CHOICES, new-task-fields.ts): At start time, 5, 10, 15, 30 min,
// 1 hour, 1 day before. The default reminder has to be one of them.
export const REMINDER_OFFSET_MINUTES = [0, 5, 10, 15, 30, 60, 1440] as const;

// sprint-15-tasks.md S15-10, п.17 — when the morning summary goes out:
// minutes after the user's midnight, or off (null).
export const SUMMARY_MINUTES = [7 * 60, 8 * 60, 9 * 60, 10 * 60] as const;

export const telegramSummarySchema = z.preprocess(
  (value) => (value === "off" || value === null ? null : Number(value)),
  z
    .number()
    .int()
    .refine(
      (minutes) => (SUMMARY_MINUTES as readonly number[]).includes(minutes),
      { message: "Pick one of the times offered." },
    )
    .nullable(),
);

export const reminderPreferencesSchema = z.object({
  defaultReminderMinutes: z.coerce
    .number()
    .int()
    .refine(
      (minutes) =>
        (REMINDER_OFFSET_MINUTES as readonly number[]).includes(minutes),
      { message: "Pick one of the reminder times offered." },
    ),
  emailRemindersEnabled: z.preprocess(
    (value) => value === true || value === "true",
    z.boolean(),
  ),
});

export type ReminderPreferences = z.output<typeof reminderPreferencesSchema>;

export const DEFAULT_REMINDER_PREFERENCES: ReminderPreferences = {
  defaultReminderMinutes: 15,
  emailRemindersEnabled: true,
};

// Onboarding and Settings — what the app calls you ("Good morning, Anna").
// Empty clears it: the greeting falls back to "there".
export const NAME_MAX_LENGTH = 60;
export const nameSchema = z
  .string()
  .trim()
  .max(NAME_MAX_LENGTH, `Up to ${NAME_MAX_LENGTH} characters.`)
  .transform((name) => (name.length > 0 ? name : null));

/**
 * Where /onboarding may send the user once it's done: a path of this app
 * only ("/dashboard", "/tasks/new?text=…"), never another site.
 */
export function onboardingNextPath(value: unknown): string {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\")
    ? value
    : "/dashboard";
}
