import { z } from "zod";

// sprint-21-tasks.md п.1–3 — a habit as the form sends it. Big units are
// typed big and stored small, whole: litres as millilitres ("2", step
// "0.25" → 2000 ml, 250), hours as minutes ("1.5" → 90 min) — no
// fractions in the database (п.2, доработка п.3).

export const HABIT_TITLE_MAX = 60;
export const HABIT_UNIT_MAX = 20;
const AMOUNT_MAX = 1_000_000;

// Typed unit → stored unit and how many stored units one typed is.
const UNIT_ALIASES: Record<string, { unit: string; scale: number }> = {};
for (const name of ["l", "litre", "litres", "liter", "liters"]) {
  UNIT_ALIASES[name] = { unit: "ml", scale: 1000 };
}
for (const name of ["h", "hr", "hrs", "hour", "hours"]) {
  UNIT_ALIASES[name] = { unit: "min", scale: 60 };
}
for (const name of ["min", "mins", "minute", "minutes"]) {
  UNIT_ALIASES[name] = { unit: "min", scale: 1 };
}

/** `value × scale` as a whole number, or null if it isn't one (1.1 L ok). */
export function wholeUnits(value: number, scale: number): number | null {
  const scaled = value * scale;
  const rounded = Math.round(scaled);
  return Math.abs(scaled - rounded) < 1e-6 ? rounded : null;
}

const amount = z.coerce
  .number({ error: "Enter a number." })
  .positive("Enter a number above 0.")
  .max(AMOUNT_MAX, "That's too many.");

function wholeMessage(scale: number): string {
  if (scale === 60) return "Use whole minutes (0.25 h is 15 min).";
  if (scale === 1000) return "Up to 3 decimals for litres.";
  return "Use a whole number.";
}

/** Доработка п.2 — the ± in a goal-filling habit's sheet. */
function defaultGoalStep(unit: string | null, largest: number): number {
  if (unit === "min") return largest >= 60 ? 15 : 5;
  if (unit === "ml") return 250;
  return Math.max(1, Math.round(largest / 10));
}

export const habitInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Give the habit a name.")
      .max(
        HABIT_TITLE_MAX,
        `Keep the name under ${HABIT_TITLE_MAX} characters.`,
      ),
    kind: z.enum(["CHECK", "COUNT"]),
    target: z.unknown().optional(),
    unit: z.string().trim().max(HABIT_UNIT_MAX).optional(),
    step: z.unknown().optional(),
    weekdays: z
      .array(z.coerce.number().int().min(1).max(7))
      .optional()
      .transform((days) => [...new Set(days ?? [])].sort((a, b) => a - b)),
    // Доработка п.5 — "byDay": seven goals, Monday first, "" = off.
    dayMode: z.enum(["same", "byDay"]).optional(),
    dayTargets: z.array(z.unknown()).optional(),
    // Доработка п.2.
    tapSetsGoal: z
      .union([z.boolean(), z.enum(["true", "false"])])
      .optional()
      .transform((value) => value === true || value === "true"),
  })
  .transform((input, ctx) => {
    const fail = (path: string, message: string) => {
      ctx.addIssue({ code: "custom", path: [path], message });
      return z.NEVER;
    };
    const base = { title: input.title, kind: input.kind };

    if (input.kind === "CHECK") {
      if (input.weekdays.length === 0) {
        return fail("weekdays", "Pick at least one day.");
      }
      return {
        ...base,
        target: 1,
        unit: null,
        step: 1,
        weekdays: input.weekdays,
        dayTargets: [] as number[],
        tapSetsGoal: false,
      };
    }

    const rawUnit = input.unit || null;
    const alias = rawUnit ? UNIT_ALIASES[rawUnit.toLowerCase()] : undefined;
    const unit = alias?.unit ?? rawUnit;
    const scale = alias?.scale ?? 1;

    const toUnits = (raw: unknown, path: string): number | null => {
      const parsed = amount.safeParse(raw);
      if (!parsed.success) {
        fail(path, parsed.error.issues[0].message);
        return null;
      }
      const units = wholeUnits(parsed.data, scale);
      if (units === null) fail(path, wholeMessage(scale));
      return units;
    };

    let goals: number[];
    if (input.dayMode === "byDay") {
      const raw = input.dayTargets ?? [];
      goals = [];
      for (let index = 0; index < 7; index += 1) {
        const typed = raw[index];
        if (typed === undefined || typed === null || typed === "") {
          goals.push(0);
          continue;
        }
        const units = toUnits(typed, "dayTargets");
        if (units === null) return z.NEVER;
        goals.push(units);
      }
      if (goals.every((goal) => goal === 0)) {
        return fail("dayTargets", "Set a goal for at least one day.");
      }
    } else {
      if (input.weekdays.length === 0) {
        return fail("weekdays", "Pick at least one day.");
      }
      const target = toUnits(input.target, "target");
      if (target === null) return z.NEVER;
      goals = [1, 2, 3, 4, 5, 6, 7].map((day) =>
        input.weekdays.includes(day) ? target : 0,
      );
    }

    const on = goals.filter((goal) => goal > 0);
    const largest = Math.max(...on);
    const sameGoal = on.every((goal) => goal === largest);
    const weekdays = goals.flatMap((goal, index) =>
      goal > 0 ? [index + 1] : [],
    );

    let step: number;
    if (input.tapSetsGoal) {
      step = defaultGoalStep(unit, largest);
    } else {
      const parsed = toUnits(input.step || 1 / scale, "step");
      if (parsed === null) return z.NEVER;
      if (parsed > largest) {
        return fail("step", "A tap can't add more than the goal.");
      }
      step = parsed;
    }

    return {
      ...base,
      // One goal on its days is stored the simple way; only real
      // differences keep seven.
      target: largest,
      unit,
      step,
      weekdays,
      dayTargets: sameGoal ? ([] as number[]) : goals,
      tapSetsGoal: input.tapSetsGoal,
    };
  });

export type HabitInput = z.output<typeof habitInputSchema>;

/**
 * One day's value as typed (п.6), in the units it's shown in — litres or
 * hours for a big goal (`inputScale`).
 */
export function habitValueSchema(scale: number) {
  return z.coerce
    .number({ error: "Enter a number." })
    .min(0, "Enter 0 or more.")
    .max(AMOUNT_MAX)
    .transform((value, ctx) => {
      const units = wholeUnits(value, scale);
      if (units === null) {
        ctx.addIssue({ code: "custom", message: wholeMessage(scale) });
        return z.NEVER;
      }
      return units;
    });
}

export const habitDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Not a date.");
