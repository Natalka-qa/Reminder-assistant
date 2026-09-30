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

// sprint-14-tasks.md S14-06 — the reminder offsets the task forms offer
// (REMINDER_CHOICES, new-task-fields.ts): At start time, 5, 10, 15, 30 min,
// 1 hour, 1 day before. The default reminder has to be one of them.
export const REMINDER_OFFSET_MINUTES = [0, 5, 10, 15, 30, 60, 1440] as const;

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
