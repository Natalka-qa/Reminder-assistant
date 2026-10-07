import Link from "next/link";
import { newTaskHref, type TaskExample } from "@/features/onboarding/examples";

// The empty Home — the same sentences as /onboarding's last step, each
// opening New task with it typed in, so a quiet day still shows how a task
// is written.
export function TaskExamples({ examples }: { examples: TaskExample[] }) {
  return (
    <div className="-mt-[72px] flex flex-col items-center gap-2 pb-10 text-center">
      <p className="text-text-secondary text-[14px]">
        Or write one the way you&apos;d say it:
      </p>
      <ul className="flex flex-col items-center gap-1">
        {examples.map((example) => (
          <li key={example.text}>
            <Link
              href={newTaskHref(example.text)}
              className="text-burgundy decoration-newtask-example-underline hover:decoration-burgundy inline-flex min-h-11 items-center text-[15px] underline underline-offset-[3px]"
            >
              {example.text}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
