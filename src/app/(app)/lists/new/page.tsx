import { verifySession } from "@/lib/auth/dal";
import { createChecklistAction } from "@/features/checklists/actions";
import { ChecklistForm } from "@/components/checklists/checklist-form";

// sprint-25-tasks.md S25-02, S25-03 — a new list, from a template or
// empty; saving opens it.
export default async function NewListPage() {
  await verifySession();
  return (
    <div className="flex max-w-[560px] flex-col gap-7">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[45px] leading-[1] font-light">
          New list
        </h1>
        <p className="text-tasks-meta text-[15px]">
          Name it; add the items on the next screen.
        </p>
      </div>
      <ChecklistForm
        action={createChecklistAction}
        initial={{ title: "", icon: "📝" }}
        submitLabel="Create list"
        showTemplates
      />
    </div>
  );
}
