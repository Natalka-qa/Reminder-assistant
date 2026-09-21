import { Skeleton } from "@/components/ui/skeleton";

function RowSkeleton() {
  return (
    <div className="flex items-start gap-4 py-[11px]">
      <Skeleton className="h-4 w-[46px] shrink-0" />
      <Skeleton className="rounded-pill mt-1 size-[9px] shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

// Mirrors dashboard/page.tsx's Home v2 shape (greeting, assistant insight,
// Up next, then a plain timeline) so this doesn't flash a different layout
// before the real content arrives.
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-[30px]">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-14 w-48" />
        <Skeleton className="h-4 w-56" />
      </div>

      <Skeleton className="h-[150px] w-full rounded-[20px]" />

      <div className="flex flex-col gap-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-[150px] w-full" />
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-32" />
        <div className="flex flex-col">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      </div>
    </div>
  );
}
