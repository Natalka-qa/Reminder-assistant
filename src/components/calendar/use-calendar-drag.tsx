"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UNDO_BUTTON_CLASS } from "@/lib/undo-toast";
import { noteDeparture } from "@/components/calendar/block-motion";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  moveOccurrenceAction,
  undoMoveOccurrenceAction,
} from "@/features/scheduling/actions";
import {
  canDrop,
  dragStart,
  isDraggable,
  minutesAt,
  moveLabel,
  type Now,
} from "@/features/scheduling/calendar-drag";
import { formatMinutes } from "@/features/scheduling/calendar-layout";
import type { CalendarEvent } from "@/features/scheduling/calendar-view";

// sprint-22-tasks.md п.2–7 — dragging a block in Week. Mouse: press and
// move. Touch: hold ~0.4 s first, so scrolling and swiping the day still
// work; while a block is held the page doesn't scroll. On the phone a
// block held at the screen's edge goes to the next / previous day. The
// rules (where it can land, the 15-minute step) are calendar-drag.ts'.

const LONG_PRESS_MS = 400;
const MOUSE_SLOP_PX = 4;
const TOUCH_SLOP_PX = 8;
const EDGE_PX = 28;
const EDGE_HOLD_MS = 600;

export type Geometry = {
  hourHeight: number;
  minHeight: number;
  startHour: number;
};

export type DragState = {
  event: CalendarEvent;
  /** The day it's on now. */
  fromDate: string;
  /** The day it would land on. */
  date: string;
  startMinutes: number;
  valid: boolean;
  label: string;
};

type ColumnHit = { date: string; top: number };

export function useCalendarDrag({
  weekDates,
  now,
  geometry,
  columnAt,
  onEdge,
}: {
  weekDates: string[];
  now: Now;
  geometry: Geometry;
  /** The day column under a point and its top on screen, or null. */
  columnAt: (x: number, y: number) => ColumnHit | null;
  /** Phone: switch the shown day; returns the day switched to, or null. */
  onEdge?: (direction: 1 | -1) => string | null;
}) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  // A drag just ended: the click that follows mustn't open the task or
  // start a new one.
  const justDragged = useRef(false);
  const cleanup = useRef<(() => void) | null>(null);
  // A drag outlives the render it started in: it reads these fresh.
  const latest = useRef({ weekDates, now, geometry, columnAt, onEdge });
  useLayoutEffect(() => {
    latest.current = { weekDates, now, geometry, columnAt, onEdge };
  });

  useEffect(() => () => cleanup.current?.(), []);

  function onBlockPointerDown(
    pointer: React.PointerEvent<HTMLElement>,
    event: CalendarEvent,
    fromDate: string,
  ) {
    if (!isDraggable(event) || pointer.button !== 0 || drag || question) {
      return;
    }
    if ((pointer.target as HTMLElement).closest("button")) return;
    const touch = pointer.pointerType !== "mouse";
    const origin = { x: pointer.clientX, y: pointer.clientY };
    const grabOffset =
      pointer.clientY - pointer.currentTarget.getBoundingClientRect().top;
    let last = origin;
    let started = false;
    let lastHit: ColumnHit | null = null;
    let edgeTimer: ReturnType<typeof setTimeout> | null = null;
    let edgeDirection: 1 | -1 | null = null;
    let current: DragState | null = null;

    function place(x: number, y: number) {
      const {
        geometry: g,
        columnAt: at,
        weekDates: dates,
        now: n,
      } = latest.current;
      const hit = at(x, y) ?? lastHit;
      if (!hit) return;
      lastHit = hit;
      const start = dragStart(
        minutesAt(y - hit.top - grabOffset, g.hourHeight, g.startHour),
        event.durationMinutes,
      );
      current = {
        event,
        fromDate,
        date: hit.date,
        startMinutes: start,
        valid: canDrop(
          { date: hit.date, startMinutes: start },
          event.durationMinutes,
          dates,
          n,
        ),
        label: moveLabel(hit.date, start, n.today),
      };
      setDrag(current);
    }

    function watchEdge(x: number) {
      const edge = latest.current.onEdge;
      if (!edge) return;
      const direction =
        x < EDGE_PX ? -1 : x > window.innerWidth - EDGE_PX ? 1 : null;
      if (direction === edgeDirection) return;
      edgeDirection = direction;
      if (edgeTimer) clearTimeout(edgeTimer);
      edgeTimer = null;
      if (direction === null) return;
      const step = () => {
        if (edge(direction)) {
          lastHit = null;
          // The new day's column is drawn after this render; not a frame
          // callback, which a hidden page never runs.
          setTimeout(() => place(last.x, last.y), 30);
          edgeTimer = setTimeout(step, EDGE_HOLD_MS);
        }
      };
      edgeTimer = setTimeout(step, EDGE_HOLD_MS);
    }

    function begin() {
      started = true;
      justDragged.current = true;
      if (touch) navigator.vibrate?.(10);
      place(last.x, last.y);
    }

    const longPress = touch ? setTimeout(begin, LONG_PRESS_MS) : null;

    function move(ev: PointerEvent) {
      last = { x: ev.clientX, y: ev.clientY };
      if (!started) {
        const distance = Math.hypot(last.x - origin.x, last.y - origin.y);
        if (!touch && distance > MOUSE_SLOP_PX) begin();
        else if (touch && distance > TOUCH_SLOP_PX) stop(); // a scroll
        return;
      }
      place(last.x, last.y);
      if (touch) watchEdge(last.x);
    }

    // Held, the page must not scroll under the finger.
    function holdScroll(ev: TouchEvent) {
      if (started) ev.preventDefault();
    }

    function stop() {
      if (longPress) clearTimeout(longPress);
      if (edgeTimer) clearTimeout(edgeTimer);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("touchmove", holdScroll);
      window.removeEventListener("contextmenu", noMenu);
      cleanup.current = null;
    }

    function cancel() {
      stop();
      setDrag(null);
    }

    function up() {
      stop();
      if (!started) return;
      // Cleared after the click this release may still fire.
      setTimeout(() => (justDragged.current = false), 0);
      drop(current);
    }

    function noMenu(ev: Event) {
      if (started) ev.preventDefault();
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("touchmove", holdScroll, { passive: false });
    window.addEventListener("contextmenu", noMenu);
    cleanup.current = stop;
  }

  function drop(state: DragState | null) {
    if (
      !state ||
      !state.valid ||
      (state.startMinutes === state.event.startMinutes &&
        state.date === state.fromDate)
    ) {
      setDrag(null);
      return;
    }
    send(state, false);
  }

  // The ghost stays where it was dropped while this runs and while the
  // question is open, so it's clear what's being asked about.
  function send(state: DragState, confirmed: boolean) {
    const { event, date, startMinutes, label } = state;
    startTransition(async () => {
      const result = await moveOccurrenceAction(
        event.occurrenceId,
        date,
        formatMinutes(startMinutes),
        confirmed,
      );
      if (result.status === "confirm") {
        setQuestion({ state, ...result });
        return;
      }
      setDrag(null);
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      toast.success(`Moved to ${label}`, {
        duration: 10_000,
        classNames: { actionButton: UNDO_BUTTON_CLASS },
        action: {
          label: "Undo",
          onClick: () =>
            undo(
              event.occurrenceId,
              result.previousStart,
              moveLabel(
                state.fromDate,
                event.startMinutes,
                latest.current.now.today,
              ),
            ),
        },
      });
    });
  }

  // Undo from the toast (п.6). The toast lives outside this page's
  // transitions, so the week is refreshed by hand once it's back — before,
  // the block stayed at its new place and Undo looked like it did nothing
  // (2026-10-07). And it says so.
  function undo(occurrenceId: string, previousStart: string, backTo: string) {
    // Доработка 2026-10-07 — it glides back from here (block-motion.ts).
    noteDeparture(occurrenceId);
    startTransition(async () => {
      const undone = await undoMoveOccurrenceAction(
        occurrenceId,
        previousStart,
      );
      if (undone.status === "error") {
        toast.error(undone.message ?? "Couldn't undo it.");
        return;
      }
      router.refresh();
      toast.success(`Moved back to ${backTo}`);
    });
  }

  const dialog = question && (
    <MoveQuestion
      question={question}
      onMove={() => {
        const { state } = question;
        setQuestion(null);
        send(state, true);
      }}
      onCancel={() => {
        setQuestion(null);
        setDrag(null);
      }}
    />
  );

  return { drag, onBlockPointerDown, justDragged, dialog };
}

type Question = {
  state: DragState;
  otherDay: boolean;
  recurring: boolean;
  overlapTitles: string[];
  overlapsGoogle: boolean;
};

/**
 * Решение 7 (изменено 2026-10-07) — asked before a move to another day or
 * onto other tasks or Google busy time. A plain shift within the day isn't
 * asked about: it has Undo.
 */
function MoveQuestion({
  question,
  onMove,
  onCancel,
}: {
  question: Question;
  onMove: () => void;
  onCancel: () => void;
}) {
  const { state } = question;
  const lines = [
    question.otherDay
      ? question.recurring
        ? "It moves to another day — only this day of the series; the rest stay."
        : "It moves to another day."
      : null,
    question.overlapTitles.length > 0
      ? `It overlaps ${question.overlapTitles.join(", ")}.`
      : null,
    question.overlapsGoogle
      ? "It overlaps busy time in your Google Calendar."
      : null,
  ].filter((line): line is string => line !== null);
  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Move {state.event.title} to {state.label}?
          </AlertDialogTitle>
          <AlertDialogDescription render={<div />}>
            {lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onMove}>Move</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Where the block will land: its title and "Thu 15:30", or why not. */
export function DropGhost({
  drag,
  geometry,
}: {
  drag: DragState;
  geometry: Geometry;
}) {
  const top =
    ((drag.startMinutes - geometry.startHour * 60) / 60) * geometry.hourHeight;
  const height = Math.max(
    geometry.minHeight,
    (drag.event.durationMinutes / 60) * geometry.hourHeight - 2,
  );
  return (
    <div
      aria-hidden
      className={cn(
        // Доработка 2026-10-07: a lifted card — a soft shadow and a
        // burgundy glow instead of a dashed outline — that glides between
        // 15-minute steps rather than jumping.
        "pointer-events-none absolute inset-x-0.5 z-20 flex flex-col gap-0.5 overflow-hidden rounded-[8px] px-2 py-1 transition-[top,box-shadow,background-color] duration-150 ease-out motion-reduce:transition-none",
        drag.valid
          ? "bg-surface border-l-burgundy border-l-[3px] shadow-[0_10px_28px_-6px_rgba(116,52,71,0.35),0_0_0_1px_rgba(116,52,71,0.14)]"
          : "bg-surface/95 border-l-overdue-ink border-l-[3px] shadow-[0_6px_18px_-6px_rgba(0,0,0,0.22),0_0_0_1px_rgba(0,0,0,0.06)]",
      )}
      style={{ top, height }}
    >
      <span className="text-text-primary truncate text-[12px] font-medium">
        {drag.event.title}
      </span>
      <span
        className={cn(
          "text-[11px] font-semibold tabular-nums",
          drag.valid ? "text-burgundy" : "text-overdue-ink",
        )}
      >
        {drag.valid ? drag.label : "Can't go here"}
      </span>
    </div>
  );
}

/** п.1 (desktop) — "+ 14:00" under the mouse on an empty place. */
export function SlotHint({
  minutes,
  geometry,
}: {
  minutes: number;
  geometry: Geometry;
}) {
  const top = ((minutes - geometry.startHour * 60) / 60) * geometry.hourHeight;
  return (
    <div
      aria-hidden
      // The same soft look as the dragged card, no dashed outline.
      className="bg-burgundy-tint/70 text-burgundy pointer-events-none absolute inset-x-0.5 z-10 rounded-[8px] px-2 py-1 text-[11px] font-semibold tabular-nums shadow-[0_0_0_1px_rgba(116,52,71,0.12)] transition-[top] duration-100 ease-out motion-reduce:transition-none"
      style={{ top, height: geometry.hourHeight / 2 - 2 }}
    >
      + {formatMinutes(minutes)}
    </div>
  );
}
