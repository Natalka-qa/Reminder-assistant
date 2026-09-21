import Link from "next/link";
import { AssistantMark } from "@/components/dashboard/assistant-mark";

// HOME_V2_UPDATE.md § 5 — "A small suggestion". Only rendered by the page
// when home-view.ts's buildCollisionSuggestion finds a real Fixed+Flexible
// (or Flexible+Flexible) collision to suggest moving — there's no ML/
// heuristic "suggestion engine" in this codebase, so the copy is always
// this one computed collision case, never a fabricated generic tip (same
// "don't fake AI" principle as the dropped Dashboard/Task-detail AI
// suggestion cards elsewhere in the app). "Review with assistant →" in the
// reference points at a screen that was never built; this links at the
// movable task's own edit page instead, the real place to act on it.
export function SuggestionCard({
  body,
  editHref,
}: {
  body: string;
  editHref: string;
}) {
  return (
    <div className="bg-home-sage border-home-sage-border relative flex flex-col gap-2.5 overflow-hidden rounded-[18px] border p-5">
      <svg
        aria-hidden
        width="150"
        height="110"
        viewBox="0 0 150 110"
        fill="none"
        className="pointer-events-none absolute -top-[30px] -right-6"
      >
        <circle cx="94" cy="46" r="52" stroke="#E0E6D9" strokeDasharray="2 9" />
        <circle cx="94" cy="46" r="30" stroke="#E4E9DE" />
      </svg>

      <div className="relative flex items-center gap-2.5">
        <AssistantMark tone="suggestion" size={15} />
        <span className="text-text-primary text-[14px] font-semibold">
          A small suggestion
        </span>
      </div>
      <p className="text-text-secondary relative max-w-[320px] text-[14px] leading-[1.6] text-pretty">
        {body}
      </p>
      <Link
        href={editHref}
        className="text-burgundy relative self-start text-[13px] font-semibold"
      >
        Move this task →
      </Link>
    </div>
  );
}
