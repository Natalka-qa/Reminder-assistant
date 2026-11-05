import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { checklistService } from "@/features/checklists/checklist.service";
import { updateChecklistAction } from "@/features/checklists/actions";
import { progressLabel } from "@/features/checklists/checklist-items";
import { ChecklistEditor } from "@/components/checklists/checklist-editor";
import { ChecklistEndActions } from "@/components/checklists/checklist-end-actions";
import { ChecklistForm } from "@/components/checklists/checklist-form";

// sprint-25-tasks.md S25-02 — one list: its items (tick, add, edit, drag),
// then Rename, Pin, Archive, Delete.
export default async function ListPage({ params }: PageProps<"/lists/[id]">) {
  await verifySession();
  const user = await getCurrentUser();
  if (!user) notFound();

  const { id } = await params;
  const list = await checklistService.getOne(user.id, id);
  if (!list) notFound();

  const items = list.items.map(({ id, text, note, checked, sortOrder }) => ({
    id,
    text,
    note,
    checked,
    sortOrder,
  }));
  // A new key whenever the server's items change: the editor drops its
  // own copy and shows these.
  const version = items
    .map(
      (item) =>
        `${item.id}${+item.checked}${item.sortOrder}${item.text}${item.note}`,
    )
    .join("|");

  return (
    <div className="flex max-w-[560px] flex-col gap-7">
      <div className="flex flex-col gap-2">
        <Link
          href="/lists"
          className="text-accent-text -ml-1 flex min-h-11 items-center gap-0.5 self-start text-sm font-semibold"
        >
          <ChevronLeft aria-hidden className="size-4" strokeWidth={2} />
          Lists
        </Link>
        <h1 className="font-display flex items-baseline gap-3 text-[40px] leading-[1.04] font-light break-words">
          <span aria-hidden className="text-[32px]">
            {list.icon}
          </span>
          <span className="min-w-0">{list.title}</span>
        </h1>
        <p className="text-tasks-meta text-[15px] tabular-nums">
          {list.archivedAt ? "Archived · " : ""}
          {list.progress.total === 0
            ? "No items yet"
            : `${progressLabel(list.progress)} done`}
        </p>
      </div>

      <ChecklistEditor
        key={version}
        checklistId={list.id}
        title={list.title}
        items={items}
      />

      <details className="group">
        <summary className="text-accent-text min-h-11 cursor-pointer py-2 text-sm font-semibold">
          Rename or change icon
        </summary>
        <div className="mt-3">
          <ChecklistForm
            action={updateChecklistAction.bind(null, list.id)}
            initial={{ title: list.title, icon: list.icon }}
            submitLabel="Save"
          />
        </div>
      </details>

      <ChecklistEndActions
        checklistId={list.id}
        title={list.title}
        pinned={list.pinned}
        archived={list.archivedAt !== null}
      />
    </div>
  );
}
