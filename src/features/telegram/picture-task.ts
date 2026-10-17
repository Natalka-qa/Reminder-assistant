import { parseTask } from "@/lib/parse-task";
import { guessDuration } from "@/lib/parse-task/duration-guess";
import { calendarDate } from "@/lib/date/calendar-date";

// sprint-24-tasks.md S24-02 — a task from the text of a picture: a ticket,
// a booking confirmation, a chat screenshot. The text comes from OCR
// (S24-03), so it's noisy: letters from the wrong script, columns run
// together, prices and purchase dates next to the one date that matters.
// Pure: no OCR here, nothing stored — `today` is the user's, "YYYY-MM-DD".
//
// What comes out is a draft for the user to confirm (решение 2), never a
// task: one per trip (решение 6), with `options` when it can't tell which
// date and time is meant (решение 4).

export type PictureOption = {
  date: string;
  /** "HH:mm"; null — a day without a time. */
  time: string | null;
  durationMinutes: number | null;
};

export type PictureDraft = PictureOption & {
  title: string;
  /** Address, seat, booking code (решение 5) — never names or card numbers. */
  notes: string | null;
  /** Two or more — the draft asks which; empty when there's one reading. */
  options: PictureOption[];
};

/** Most a draft offers to choose from. */
export const PICTURE_OPTIONS_MAX = 4;

/** решение 8 — a draft with no title of its own. */
export const UNTITLED = "Appointment";

export function extractPictureTasks(
  text: string,
  today: string,
): PictureDraft[] {
  const lines = normalizeLines(text);
  const found = findCandidates(lines, today);
  if (found.length === 0) return [];

  const title = findTitle(lines);
  const notes = findNotes(lines);
  const draft = (options: Candidate[], ownTitle: string): PictureDraft => {
    const [first] = options;
    const guess = guessDuration(ownTitle) ?? venueDuration(lines);
    const withDuration = (candidate: Candidate): PictureOption => ({
      date: candidate.date,
      time: candidate.time,
      durationMinutes:
        candidate.durationMinutes ??
        (candidate.time && guess !== undefined && guess > 0 ? guess : null),
    });
    return {
      title: ownTitle,
      ...withDuration(first),
      notes,
      options:
        options.length > 1
          ? options.slice(0, PICTURE_OPTIONS_MAX).map(withDuration)
          : [],
    };
  };

  // решение 6 — a ticket with two "Departure" blocks on different days is
  // two trips; anything else with several readings is one draft asking.
  const blocks = groupBy(found, (candidate) => candidate.block);
  if (blocks.length > 1 && blocks.every(([block]) => block >= 0)) {
    return blocks.map(([, candidates]) => draft(candidates.slice(0, 1), title));
  }
  return [draft(found, title)];
}

// A cinema's ticket says so in its name, not the film's: "OCINE".
const CINEMA_VENUE = /cine|cinema|cinesa|yelmo|kinepolis|кіно|кино/iu;

function venueDuration(lines: string[]): number | undefined {
  return lines.some((line) => CINEMA_VENUE.test(line)) ? 120 : undefined;
}

// --- Text clean-up -----------------------------------------------------------

// Latin letters OCR reads in place of Cyrillic ones: "24ro Ha 13.00" is
// "24го на 13.00".
const LATIN_TO_CYRILLIC: Record<string, string> = {
  a: "а",
  A: "А",
  B: "В",
  c: "с",
  C: "С",
  e: "е",
  E: "Е",
  H: "Н",
  i: "і",
  I: "І",
  K: "К",
  M: "М",
  o: "о",
  O: "О",
  p: "р",
  P: "Р",
  r: "г",
  T: "Т",
  x: "х",
  X: "Х",
  y: "у",
};
const CYRILLIC_TO_LATIN: Record<string, string> = Object.fromEntries(
  Object.entries(LATIN_TO_CYRILLIC)
    .filter(([latin]) => latin !== "r" && latin !== "y")
    .map(([latin, cyrillic]) => [cyrillic, latin]),
);
const CYRILLIC_LETTER = /\p{Script=Cyrillic}/u;
const LATIN_LETTER = /\p{Script=Latin}/u;

function letterCounts(line: string) {
  let cyrillic = 0;
  let latin = 0;
  for (const char of line) {
    if (CYRILLIC_LETTER.test(char)) cyrillic++;
    else if (LATIN_LETTER.test(char)) latin++;
  }
  return { cyrillic, latin };
}

/**
 * Lines with words, each in the script most of it is written in: Latin
 * look-alikes inside a Cyrillic line become Cyrillic ("Ha" → "на"); stray
 * Cyrillic words in a Latin line are OCR noise and go. "3octubre" gets its
 * space back.
 */
export function normalizeLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const { cyrillic, latin } = letterCounts(line);
      let fixed = line;
      if (cyrillic > latin) {
        fixed = line.replace(/[\p{L}\d]+/gu, (word, at: number) => {
          if (!CYRILLIC_LETTER.test(word) && !/^\d*[a-zA-Z]+$/.test(word)) {
            return word;
          }
          const converted = word.replace(
            /[a-zA-Z]/g,
            (char) => LATIN_TO_CYRILLIC[char] ?? char,
          );
          // "Ha", "Ta" mid-line are "на", "та": OCR reads a small н as H.
          return at > 0 && converted.length <= 3 && /[a-zA-Z]/.test(word)
            ? converted.toLowerCase()
            : converted;
        });
      } else if (latin > 0) {
        // Stray Cyrillic in a Latin line: a lone look-alike letter is the
        // Latin one ("Fila: С"); a longer word is noise.
        fixed = line.replace(/\S*\p{Script=Cyrillic}\S*/gu, (word) =>
          word.length === 1 && CYRILLIC_TO_LATIN[word]
            ? CYRILLIC_TO_LATIN[word]
            : " ",
        );
      }
      return fixed
        .replace(/(\d)(?=[\p{L}]{3,})/gu, "$1 ")
        .replace(/\s+/g, " ")
        .trim();
    })
    .filter((line) => /[\p{L}\d]/u.test(line));
}

// --- Dates and times ---------------------------------------------------------

type Candidate = {
  date: string;
  time: string | null;
  durationMinutes: number | null;
  /** Index of the "Departure" heading above it; -1 without one. */
  block: number;
  labelled: boolean;
};

// A purchase, an invoice, an issue date — never when it happens.
const PURCHASE =
  /compra|factura|purchase|purchased|issued|emitid|invoice|booking date|fecha de emisi|покупк|придбан|оформлен|куплен|чек/iu;

// Where a ticket says "this is when": the line's time is the one.
// `\b` only knows ASCII letters — Cyrillic words need (?<!\p{L}).
const TIME_LABEL =
  /^(?:hora|time|start|starts|departure|salida|inicio|час|время|початок|начало|відправлення|отправление|виліт|вылет)(?!\p{L})/iu;
const DATE_LABEL = /^(?:fecha|date|дата)(?!\p{L})/iu;
const DEPARTURE =
  /(?<!\p{L})(?:departure|salida|відправлення|отправление|виліт|вылет)(?!\p{L})/iu;
const ARRIVAL = /(?<!\p{L})(?:arrival|llegada|прибуття|прибытие)(?!\p{L})/iu;

// "18:45", "13.00", "10:00AM" — not "30.08.2026", "12.70 €" or "4-6".
const TIME =
  /(?<![\d.,/:])([01]?\d|2[0-3])[:.]([0-5]\d)(?!\s?(?:€|eur|usd|\$|%)|[\d.,/:]\d)(?:\s?([ap])\.?m\.?)?(?![\p{L}\d])/giu;

type FoundTime = { minutes: number; index: number; end: number };

function timesIn(line: string): FoundTime[] {
  const found: FoundTime[] = [];
  for (const match of line.matchAll(TIME)) {
    let hour = Number(match[1]);
    const meridiem = match[3]?.toLowerCase();
    if (meridiem === "p" && hour < 12) hour += 12;
    if (meridiem === "a" && hour === 12) hour = 0;
    found.push({
      minutes: hour * 60 + Number(match[2]),
      index: match.index,
      end: match.index + match[0].length,
    });
  }
  return found;
}

const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

// "24го", "24-го", "24-ое" — a day of the month, said in a chat.
const DAY_OF_MONTH = /(?<!\d)(\d{1,2})-?(?:го|ого|ое|е)(?!\p{L})/iu;

/** The next date that's this day of a month, today included. */
function nextDayOfMonth(today: string, day: number): string | null {
  const [year, month] = today.split("-").map(Number);
  for (let ahead = 0; ahead < 3; ahead++) {
    const m = ((month - 1 + ahead) % 12) + 1;
    const y = year + Math.floor((month - 1 + ahead) / 12);
    const date = calendarDate(y, m, day);
    if (date && date >= today) return date;
  }
  return null;
}

/** The date a line names, read the way a typed task is (lib/parse-task). */
function dateIn(line: string, today: string): string | null {
  const day = DAY_OF_MONTH.exec(line);
  if (day) {
    const date = nextDayOfMonth(today, Number(day[1]));
    if (date) return date;
  }
  // Times out first, so "10:45" never reads as a date.
  const parsed = parseTask(line.replace(TIME, " "), today);
  return parsed.date ?? null;
}

// The phone's clock in a screenshot's top line: "11:42 N ul DE".
function isStatusBar(line: string, index: number): boolean {
  return index <= 1 && /^\d{1,2}:\d{2}(?!\s?[ap]\.?m)/iu.test(line);
}

function findCandidates(lines: string[], today: string): Candidate[] {
  const dates = lines.map((line) =>
    PURCHASE.test(line) ? null : dateIn(line, today),
  );
  const anyDate = dates.some(Boolean);
  let block = -1;
  const found: Candidate[] = [];

  lines.forEach((line, i) => {
    if (DEPARTURE.test(line) && ARRIVAL.test(line)) block = i;
    else if (DEPARTURE.test(line) && block < 0) block = i;
    if (PURCHASE.test(line) || isStatusBar(line, i)) return;
    const times = timesIn(line);
    if (times.length === 0) return;

    const date =
      dates[i] ??
      nearest(dates, i, -3) ??
      nearest(dates, i, 2) ??
      (anyDate ? null : today);
    if (!date) return;

    const [start, second] = times;
    const between = second ? line.slice(start.end, second.index) : "";
    const span = second ? second.minutes - start.minutes : 0;
    // "14:00 - 15:00", or departure and arrival on one line ("10:45 12:44").
    const durationMinutes =
      second && span > 0 && span <= 12 * 60 && /^[\s\-–—|]*$/.test(between)
        ? span
        : null;
    found.push({
      date,
      time: hhmm(start.minutes),
      durationMinutes,
      block,
      labelled:
        TIME_LABEL.test(line) ||
        DATE_LABEL.test(lines[i - 1] ?? "") ||
        DATE_LABEL.test(line),
    });
  });

  // A day with no time anywhere — a task without a time (sprint-18).
  if (found.length === 0) {
    const date = dates.find((date): date is string => date !== null);
    if (date) {
      found.push({
        date,
        time: null,
        durationMinutes: null,
        block: -1,
        labelled: false,
      });
    }
  }

  const upcoming = found.filter((candidate) => candidate.date >= today);
  const labelled = upcoming.filter((candidate) => candidate.labelled);
  return uniqueBy(labelled.length > 0 ? labelled : upcoming, (candidate) =>
    [candidate.date, candidate.time].join(" "),
  );
}

function nearest(
  dates: (string | null)[],
  from: number,
  reach: number,
): string | null {
  const step = reach < 0 ? -1 : 1;
  for (let i = from + step; Math.abs(i - from) <= Math.abs(reach); i += step) {
    if (i < 0 || i >= dates.length) break;
    if (dates[i]) return dates[i];
  }
  return null;
}

// --- Title -------------------------------------------------------------------

const TITLE_LABEL =
  /^(?:event|evento|pel[ií]cula|film|movie|concierto|concert|espect[aá]culo|show|servicio|service|подія|событие|послуга|услуга)$/iu;

const TRANSPORT: [RegExp, string][] = [
  [/\b(?:train|tren|renfe|iryo|ouigo|avlo)\b|поїзд|поезд/iu, "Train"],
  [/\bbus\b|autob[uú]s|\balsa\b|flixbus|автобус/iu, "Bus"],
  [
    /\bflight\b|\bvuelo\b|boarding pass|tarjeta de embarque|рейс|аеропорт|аэропорт/iu,
    "Flight",
  ],
];

const CITIES = [
  "Madrid",
  "Valencia",
  "Barcelona",
  "Sevilla",
  "Seville",
  "Málaga",
  "Malaga",
  "Alicante",
  "Bilbao",
  "Zaragoza",
  "Granada",
  "Córdoba",
  "Cordoba",
  "Murcia",
  "Castellón",
  "Castellon",
  "Tarragona",
  "Girona",
  "Salamanca",
  "Valladolid",
  "Lisboa",
  "Lisbon",
  "Porto",
  "Paris",
  "London",
  "Berlin",
  "Roma",
  "Rome",
  "Milan",
  "Amsterdam",
  "Warsaw",
  "Kraków",
  "Krakow",
  "Vienna",
  "Prague",
  "Kyiv",
  "Київ",
  "Lviv",
  "Львів",
  "Odesa",
  "Одеса",
];

// Services booked from a chat — their name, as the chat writes it.
const SERVICES: [RegExp, string][] = [
  [/масаж/iu, "Масаж"],
  [/массаж/iu, "Массаж"],
  [/masaje/iu, "Masaje"],
  [/massage/iu, "Massage"],
  [/епіляц/iu, "Епіляція"],
  [/эпиляц/iu, "Эпиляция"],
  [/depilaci/iu, "Depilación"],
  [/манікюр/iu, "Манікюр"],
  [/маникюр/iu, "Маникюр"],
  [/manicur/iu, "Manicura"],
  [/педикюр/iu, "Педикюр"],
  [/pedicur/iu, "Pedicura"],
  [/стрижк/iu, "Стрижка"],
  [/peluquer/iu, "Peluquería"],
  [/haircut/iu, "Haircut"],
  [/стоматолог/iu, "Стоматолог"],
  [/dentist/iu, "Dentista"],
  [/косметолог/iu, "Косметолог"],
  [/лікар/iu, "Лікар"],
  [/врач/iu, "Врач"],
  [/m[eé]dico/iu, "Médico"],
];

/** "SPIDER-MAN: BRAND NEW DAY (ATMOS) (VOSE)" → "Spider-Man: Brand New Day". */
function tidyTitle(line: string): string {
  const bare = line
    .replace(/(?:\s*\([^)]{1,10}\))+\s*$/u, "")
    .replace(/^[^\p{L}\d]+|[^\p{L}\d)!?]+$/gu, "")
    .trim();
  const shouting = bare === bare.toUpperCase() && /\p{Lu}{3}/u.test(bare);
  const cased = shouting
    ? bare
        .toLowerCase()
        .replace(
          /(^|[\s\-:/(])(\p{L})/gu,
          (_, before, letter) => before + letter.toUpperCase(),
        )
    : bare;
  return cased.slice(0, 80);
}

export function findTitle(lines: string[]): string {
  // "EVENT" / "Gran Venta de Plantas - Valencia".
  for (let i = 0; i < lines.length - 1; i++) {
    if (TITLE_LABEL.test(lines[i])) return tidyTitle(lines[i + 1]);
  }
  // The line above "Fecha: …" — a cinema ticket's film.
  for (let i = 1; i < lines.length; i++) {
    if (
      DATE_LABEL.test(lines[i]) &&
      !PURCHASE.test(lines[i]) &&
      /\p{L}{4}/u.test(lines[i - 1])
    ) {
      const above = lines[i - 1];
      if (!DATE_LABEL.test(above) && !TIME_LABEL.test(above)) {
        return tidyTitle(above);
      }
    }
  }
  const all = lines.join("\n");
  const transport = TRANSPORT.find(([pattern]) => pattern.test(all));
  if (transport) {
    const cities = uniqueBy(
      CITIES.map((city) => ({
        city,
        at: all.search(new RegExp(`(?<!\\p{L})${city}(?!\\p{L})`, "iu")),
      }))
        .filter(({ at }) => at >= 0)
        .sort((a, b) => a.at - b.at)
        .map(({ city }) => city.normalize("NFD").replace(/\p{M}/gu, "")),
      (city) => city.toLowerCase(),
    );
    return cities.length >= 2
      ? `${transport[1]} ${cities[0]} → ${cities[1]}`
      : transport[1];
  }
  const service = SERVICES.map(([pattern, name]) => ({
    name,
    at: all.search(pattern),
  }))
    .filter(({ at }) => at >= 0)
    .sort((a, b) => a.at - b.at)[0];
  return service?.name ?? UNTITLED;
}

// --- Notes -------------------------------------------------------------------

const PLACE_LABEL =
  /^(?:where|d[oó]nde|direcci[oó]n|lugar|venue|location|адреса|адрес|місце проведення|место проведения)$/iu;
const STREET =
  /^(?:c\/|calle\b|carrer\b|avda\.?|avenida\b|av\.|plaza\b|pl\.|paseo\b|camino\b|вул\.|ул\.|вулиця\b|улица\b)/iu;
const POSTCODE_LINE = /^\d{5}\b/u;
const LABEL_LINE = /^\p{Lu}[\p{Lu}\s]{2,}$/u;

const SEAT_LABELS: [RegExp, string][] = [
  [/^(?:sala|hall|screen|зал)$/iu, "Sala"],
  [/^(?:fila|row|ряд)$/iu, "Fila"],
  [/^(?:butacas?|seats?|asientos?|місце|місця|место|места|plaza)$/iu, "Seat"],
  [/^(?:carriage|coach|coche|vag[oó]n|вагон)$/iu, "Carriage"],
];
const seatLabelOf = (word: string) =>
  SEAT_LABELS.find(([pattern]) => pattern.test(word))?.[1];

const BOOKING =
  /(?:locator|localizador|c[oó]digo de reserva|booking (?:ref(?:erence)?|code|number)|reservation (?:code|number)|pnr|код бронювання|код бронирования)\s*:?\s*([A-Z0-9]{5,10})(?![A-Z0-9])/iu;

export function findNotes(lines: string[]): string | null {
  const notes: string[] = [];

  // Where: after "WHERE", else a street line and its postcode line.
  const label = lines.findIndex((line) => PLACE_LABEL.test(line));
  if (label >= 0) {
    const place: string[] = [];
    for (const line of lines.slice(label + 1, label + 3)) {
      if (LABEL_LINE.test(line) && place.length > 0) break;
      place.push(line);
    }
    if (place.length > 0) notes.push(place.join(" "));
  } else {
    const street = lines.findIndex((line) => STREET.test(line));
    if (street >= 0) {
      const next = lines[street + 1];
      notes.push(
        next && POSTCODE_LINE.test(next)
          ? `${lines[street]}, ${next}`
          : lines[street],
      );
    }
  }

  // Seat: "Fila: C", "Butacas: 4, 5" — or "CARRIAGE SEAT" over "4 13A".
  const seat: string[] = [];
  const seen = new Set<string>();
  lines.forEach((line, i) => {
    const inline = /^([\p{L}]+)\s*:\s*(.+)$/u.exec(line);
    const name = inline && seatLabelOf(inline[1]);
    if (inline && name && !seen.has(name)) {
      const value = inline[2]
        .replace(new RegExp(`^${inline[1]}\\s*`, "iu"), "")
        .trim();
      if (value && value.length <= 12) {
        seat.push(`${name} ${value}`);
        seen.add(name);
      }
      return;
    }
    const words = line.split(" ");
    const names = words.map(seatLabelOf);
    const values = (lines[i + 1] ?? "").split(" ");
    if (
      words.length >= 2 &&
      names.every(Boolean) &&
      values.length === words.length &&
      values.every((value) => /^[\dA-Z]{1,4}$/u.test(value))
    ) {
      names.forEach((label, k) => {
        if (label && !seen.has(label)) {
          seat.push(`${label} ${values[k]}`);
          seen.add(label);
        }
      });
    }
  });
  if (seat.length > 0) notes.push(seat.join(" · "));

  for (const line of lines) {
    const booking = BOOKING.exec(line);
    if (booking) {
      notes.push(`Booking code: ${booking[1]}`);
      break;
    }
  }

  return notes.length > 0 ? notes.join("\n") : null;
}

// --- Helpers -----------------------------------------------------------------

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function groupBy<T>(items: T[], key: (item: T) => number): [number, T[]][] {
  const groups = new Map<number, T[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return [...groups.entries()];
}
