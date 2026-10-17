import { calendarDate } from "@/lib/date/calendar-date";
import {
  countOf,
  decimal,
  monthDayDate,
  NUMERIC_DATE,
  numericDateOf,
  numberPattern,
  numericDateRule,
  rule,
  setDailyDayPart,
  setDailyInterval,
  setDayPart,
  setDaysAhead,
  setDue,
  setDuration,
  setMonthsAhead,
  setNextWeekday,
  setNextWeeksDay,
  setPartOfDay,
  setRepeatCount,
  setRepeatUntil,
  setTime,
  setWeekly,
  spanRule,
  startTimeSearch,
  words,
  type DayPart,
  type Language,
  type RuleContext,
} from "@/lib/parse-task/engine";

// sprint-24-tasks.md решение 1 — Spanish, as the users in Valencia write
// it and as tickets print it: "mañana a las 18", "el lunes", "los martes y
// jueves", "02 de agosto 2026", "Fecha: Domingo, 02 de agosto 2026".
// Accents are optional — people type "manana", "sabado". "Mañana" is
// tomorrow, but "por la mañana" / "de la mañana" / "cada mañana" is the
// morning.

const N = "[nñ]";
const A = "[aá]";
const E = "[eé]";
const I = "[ií]";
const O = "[oó]";
const U = "[uú]";

const WEEKDAY_FORMS: [number, string][] = [
  [1, "lunes"],
  [2, "martes"],
  [3, `mi${E}rcoles`],
  [4, "jueves"],
  [5, "viernes"],
  [6, `s${A}bados?`],
  [7, "domingos?"],
];
const WEEKDAY = WEEKDAY_FORMS.map(([, form]) => form).join("|");
const weekdayOf = (word: string) =>
  WEEKDAY_FORMS.find(([, form]) =>
    new RegExp(`^(?:${form})$`, "iu").test(word),
  )?.[0];

// Full names, and the short forms tickets use after a day ("3 oct").
const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre|setiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
const MONTH_SHORT = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sept?|set",
  "oct",
  "nov",
  "dic",
];
const MONTH = [...MONTH_NAMES, ...MONTH_SHORT].join("|");
const monthOf = (word: string) => {
  const lower = word.toLowerCase();
  const index = MONTH_NAMES.findIndex((names) =>
    names.split("|").some((name) => name.startsWith(lower.slice(0, 3))),
  );
  return index + 1;
};

/** Weekday words, for splitting "los lunes a las 19 y los miércoles a las 20". */
export const WEEKDAY_PATTERN = WEEKDAY;

const UNITS = { month: /^mes/i, week: /^semana/i };

const NUM = numberPattern([
  "un",
  "una",
  "uno",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
  "diez",
]);

const DAY = `d${I}as?`;
const MORNING = `ma${N}ana`;

const PART_WORD = `${MORNING}|tarde|noche`;
const partOf = (word: string): DayPart =>
  /^ma/i.test(word) ? "morning" : /^t/i.test(word) ? "afternoon" : "evening";
const PLURAL_PART = `${MORNING}s|tardes|noches`;

/** "de la tarde" after an hour: 6 de la tarde is 18:00. */
const meridiemOfPart = (word: string | undefined) =>
  word ? (/^ma/i.test(word) ? ("am" as const) : ("pm" as const)) : undefined;

/** A day of a month, with the year when it's given ("02 de agosto 2026"). */
function setSpanishDate(
  ctx: RuleContext,
  day: number,
  month: number,
  year: string | undefined,
): boolean {
  const date = year
    ? calendarDate(Number(year), month, day)
    : monthDayDate(ctx.today, month, day);
  if (!date) return false;
  ctx.out.date = date;
  return true;
}

export const es: Language = {
  id: "es",
  searchGroups: [
    // S12-04 — "búscame una hora", "encuentra un hueco".
    [
      rule(
        `(?:por favor )?(?:b${U}scame|busca|encu${E}ntrame|encuentra)(?: (un|una|algo de))?(?: (hueco|tiempo|hora|momento|rato))?(?: libre)?`,
        (match, ctx) => startTimeSearch(ctx, match[2] !== undefined),
      ),
    ],
    [
      rule(`por la (${PART_WORD})`, (match, { out }) =>
        setPartOfDay(out, partOf(match[1])),
      ),
    ],
  ],
  groups: [
    // Importance
    [
      rule(
        "urgente|importante|cuanto antes",
        (_, { out }) => void (out.priority = "HIGH"),
      ),
    ],
    // Repeat
    [
      rule(
        `cada (?:dos|otro) ${DAY}|${DAY} s${I},? ${DAY} no|en ${DAY} alternos`,
        (_, { out }) => setDailyInterval(out, 2),
      ),
      rule(`cada (${NUM}) ${DAY}`, (match, { out }) =>
        setDailyInterval(out, countOf(match[1])),
      ),
      rule(
        `(?:cada|todos los|los) ${DAY} (?:laborables|de semana)|entre semana|de lunes a viernes`,
        (_, { out }) => setWeekly(out, [1, 2, 3, 4, 5]),
      ),
      // "los lunes", "cada martes y jueves", "todos los lunes, miércoles".
      rule(
        `(?:cada|todos los|los) (?:${WEEKDAY})(?:\\s*(?:,|y|e)\\s*(?:los )?(?:${WEEKDAY}))*`,
        (match, { out }) =>
          setWeekly(
            out,
            match[0]
              .replace(/^(?:cada|todos los|los)\s+/iu, "")
              .split(/\s*(?:,|\by\b|\be\b)\s*(?:los\s+)?/iu)
              .map((day) => weekdayOf(day.trim()))
              .filter((day): day is number => day !== undefined),
          ),
      ),
      // 2026-10-09 decision 1 — "cada mañana", "por las tardes": daily, at
      // that part of the day's time.
      rule(
        `(?:cada|todas las) (${PART_WORD})s?|por las (${PLURAL_PART})`,
        (match, ctx) => setDailyDayPart(ctx, partOf(match[1] ?? match[2])),
      ),
      rule(
        `cada ${DAY}|todos los ${DAY}s|a diario|diariamente`,
        (_, { out }) => void (out.repeat = "DAILY"),
      ),
      rule(
        "cada semana|todas las semanas|semanalmente",
        (_, { out }) => void (out.repeat = "WEEKLY"),
      ),
      rule(
        "cada mes|todos los meses|mensualmente",
        (_, { out }) => void (out.repeat = "MONTHLY"),
      ),
    ],
    // The part of the day: its time unless the text gives one (engine).
    // Before the date, so "mañana por la mañana" leaves "mañana" for it.
    [
      rule(`por la (${PART_WORD})`, (match, ctx) =>
        setDayPart(ctx, partOf(match[1])),
      ),
    ],
    // sprint-20-tasks.md п.3 — how long a repeat runs.
    [
      rule(
        `(?:durante|por) (?:(?:los|las) pr${O}xim[oa]s )?(un|una|${NUM}) (${DAY}|semanas?|mes(?:es)?)(?: seguid[oa]s)?`,
        spanRule(UNITS),
      ),
      rule(`(${NUM}) (${DAY}|semanas|meses) seguid[oa]s`, spanRule(UNITS)),
      rule(
        `(${NUM}) veces(?! (?:al|por|a la|cada) (?:${DAY}|semana|mes))`,
        (match, ctx) => setRepeatCount(ctx, countOf(match[1])),
      ),
      rule(`hasta el (\\d{1,2}) de (${MONTH})`, (match, ctx) =>
        setRepeatUntil(
          ctx,
          monthDayDate(ctx.today, monthOf(match[2]), Number(match[1])),
        ),
      ),
      rule(`hasta (?:el )?${NUMERIC_DATE}`, (match, ctx) =>
        setRepeatUntil(ctx, numericDateOf(match, 1, ctx.today)),
      ),
    ],
    // Date
    [
      rule(`pasado ${MORNING}`, (_, ctx) => setDaysAhead(ctx, 2)),
      // Not the morning of "de la mañana" (a time) — "por la mañana" and
      // "cada mañana" are already taken out above.
      rule(`(?<!(?:de|por) la )${MORNING}`, (_, ctx) => setDaysAhead(ctx, 1)),
      rule(`hoy|esta (${PART_WORD})`, (match, ctx) => {
        if (match[1]) {
          const part = partOf(match[1]);
          setPartOfDay(ctx.out, part);
          setDayPart(ctx, part);
        }
        return setDaysAhead(ctx, 0);
      }),
      rule(`(?:en|dentro de) (un|una|${NUM}) ${DAY}`, (match, ctx) =>
        setDaysAhead(ctx, countOf(match[1])),
      ),
      rule(`(?:en|dentro de) (un|una|${NUM}) semanas?`, (match, ctx) =>
        setDaysAhead(ctx, countOf(match[1]) * 7),
      ),
      rule(`(?:en|dentro de) (un|una|${NUM}) mes(?:es)?`, (match, ctx) =>
        setMonthsAhead(ctx, countOf(match[1])),
      ),
      rule(
        `la (?:semana que viene|pr${O}xima semana|semana pr${O}xima)`,
        (_, ctx) => setNextWeeksDay(ctx, 1),
      ),
      // "el 2 de agosto", "Domingo, 02 de agosto 2026", "3 oct." — a
      // weekday in front is part of the date, not a day of its own.
      rule(
        `(?:(?:el )?(?:${WEEKDAY}),? )?(?:el )?(\\d{1,2}) (?:de )?(${MONTH})\\.?(?:,? (?:de |del )?(\\d{4}))?`,
        (match, ctx) =>
          setSpanishDate(ctx, Number(match[1]), monthOf(match[2]), match[3]),
      ),
      // sprint-20-tasks.md п.11 — "03/10" is October 3; "a las 20.10" a time.
      numericDateRule("el", "a las |a la |para las |antes de las "),
      // "el próximo sábado", "el sábado que viene" — next week's, as "next
      // Saturday" and "в следующую субботу" are (engine).
      rule(
        `(?:el )?pr${O}ximo (${WEEKDAY})|(?:el )?(${WEEKDAY}) (?:que viene|pr${O}ximo)`,
        (match, ctx) => setNextWeeksDay(ctx, weekdayOf(match[1] ?? match[2])!),
      ),
      rule(`(?:el |este )?(${WEEKDAY})`, (match, ctx) =>
        setNextWeekday(ctx, weekdayOf(match[1])!),
      ),
    ],
    // sprint-20-tasks.md п.10 — a deadline: "antes de las 12", "para las 12".
    [
      rule(`antes del mediod${I}a`, (_, { out }) => setDue(out, 12, 0)),
      rule(
        `(?:antes de|para) las? (\\d{1,2})(?:[:.](\\d{2}))?(?: ?h)?(?: de la (${PART_WORD}))?(?![/.]?\\d)`,
        (match, { out }) =>
          setDue(
            out,
            Number(match[1]),
            Number(match[2] ?? 0),
            meridiemOfPart(match[3]),
          ),
      ),
    ],
    // Duration
    [
      rule(
        "(?:durante )?(\\d{1,2}) ?h(?:oras?)? ?y? ?(\\d{1,2}) ?m(?:in(?:utos?)?)?",
        (match, { out }) =>
          setDuration(out, Number(match[1]) * 60 + Number(match[2])),
      ),
      rule("(?:durante )?(?:una|1) hora y media", (_, { out }) =>
        setDuration(out, 90),
      ),
      rule("(?:durante )?media hora", (_, { out }) => setDuration(out, 30)),
      rule("(?:durante )?(?:una|1) hora", (_, { out }) => setDuration(out, 60)),
      // Not "a las 10h" — that's the time.
      rule(
        "(?<!a las? )(?:durante )?(\\d{1,2}(?:[.,]\\d+)?) ?(?:horas?|h)",
        (match, { out }) => {
          const hours = decimal(match[1]);
          return hours <= 12 && setDuration(out, hours * 60);
        },
      ),
      rule("(?:durante )?(\\d{1,3}) ?(?:minutos?|mins?)", (match, { out }) => {
        const minutes = Number(match[1]);
        return minutes <= 600 && setDuration(out, minutes);
      }),
    ],
    // Time
    [
      rule(
        `(?:a las? )?(\\d{1,2})[:.](\\d{2})(?: ?h)?(?: de la (${PART_WORD}))?`,
        (match, { out }) =>
          setTime(
            out,
            Number(match[1]),
            Number(match[2]),
            meridiemOfPart(match[3]),
          ),
      ),
      rule(
        `a las? (\\d{1,2})(?: ?h)?(?: de la (${PART_WORD}))?`,
        (match, { out }) => {
          const hour = Number(match[1]);
          const meridiem = meridiemOfPart(match[2]);
          // § 3 — a bare "a las 1"–"a las 5" means the afternoon.
          return meridiem
            ? setTime(out, hour, 0, meridiem)
            : setTime(out, hour >= 1 && hour <= 5 ? hour + 12 : hour, 0);
        },
      ),
      rule("(\\d{1,2}) ?h", (match, { out }) =>
        setTime(out, Number(match[1]), 0),
      ),
      rule(`(?:al |a )?mediod${I}a`, (_, { out }) => setTime(out, 12, 0)),
    ],
  ],
  fillers: new RegExp(
    `^(?:recu${E}rdame(?: que)?|recordar|tengo que|hay que|no olvides|no olvidar|necesito)\\s+`,
    "iu",
  ),
  searchFillers: /^(?:(?:para|de)\s+)?(?:(?:un|una|el|la|mi)\s+)?/iu,
  kindWords: {
    workout: words(
      `gimnasio|gym|gimnasia|correr|running|yoga|pilates|nadar|nataci${O}n|piscina|entrenamiento|entrenar|ejercicios?|fitness|bici|ciclismo|crossfit|estiramientos?`,
    ),
    remote: words(
      "llamar|llamada|email|e-mail|correo|mensaje|escribir|responder|pagar|pedir|reservar|renovar|enviar|zoom|online",
    ),
  },
  // No articles in front ("La compra" is a title); left at the end they're
  // what a taken-out date dangled from ("Cena el").
  leadingDangling: "a|en|para|por|cada|y|de",
  trailingDangling: "el|la|los|las|a|en|para|por|cada|y|de|del|desde",
};
