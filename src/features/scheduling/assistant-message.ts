import { isoWeekday } from "@/lib/date/calendar-date";

// Home's "From your assistant" (backlog.md, 2026-10-07): a few sentences
// that read the day as it is — the weekday, the time of day, how full it
// is, what's done or skipped already, what's left from earlier, habits —
// in words that vary. Each situation has several phrasings; which one is
// picked depends on the user and the date, so the text stays put on
// reload and changes only when the situation does. Pure: the page hands
// over counts and labels already resolved in the user's timezone.

export type AssistantFacts = {
  /** Local date, "YYYY-MM-DD". */
  date: string;
  /** Local minutes since midnight. */
  minutes: number;
  /** Something stable per user (their id), so two people differ. */
  seed: string;
  /** Today's tasks, not counting removed days — open and closed alike. */
  total: number;
  /** Done or partly done. */
  done: number;
  skipped: number;
  /** Still to do today. */
  open: number;
  /** Open tasks from earlier days (Overdue). */
  carriedOver: number;
  fixedOpen: number;
  flexibleOpen: number;
  /** Open tasks sharing their time with another. */
  overlapCount: number;
  /** "19:00" — free from then on, or null. */
  freeAfter: string | null;
  habitsLeft: number;
  /** The 30-day pattern sentence, when it's about today. */
  patternLine: string | null;
};

type Part = "morning" | "afternoon" | "evening" | "late";

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const NUMBER_WORDS = [
  "no",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];

function word(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "one thing", "3 things" → in words up to ten. */
function things(n: number): string {
  return `${word(n)} thing${n === 1 ? "" : "s"}`;
}

function partOf(minutes: number): Part {
  const hour = Math.floor(minutes / 60);
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 22) return "evening";
  return "late";
}

/** A small stable hash (FNV-1a) — the same text all day for one user. */
function pick<T>(options: T[], key: string): T {
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return options[(hash >>> 0) % options.length];
}

type Context = AssistantFacts & {
  weekday: number;
  dayName: string;
  part: Part;
  weekend: boolean;
};

// --- An empty day ---------------------------------------------------------

const EMPTY_ANY: ((c: Context) => string)[] = [
  () => "Nothing planned today — a clean slate.",
  () => "An open day. Fill it, or leave it open on purpose.",
  () => "No tasks today. A rare quiet one — make the most of it.",
  () => "Your day is wide open. Add something, or just enjoy the space.",
  () => "Nothing on the list today. Sometimes that's the plan.",
  () => "Today's free. If something comes up, tell me and I'll keep track.",
  (c) => `An empty ${c.dayName}. No reminders will bother you today.`,
  (c) => `Nothing scheduled for this ${c.dayName} — the time is all yours.`,
];

const EMPTY_BY_WEEKDAY: Record<number, ((c: Context) => string)[]> = {
  1: [
    () => "A quiet Monday — no rush to start the week.",
    () => "Nothing planned this Monday. A gentle way into the week.",
  ],
  2: [
    () => "A free Tuesday — a good day to get ahead on something.",
    () => "Tuesday with nothing planned. Room to think.",
  ],
  3: [
    () => "Midweek and nothing planned — a breather.",
    () => "A free Wednesday, right in the middle of the week. Nice.",
  ],
  4: [
    () => "A free Thursday. The weekend's close.",
    () => "Nothing on this Thursday — space to wrap things up early.",
  ],
  5: [
    () => "Nothing on this Friday — the weekend starts early.",
    () => "A free Friday. Well earned.",
  ],
  6: [
    () => "A free Saturday — enjoy it, or add something just for you.",
    () => "Saturday with an empty list. Rest counts too.",
    () => "No plans this Saturday. A slow morning sounds right.",
  ],
  7: [
    () => "A slow Sunday — nothing planned.",
    () => "Nothing planned for Sunday. Get ready for the week — or don't.",
    () => "An empty Sunday. Recharge.",
  ],
};

// The evening and the night have their own — the day's set doesn't
// depend on the hour, so the text stays the same from morning to evening.
const EMPTY_EVENING: ((c: Context) => string)[] = [
  () => "Nothing planned tonight. Time to rest.",
  (c) => `A free ${c.dayName} evening. Enjoy it.`,
  () => "Nothing left on the list this evening.",
];

const EMPTY_LATE: ((c: Context) => string)[] = [
  () => "Nothing left for today. Sleep well.",
  () => "A quiet day, and now a quiet night.",
];

function emptyDay(c: Context): string {
  if (c.carriedOver > 0) {
    const n = c.carriedOver;
    return pick(
      [
        `Nothing new today, but ${things(n)} from earlier ${n === 1 ? "is" : "are"} still waiting.`,
        `A free day — a good one to catch up on the ${things(n)} left from before.`,
        `No new tasks today. ${cap(things(n))} from earlier could use a moment.`,
        `Your ${c.dayName} is clear, apart from ${things(n)} carried over.`,
      ],
      `${c.seed}|${c.date}|empty-carried`,
    );
  }
  const evening = c.part === "evening" || c.part === "late";
  const options =
    c.part === "late"
      ? EMPTY_LATE
      : c.part === "evening"
        ? EMPTY_EVENING
        : [...EMPTY_ANY, ...(EMPTY_BY_WEEKDAY[c.weekday] ?? [])];
  return pick(
    options,
    `${c.seed}|${c.date}|empty|${evening ? c.part : "day"}`,
  )(c);
}

// --- Everything closed ----------------------------------------------------

function closure(c: Context): string {
  if (c.done === 0) return `the ${things(c.skipped)} skipped`;
  if (c.skipped === 0) {
    return c.done === 1 ? "the one thing done" : `all ${word(c.done)} done`;
  }
  return `${word(c.done)} done, ${word(c.skipped)} skipped`;
}

function allClosed(c: Context): string {
  if (c.done === 0) {
    return pick(
      [
        `Today's list is clear — ${things(c.skipped)} skipped. Tomorrow's a new day.`,
        `Nothing left today; you skipped ${things(c.skipped)}. That's allowed.`,
      ],
      `${c.seed}|${c.date}|skipped-all`,
    );
  }
  const what = closure(c);
  const options = [
    `Everything for today is closed: ${what}. Nice work.`,
    `${cap(what)}. The rest of the ${c.dayName} is yours.`,
    `That's the list: ${what}. Well done.`,
  ];
  if (c.part === "evening" || c.part === "late") {
    options.push(`${cap(what)} — that's the day. Time to rest.`);
  }
  if (c.weekday === 5) {
    options.push(`${cap(what)} — the week's work is behind you.`);
  }
  if (c.weekend) {
    options.push(`${cap(what)}. Enjoy the rest of the weekend.`);
  }
  return pick(options, `${c.seed}|${c.date}|closed|${c.part}`);
}

// --- A day with things left -----------------------------------------------

function late(c: Context): string {
  const n = c.open;
  return pick(
    [
      `It's late — the ${things(n)} left can wait until morning.`,
      `Still ${things(n)} open, but it's late. Tomorrow is fine for ${n === 1 ? "it" : "them"}.`,
      `${cap(things(n))} left for today. If ${n === 1 ? "it can" : "they can"} wait, let ${n === 1 ? "it" : "them"} — rest first.`,
    ],
    `${c.seed}|${c.date}|late`,
  );
}

function progress(c: Context): string {
  const closed = c.done + c.skipped;
  const skippedNote = c.skipped > 0 ? ` (${word(c.skipped)} skipped)` : "";
  if (c.open === 1) {
    const options = [
      "One thing left today.",
      `${cap(word(c.done))} done${skippedNote}, one to go.`,
      "Just one more for today.",
    ];
    if (c.weekday === 5 && c.part !== "morning") {
      options.push("One more thing and the week's work is behind you.");
    }
    if (c.part === "evening") options.push("One last thing this evening.");
    return pick(options, `${c.seed}|${c.date}|one-left`);
  }
  const options = [
    `${cap(word(c.done))} of ${word(c.total)} done${skippedNote}; ${word(c.open)} to go.`,
    `${cap(word(c.done))} done so far${skippedNote}, ${word(c.open)} left.`,
  ];
  if (c.done * 2 >= c.total) {
    options.push(`${cap(word(c.done))} of ${word(c.total)} done — good pace.`);
  }
  if (c.part === "afternoon") {
    options.push(
      `${cap(word(c.done))} of ${word(c.total)} done by the afternoon${skippedNote}.`,
    );
  }
  if (c.part === "evening") {
    options.push(
      `${cap(word(c.open))} left this evening — ${word(c.done)} already done.`,
    );
  }
  if (closed > 0 && c.done === 0) {
    options.length = 0;
    options.push(
      `${cap(word(c.skipped))} skipped, ${word(c.open)} still to do.`,
      `${cap(word(c.open))} left after skipping ${word(c.skipped)}.`,
    );
  }
  return pick(options, `${c.seed}|${c.date}|progress|${c.part}`);
}

function opening(c: Context): string {
  const n = c.open;
  const N = cap(things(n));
  const day = c.dayName;
  if (n >= 6) {
    const options = [
      `A packed ${day}: ${things(n)} today.`,
      `${N} today — a full one. One at a time.`,
      `A busy ${day} — ${things(n)} on the list.`,
    ];
    if (c.weekday === 1)
      options.push(`A full Monday to start the week — ${things(n)}.`);
    if (c.weekday === 5)
      options.push(`A busy Friday — ${things(n)} before the weekend.`);
    if (c.weekend)
      options.push(`A full ${day}, even for a weekend: ${things(n)}.`);
    return pick(options, `${c.seed}|${c.date}|busy`);
  }
  if (n <= 2) {
    const options = [
      `A light ${day} — just ${things(n)} today.`,
      `Only ${things(n)} today. Plenty of room if something comes up.`,
      `${N} today, nothing more.`,
    ];
    if (c.weekday === 1)
      options.push(`An easy start to the week: just ${things(n)}.`);
    if (c.weekend) options.push(`A gentle ${day}: just ${things(n)}.`);
    if (c.weekday === 5)
      options.push(`An easy Friday — ${things(n)}, then the weekend.`);
    return pick(options, `${c.seed}|${c.date}|light`);
  }
  const options = [
    `${N} on your ${day}.`,
    `A steady ${day}: ${things(n)}.`,
    `${N} today — a good, ordinary day.`,
  ];
  if (c.weekday === 1) options.push(`${N} to start the week.`);
  if (c.weekday === 5) options.push(`${N}, then the weekend.`);
  if (c.part === "morning")
    options.push(`Good start: ${things(n)} ahead today.`);
  return pick(options, `${c.seed}|${c.date}|normal`);
}

function mix(c: Context): string | null {
  // With an overlap, that's the detail worth the words.
  if (c.open < 2 || c.overlapCount > 0) return null;
  if (c.fixedOpen === 0) {
    return pick(
      [
        "All flexible — move them as you like.",
        "None has a set time, so shuffle freely.",
      ],
      `${c.seed}|${c.date}|mix`,
    );
  }
  if (c.flexibleOpen === 0) {
    return pick(
      ["All at fixed times.", "Every one of them has a set time."],
      `${c.seed}|${c.date}|mix`,
    );
  }
  return `${cap(word(c.fixedOpen))} fixed, ${word(c.flexibleOpen)} flexible.`;
}

function extras(c: Context): string[] {
  const lines: string[] = [];
  if (c.overlapCount > 0) {
    lines.push(
      pick(
        [
          `${cap(word(c.overlapCount))} of them overlap — I'd move the flexible one.`,
          `${cap(word(c.overlapCount))} share a time; the fixed one comes first.`,
        ],
        `${c.seed}|${c.date}|overlap`,
      ),
    );
  }
  if (c.carriedOver > 0) {
    const n = c.carriedOver;
    lines.push(
      pick(
        [
          `${cap(things(n))} from earlier ${n === 1 ? "is" : "are"} still waiting.`,
          `Plus ${things(n)} left from before.`,
        ],
        `${c.seed}|${c.date}|carried`,
      ),
    );
  }
  if (c.freeAfter && c.part !== "late") {
    // "Evening" only when it is one: free from 16:00 is the afternoon.
    const evening = Number(c.freeAfter.slice(0, 2)) >= 17;
    lines.push(
      pick(
        evening
          ? [
              `Your evening is free after ${c.freeAfter}.`,
              `You're free from ${c.freeAfter}.`,
              `Nothing after ${c.freeAfter} — the evening is yours.`,
            ]
          : [
              `You're free from ${c.freeAfter}.`,
              `Nothing after ${c.freeAfter} — the rest of the day is open.`,
            ],
        `${c.seed}|${c.date}|free`,
      ),
    );
  }
  return lines;
}

function habitsLine(c: Context): string | null {
  if (c.habitsLeft === 0) return null;
  return c.habitsLeft === 1
    ? "And one habit still to tick."
    : `And ${word(c.habitsLeft)} habits still to tick.`;
}

function contextOf(facts: AssistantFacts): Context {
  const weekday = isoWeekday(facts.date);
  return {
    ...facts,
    weekday,
    dayName: WEEKDAYS[weekday - 1],
    part: partOf(facts.minutes),
    weekend: weekday >= 6,
  };
}

/**
 * The card's headline, in the same mood as the message: "A full day
 * ahead" over a packed day, never "A calmer day ahead" over one.
 */
export function assistantTitle(facts: AssistantFacts): string {
  const c = contextOf(facts);
  const key = `${c.seed}|${c.date}|title`;
  if (c.total === 0) {
    if (c.carriedOver > 0)
      return pick(["A day to catch up", "Room to catch up"], key);
    if (c.part === "late") return "Rest well";
    return pick(
      c.weekend
        ? ["A free weekend day", "Nothing planned", "All yours today"]
        : ["A free day", "Nothing planned", "An open day"],
      key,
    );
  }
  if (c.open === 0)
    return pick(["All done", "That's the day", "Done for today"], key);
  if (c.part === "late") return "Winding down";
  if (c.done + c.skipped > 0) {
    return c.open === 1
      ? pick(["Almost there", "One to go"], key)
      : pick(["Making progress", "On your way"], key);
  }
  if (c.open >= 6 || c.overlapCount > 0) {
    return pick(["A full day ahead", "A busy one today"], key);
  }
  if (c.open <= 2) return pick(["A calmer day ahead", "A light day"], key);
  return pick(["A steady day ahead", "Your day at a glance"], key);
}

/** The whole message: an opening, up to two details, habits, the pattern. */
export function assistantMessage(facts: AssistantFacts): string {
  const c = contextOf(facts);

  let parts: (string | null)[];
  if (c.total === 0) {
    parts = [emptyDay(c), habitsLine(c)];
  } else if (c.open === 0) {
    parts = [
      allClosed(c),
      c.carriedOver > 0
        ? `${cap(things(c.carriedOver))} from earlier ${c.carriedOver === 1 ? "is" : "are"} still waiting, if you have a moment.`
        : null,
      habitsLine(c),
    ];
  } else if (c.part === "late") {
    parts = [late(c), habitsLine(c)];
  } else {
    const started = c.done + c.skipped > 0;
    parts = [
      started ? progress(c) : opening(c),
      started ? null : mix(c),
      ...extras(c).slice(0, 2),
      habitsLine(c),
      c.patternLine,
    ];
  }
  return parts.filter((part): part is string => Boolean(part)).join(" ");
}
