import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { checklistService } from "@/features/checklists/checklist.service";
import { ChecklistRows } from "@/components/checklists/checklist-rows";

// sprint-25-tasks.md S25-02 — Lists: groceries, packing, a workout — things
// to tick off, not tasks with a time.
export default async function ListsPage() {
  await verifySession();
  const user = await getCurrentUser();
  const [active, archived] = user
    ? await Promise.all([
        checklistService.getAll(user.id),
        checklistService.getArchived(user.id),
      ])
    : [[], []];

  return (
    <div className="flex max-w-[560px] flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[45px] leading-[1] font-light">
          Lists
        </h1>
        <p className="text-tasks-meta text-[15px]">
          Things to tick off — groceries, packing, a workout.
        </p>
      </div>
      <ChecklistRows active={active} archived={archived} />
    </div>
  );
}
