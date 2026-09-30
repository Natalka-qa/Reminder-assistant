import { z } from "zod";

const validTimezones = new Set(Intl.supportedValuesOf("timeZone"));

export const timezoneSchema = z
  .string()
  .refine((tz) => validTimezones.has(tz), {
    message: "Not a valid IANA timezone identifier",
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
