import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { DatePopover } from "@/components/ui/date-calendar";
import { cn } from "@/lib/utils";

// sprint-14-tasks.md S14-03 — the pieces New task (NEW_TASK_V2_UPDATE.md)
// and Edit task are both built from. Presentational only: each takes a
// value and reports a change; which value wins (a hand edit, the text, a
// default, the task as saved) is the form's business.

export const EYEBROW =
  "text-newtask-quiet-text text-eyebrow tracking-eyebrow font-semibold uppercase";

export function Chevron() {
  return (
    <ChevronDown
      aria-hidden
      className="text-newtask-chevron pointer-events-none absolute top-1/2 right-2.5 size-3 -translate-y-1/2"
      strokeWidth={1.6}
    />
  );
}

// § 4 — a date or time shown as text, with the real <input> laid over it,
// transparent: a tap or click lands on the input itself, so the browser's
// own picker opens — the native one on a phone. (A hidden input opened
// through showPicker() from a separate button doesn't open at all in
// mobile Safari.) With a mouse, clicking a date field's text doesn't open
// its picker by itself, so showPicker() does that too; where it isn't
// supported or the picker is already open, the field still takes typing.
// Hover and focus show on the text underneath. `disabled` (a recurring
// task's start date, S14-04) leaves the text only.
// 2026-10-17 — a date opens DateCalendar instead, the app's own month
// grid: neither Chrome's popup nor iOS's (in the Telegram app too) looked
// like the app. Times stay native.
export function PickerField({
  type,
  value,
  ariaLabel,
  onChange,
  disabled,
  today,
  className,
  children,
}: {
  type: "date" | "time";
  value: string;
  ariaLabel: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** A date's calendar rings it and quiets the days before. */
  today?: string;
  className?: string;
  children: ReactNode;
}) {
  const ownCalendar = type === "date" && !disabled;
  return (
    <div className="group relative">
      <span
        aria-hidden
        className={cn(
          "text-text-primary group-hover:bg-newtask-control-hover group-has-[input:focus-visible]:ring-ring group-has-[button:focus-visible]:ring-ring group-has-[[data-popup-open]]:bg-newtask-control-hover block min-h-11 rounded-[10px] px-3 py-2.5 text-[19px] whitespace-nowrap transition-colors group-has-[button:focus-visible]:ring-2 group-has-[input:focus-visible]:ring-2",
          disabled && "text-newtask-quiet-text group-hover:bg-transparent",
          className,
        )}
      >
        {children}
      </span>
      {ownCalendar ? (
        <DatePopover
          value={value}
          today={today}
          ariaLabel={ariaLabel}
          onChange={onChange}
        />
      ) : (
        <input
          type={type}
          value={value}
          aria-label={ariaLabel}
          disabled={disabled}
          // A cleared picker leaves the field as it was: the task needs both.
          onChange={(event) => {
            if (event.target.value) onChange(event.target.value);
          }}
          onClick={(event) => {
            if (!window.matchMedia("(pointer: fine)").matches) return;
            try {
              event.currentTarget.showPicker();
            } catch {
              // Already open, or not supported — typing still works.
            }
          }}
          // 19px like the text: mobile Safari zooms into a field under 16px.
          className={cn(
            "absolute inset-0 size-full cursor-pointer appearance-none text-[19px] opacity-0",
            disabled && "cursor-default",
          )}
        />
      )}
    </div>
  );
}

// § 6 — label left, a borderless native select right, a hairline above.
export function SelectRow({
  id,
  label,
  value,
  onChange,
  options,
  bordered = true,
}: {
  id: string;
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  options: readonly { value: string | number; label: string }[];
  bordered?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 py-1.5",
        bordered && "border-newtask-hairline border-t",
      )}
    >
      <label htmlFor={id} className="text-text-primary text-[15px]">
        {label}
      </label>
      <div className="relative -mr-2.5">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="text-text-primary hover:bg-newtask-control-hover min-h-11 max-w-full cursor-pointer appearance-none rounded-[10px] bg-transparent py-2.5 pr-[30px] pl-3 text-right text-[15px] transition-colors [text-align-last:right]"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Chevron />
      </div>
    </div>
  );
}

/** A rose line under When: a time already past, an overlap. */
export function RoseNotice({ children }: { children: ReactNode }) {
  return (
    <p className="text-rose-tint-text text-[13px]/[1.5] text-pretty">
      {children}
    </p>
  );
}
