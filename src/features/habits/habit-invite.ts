// backlog.md (2026-10-07) — Home's invitation to start a habit, while
// there's none: a short, human question in place of the habits strip.
// Several wordings; one per user and date, like the assistant's message.

export type HabitInvite = { question: string; hint: string; cta: string };

const INVITES: HabitInvite[] = [
  {
    question: "Anything you'd like to do every day?",
    hint: "Water, a walk, ten minutes of reading — tick it off here in one tap.",
    cta: "Start a habit",
  },
  {
    question: "Want a small daily win?",
    hint: "Pick one habit and I'll keep the streak for you.",
    cta: "Add a habit",
  },
  {
    question: "Something just for you, every day?",
    hint: "Sleep, steps, no phone for an hour — track it right here.",
    cta: "Start a habit",
  },
  {
    question: "How about one good habit?",
    hint: "Two litres of water, a morning stretch — small things add up.",
    cta: "Pick a habit",
  },
  {
    question: "Shall we track a habit too?",
    hint: "One tap a day on Home, and you'll see your streak grow.",
    cta: "Add a habit",
  },
];

/** The same invitation all day for one user; another one tomorrow. */
export function habitInvite(seed: string, date: string): HabitInvite {
  let hash = 0x811c9dc5;
  for (const char of `${seed}|${date}|invite`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return INVITES[(hash >>> 0) % INVITES.length];
}

export const HABIT_INVITE_COOKIE = "habitInviteHiddenUntil";
export const HABIT_INVITE_HIDE_DAYS = 14;

/** "Not now" folds it to one line until that local date (exclusive). */
export function isInviteHidden(
  hiddenUntil: string | undefined,
  today: string,
): boolean {
  return (
    typeof hiddenUntil === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(hiddenUntil) &&
    today < hiddenUntil
  );
}
