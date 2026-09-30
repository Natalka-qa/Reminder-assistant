import { useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { EYEBROW } from "./shared";

// § 7 — hidden behind "+ Add a note" until asked for; opening it moves
// focus into it. Edit task starts it open when the task has a note — that
// doesn't take the focus.
export function NoteField({
  id,
  open,
  onOpen,
  value,
  onChange,
}: {
  id: string;
  open: boolean;
  onOpen: () => void;
  value: string;
  onChange: (value: string) => void;
}) {
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const openedHere = useRef(false);

  useEffect(() => {
    if (open && openedHere.current) {
      noteRef.current?.focus();
    }
  }, [open]);

  return open ? (
    <div className="-mt-1.5 flex flex-col gap-2">
      <label htmlFor={id} className={EYEBROW}>
        Note
      </label>
      <textarea
        ref={noteRef}
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Anything you’ll want to know then"
        className="border-border bg-surface text-text-primary placeholder:text-placeholder-text focus:border-burgundy w-full resize-y rounded-[14px] border px-4 py-3.5 text-[15px]/[1.55] outline-none"
      />
    </div>
  ) : (
    <button
      type="button"
      onClick={() => {
        openedHere.current = true;
        onOpen();
      }}
      className="text-burgundy hover:text-burgundy-hover -mt-3.5 flex min-h-11 items-center gap-2 self-start py-2.5 text-[14px] font-semibold transition-colors"
    >
      <Plus aria-hidden className="size-3.5" strokeWidth={1.8} />
      Add a note
    </button>
  );
}
