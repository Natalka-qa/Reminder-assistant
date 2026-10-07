import { notFound } from "next/navigation";
import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { habitService } from "@/features/habits/habit.service";
import { updateHabitAction } from "@/features/habits/actions";
import { HabitCard } from "@/components/habits/habit-card";
import { HabitDays } from "@/components/habits/habit-days";
import { HabitEndActions } from "@/components/habits/habit-end-actions";
import { HabitForm } from "@/components/habits/habit-form";
import { GroupedRows } from "@/components/ui/grouped-rows";
import { SectionLabel } from "@/components/ui/section-label";

// sprint-21-tasks.md п.6 — one habit: its numbers, the last 7 days to
// correct, the settings, then Archive / Delete (п.11).
export default async function HabitPage({
  params,
}: PageProps<"/progress/habits/[id]">) {
  await verifySession();
  const user = await getCurrentUser();
  if (!user) notFound();

  const { id } = await params;
  const habit = await habitService.getDetail(
    user.id,
    id,
    user.timezone,
    new Date(),
  );
  if (!habit) notFound();

  return (
    <div className="flex max-w-[560px] flex-col gap-8">
      <div className="flex flex-col gap-1">
        <SectionLabel>
          {habit.archived ? "Archived habit" : "Habit"}
        </SectionLabel>
        <h1 className="font-display text-[45px] leading-[1.04] font-light break-words">
          {habit.title}
        </h1>
      </div>

      <GroupedRows>
        <HabitCard habit={habit} />
      </GroupedRows>

      <section className="flex flex-col gap-3" aria-labelledby="days-heading">
        <div className="flex flex-col gap-0.5">
          <h2 id="days-heading" className="text-[17px] font-medium">
            Last 7 days
          </h2>
          <p className="text-tasks-meta text-sm">
            Forgot to mark a day? Set it here.
          </p>
        </div>
        <HabitDays
          habitId={habit.id}
          kind={habit.kind}
          days={habit.recent}
          inputUnit={habit.inputUnit}
          inputStep={habit.inputStep}
        />
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="edit-heading">
        <h2 id="edit-heading" className="text-[17px] font-medium">
          Settings
        </h2>
        <HabitForm
          action={updateHabitAction.bind(null, habit.id)}
          initial={habit.form}
          showPresets={false}
          submitLabel="Save changes"
        />
      </section>

      <HabitEndActions
        habitId={habit.id}
        title={habit.title}
        archived={habit.archived}
      />
    </div>
  );
}
