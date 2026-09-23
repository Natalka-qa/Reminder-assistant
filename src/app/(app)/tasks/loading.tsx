import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the Tasks v2 layout (header, summary, controls row, one group of
// rows) so the list doesn't jump when it arrives. Wide like the page.
export default function TasksLoading() {
  return (
    <div data-layout="wide" className="flex flex-col">
      <div className="flex items-end justify-between gap-4">
        <Skeleton className="h-[45px] w-32" />
        <Skeleton className="h-5 w-20" />
      </div>
      <Skeleton className="mt-3 h-4 w-48" />
      <Skeleton className="mt-7 h-8 w-full" />
      <div className="mt-[38px] flex flex-col gap-3">
        <Skeleton className="h-3 w-20" />
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
