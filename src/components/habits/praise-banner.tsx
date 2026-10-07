// sprint-21-tasks.md п.8 — the good news on Progress, worked out from the
// marks (habit-praise.ts). Warm rose, the app's "something nice" colour.
export function PraiseBanner({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <div
      role="status"
      className="bg-rose-tint border-rose-tint-border flex flex-col gap-1.5 rounded-[18px] border px-5 py-4"
    >
      {lines.map((line) => (
        <p key={line} className="text-text-primary text-[15px] leading-snug">
          <span aria-hidden className="mr-1.5">
            🎉
          </span>
          {line}
        </p>
      ))}
    </div>
  );
}
