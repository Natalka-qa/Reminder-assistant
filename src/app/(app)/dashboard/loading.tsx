import { Skeleton } from "@/components/ui/skeleton";

function RowSkeleton() {
  return (
    <div className="border-separator flex items-start gap-4 border-b py-[18px]">
      <Skeleton className="h-4 w-[54px] shrink-0" />
      <Skeleton className="rounded-pill mt-[3px] size-3.5 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-[17px] w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

// Mirrors dashboard/page.tsx's real shape (greeting block, then a flat list
// of rows) so this doesn't flash a different layout before the real content
// arrives.
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-[30px]">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-14 w-48" />
        <Skeleton className="h-4 w-56" />
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-20" />
        <div className="flex flex-col">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      </div>
    </div>
  );
}
