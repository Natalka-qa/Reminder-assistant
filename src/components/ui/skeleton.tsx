import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      // design_handoff_reminder_assistant/README.md § Skeletons — shimmer,
      // not Tailwind's default pulse; no spinners anywhere in this design.
      className={cn("bg-skeleton animate-shimmer rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
