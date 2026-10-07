import { verifySession } from "@/lib/auth/dal";
import { createHabitAction } from "@/features/habits/actions";
import { EMPTY_HABIT, HabitForm } from "@/components/habits/habit-form";

// sprint-21-tasks.md п.6 — a new habit, from Progress' "+ New habit" or the
// strip on Home. Saving goes back to Progress.
export default async function NewHabitPage() {
  await verifySession();
  return (
    <div className="flex max-w-[560px] flex-col gap-7">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[45px] leading-[1] font-light">
          New habit
        </h1>
        <p className="text-tasks-meta text-[15px]">
          Something you do every day, or on the days you pick.
        </p>
      </div>
      <HabitForm
        action={createHabitAction}
        initial={EMPTY_HABIT}
        showPresets
        submitLabel="Add habit"
      />
    </div>
  );
}
