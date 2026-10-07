"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WeekdayPicker } from "@/components/ui/weekday-picker";
import type { HabitFormState } from "@/features/habits/actions";
import type { HabitFormDefaults } from "@/features/habits/habit-view";
import { HABIT_TITLE_MAX, HABIT_UNIT_MAX } from "@/lib/validation/habit";
import { cn } from "@/lib/utils";

// Strings, as typed — kept in state so a failed save (React resets the
// form after an action) shows them again.
export type HabitFormValues = HabitFormDefaults;

const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7];

export const EMPTY_HABIT: HabitFormValues = {
  title: "",
  kind: "CHECK",
  target: "1",
  unit: "",
  step: "1",
  weekdays: EVERY_DAY,
  dayTargets: [],
  tapSetsGoal: false,
};

function amountHabit(
  title: string,
  target: string,
  unit: string,
  step: string,
  tapSetsGoal: boolean,
): HabitFormValues {
  return {
    ...EMPTY_HABIT,
    title,
    kind: "COUNT",
    target,
    unit,
    step,
    tapSetsGoal,
  };
}

// п.6, доработка п.4 — one tap fills the form; everything can still be
// changed. Sleep, reading, a workout and phone-free time are marked at
// once (the goal); water and steps add up.
const PRESETS: { label: string; values: HabitFormValues }[] = [
  { label: "Sleep 8 h", values: amountHabit("Sleep", "8", "h", "0.25", true) },
  {
    label: "Walk 7,000 steps",
    values: amountHabit("Walk", "7000", "steps", "1000", false),
  },
  {
    label: "Water 1.5 L",
    values: amountHabit("Water", "1.5", "L", "0.25", false),
  },
  {
    label: "Morning workout 10 min",
    values: amountHabit("Morning workout", "10", "min", "5", true),
  },
  {
    label: "Reading 1 h",
    values: amountHabit("Reading", "1", "h", "0.25", true),
  },
  {
    label: "No phone 1 h",
    values: amountHabit("No phone", "1", "h", "0.25", true),
  },
];

const UNIT_SUGGESTIONS = [
  "L",
  "ml",
  "h",
  "min",
  "steps",
  "glasses",
  "pages",
  "times",
];

const KINDS = [
  { value: "CHECK", label: "Done or not", hint: "Vitamins, make the bed" },
  { value: "COUNT", label: "An amount", hint: "Sleep, water, steps" },
] as const;

const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// sprint-21-tasks.md S21-06, доработка п.2–5 — new habit and edit habit.
// Big units are typed big ("8 h", "1.5 L") and saved small (minutes, ml).
export function HabitForm({
  action,
  initial,
  showPresets,
  submitLabel,
}: {
  action: (
    state: HabitFormState,
    formData: FormData,
  ) => Promise<HabitFormState>;
  initial: HabitFormValues;
  showPresets: boolean;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {
    status: "idle",
  });
  const [values, setValues] = useState(initial);
  // Remount the inputs when a preset replaces everything.
  const [revision, setRevision] = useState(0);
  const id = useId();
  const byDay = values.dayTargets.length === 7;
  const fields = ["title", "target", "step", "weekdays", "unit", "dayTargets"];
  const error = (field: string) =>
    state.status === "error" && state.field === field
      ? state.message
      : undefined;
  const generalError =
    state.status === "error" && !fields.includes(state.field ?? "")
      ? state.message
      : undefined;

  function set<K extends keyof HabitFormValues>(
    key: K,
    value: HabitFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function toggleDay(day: number) {
    set(
      "weekdays",
      values.weekdays.includes(day)
        ? values.weekdays.filter((d) => d !== day)
        : [...values.weekdays, day],
    );
  }

  function setByDay(on: boolean) {
    set(
      "dayTargets",
      on
        ? EVERY_DAY.map((day) =>
            values.weekdays.includes(day) ? values.target : "",
          )
        : [],
    );
  }

  function setDayTarget(index: number, value: string) {
    set(
      "dayTargets",
      values.dayTargets.map((goal, i) => (i === index ? value : goal)),
    );
  }

  const unitLabel = values.unit.trim();

  return (
    <form action={formAction} className="flex flex-col gap-7">
      {showPresets && (
        <div className="flex flex-col gap-2.5">
          <p className="text-tasks-meta text-sm">Start from one of these</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setValues(preset.values);
                  setRevision((r) => r + 1);
                }}
                className={cn(
                  "rounded-pill min-h-11 border px-3.5 py-2 text-sm",
                  values.title === preset.values.title &&
                    values.kind === preset.values.kind
                    ? "bg-chip-selected-bg border-blue-ring-border text-chip-selected-text"
                    : "bg-surface border-border text-text-primary",
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <input type="hidden" name="kind" value={values.kind} />
      <input
        type="hidden"
        name="tapSetsGoal"
        value={String(values.tapSetsGoal)}
      />
      <input type="hidden" name="dayMode" value={byDay ? "byDay" : "same"} />

      <div key={revision} className="flex flex-col gap-7">
        <Field id={`${id}-title`} label="Name" error={error("title")}>
          <Input
            id={`${id}-title`}
            name="title"
            defaultValue={values.title}
            onChange={(event) => set("title", event.target.value)}
            maxLength={HABIT_TITLE_MAX}
            placeholder="Sleep, water, stretching…"
            aria-invalid={Boolean(error("title")) || undefined}
            required
          />
        </Field>

        <Choice
          legend="How you track it"
          options={KINDS.map((kind) => ({
            label: kind.label,
            hint: kind.hint,
            selected: values.kind === kind.value,
            onSelect: () => set("kind", kind.value),
          }))}
        />

        {values.kind === "COUNT" && (
          <>
            <Field
              id={`${id}-unit`}
              label="Unit"
              hint="Hours and litres are kept as minutes and ml"
              error={error("unit")}
            >
              <Input
                id={`${id}-unit`}
                name="unit"
                list={`${id}-units`}
                defaultValue={values.unit}
                onChange={(event) => set("unit", event.target.value)}
                maxLength={HABIT_UNIT_MAX}
                placeholder="h, L, steps…"
              />
              <datalist id={`${id}-units`}>
                {UNIT_SUGGESTIONS.map((unit) => (
                  <option key={unit} value={unit} />
                ))}
              </datalist>
            </Field>

            <Choice
              legend="One tap on Home"
              options={[
                {
                  label: "Marks the goal",
                  hint: "Sleep, reading — done at once",
                  selected: values.tapSetsGoal,
                  onSelect: () => set("tapSetsGoal", true),
                },
                {
                  label: "Adds a step",
                  hint: "Water, steps — adds up",
                  selected: !values.tapSetsGoal,
                  onSelect: () => set("tapSetsGoal", false),
                },
              ]}
            />

            {!values.tapSetsGoal && (
              <Field
                id={`${id}-step`}
                label={`One tap adds${unitLabel ? ` (${unitLabel})` : ""}`}
                error={error("step")}
              >
                <Input
                  id={`${id}-step`}
                  name="step"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  defaultValue={values.step}
                  onChange={(event) => set("step", event.target.value)}
                  aria-invalid={Boolean(error("step")) || undefined}
                  className="w-40"
                />
              </Field>
            )}
          </>
        )}

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2.5 text-sm font-medium">
            {values.kind === "COUNT" ? "Goal and days" : "Days"}
          </legend>

          {values.kind === "COUNT" && (
            <div
              role="radiogroup"
              aria-label="Goal"
              className="bg-surface border-border rounded-pill flex w-fit border p-1"
            >
              {[
                { label: "Same every day", on: false },
                { label: "Different by day", on: true },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  role="radio"
                  aria-checked={byDay === option.on}
                  onClick={() => setByDay(option.on)}
                  className={cn(
                    "rounded-pill min-h-10 px-3.5 text-sm",
                    byDay === option.on
                      ? "bg-chip-selected-bg text-chip-selected-text font-medium"
                      : "text-text-secondary",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {values.kind === "COUNT" && byDay ? (
            <div className="flex flex-col gap-1.5">
              {values.dayTargets.map((goal, index) => (
                <div
                  key={WEEKDAY_NAMES[index]}
                  className="flex items-center gap-3"
                >
                  <label
                    htmlFor={`${id}-day-${index}`}
                    className="text-text-primary w-24 text-sm"
                  >
                    {WEEKDAY_NAMES[index]}
                  </label>
                  <Input
                    id={`${id}-day-${index}`}
                    name="dayTargets"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    value={goal}
                    onChange={(event) =>
                      setDayTarget(index, event.target.value)
                    }
                    placeholder="Off"
                    className="w-28 py-2"
                  />
                  <span className="text-tasks-meta text-sm">{unitLabel}</span>
                </div>
              ))}
              <p className="text-tasks-meta text-xs">
                Leave a day empty for a day off.
              </p>
              {error("dayTargets") && (
                <FieldError>{error("dayTargets")}</FieldError>
              )}
            </div>
          ) : (
            <>
              {values.kind === "COUNT" && (
                <Field
                  id={`${id}-target`}
                  label={`Goal a day${unitLabel ? ` (${unitLabel})` : ""}`}
                  error={error("target")}
                >
                  <Input
                    id={`${id}-target`}
                    name="target"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    defaultValue={values.target}
                    onChange={(event) => set("target", event.target.value)}
                    aria-invalid={Boolean(error("target")) || undefined}
                    className="w-40"
                    required
                  />
                </Field>
              )}
              {values.weekdays.map((day) => (
                <input key={day} type="hidden" name="weekdays" value={day} />
              ))}
              <WeekdayPicker selected={values.weekdays} onToggle={toggleDay} />
              {error("weekdays") && (
                <FieldError>{error("weekdays")}</FieldError>
              )}
            </>
          )}
        </fieldset>
      </div>

      {generalError && <FieldError>{generalError}</FieldError>}

      <Button type="submit" disabled={pending} className="h-[52px]">
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

function Choice({
  legend,
  options,
}: {
  legend: string;
  options: {
    label: string;
    hint: string;
    selected: boolean;
    onSelect: () => void;
  }[];
}) {
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-2.5 text-sm font-medium">{legend}</legend>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            aria-pressed={option.selected}
            onClick={option.onSelect}
            className={cn(
              "flex flex-col items-start gap-0.5 rounded-[14px] border px-4 py-3 text-left",
              option.selected
                ? "bg-chip-selected-bg border-blue-ring-border text-chip-selected-text"
                : "bg-surface border-border text-text-primary",
            )}
          >
            <span className="text-[15px] font-medium">{option.label}</span>
            <span className="text-xs opacity-80">{option.hint}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p className="text-tasks-meta text-xs">{hint}</p>}
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-overdue-ink text-xs">
      {children}
    </p>
  );
}
