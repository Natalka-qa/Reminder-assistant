// 2026-10-08 — a task's note often holds an address or a link: the task
// page makes them tappable. A link opens as it is; a line that reads as an
// address opens in Google Maps. Pure; everything else stays plain text.

export type NoteSegment =
  | { kind: "text"; text: string }
  | { kind: "url"; text: string; href: string }
  | { kind: "place"; text: string; href: string };

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"']+/giu;
const HAS_URL = /(?:https?:\/\/|www\.)[^\s<>"']/iu;

// "Address: …" in the languages the app's people write in.
const ADDRESS_LABEL =
  /^((?:адрес|адреса|address|addr|dirección|direccion|adreça|adresse|indirizzo)\s*[:—–-]\s*)(.+)$/iu;

// Words a street address carries; a line needs one of them and a number.
const STREET_WORDS = [
  // ru / uk
  "ул",
  "улица",
  "вул",
  "вулиця",
  "пр-т",
  "просп",
  "проспект",
  "пер",
  "переулок",
  "провулок",
  "бульвар",
  "бул",
  "б-р",
  "шоссе",
  "шосе",
  "пл",
  "площадь",
  "площа",
  "набережная",
  "наб",
  "мкр",
  "микрорайон",
  // en
  "street",
  "st",
  "road",
  "rd",
  "avenue",
  "ave",
  "av",
  "boulevard",
  "blvd",
  "lane",
  "ln",
  "drive",
  "dr",
  "square",
  "sq",
  // es / ca
  "calle",
  "c/",
  "carrer",
  "avenida",
  "avda",
  "avinguda",
  "plaza",
  "plaça",
  "paseo",
  "passeig",
  "camino",
  "ronda",
  "travesía",
  // de / fr / it
  "straße",
  "strasse",
  "str",
  "platz",
  "weg",
  "allee",
  "rue",
  "via",
  "piazza",
  "corso",
];

const escaped = STREET_WORDS.map((word) =>
  word.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"),
).join("|");
// Not glued to other letters or digits: "St" in "Main St", not in "1st".
const STREET_WORD = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${escaped})(?=$|[^\\p{L}])`,
  "iu",
);

// German and Dutch streets glue the word on: "Friedrichstraße 43".
const STREET_SUFFIX =
  /\p{L}(?:straße|strasse|str\.|platz|weg|allee|gasse|straat|laan)(?=$|[^\p{L}])/iu;

export function mapsHref(place: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
}

/** Trailing punctuation belongs to the sentence, not the link. */
function trimUrl(raw: string): string {
  let url = raw.replace(/[.,;:!?]+$/u, "");
  // A ")" closes the sentence unless the link opened one ("…/Foo_(bar)").
  while (
    url.endsWith(")") &&
    (url.match(/\(/g) ?? []).length < (url.match(/\)/g) ?? []).length
  ) {
    url = url.slice(0, -1).replace(/[.,;:!?]+$/u, "");
  }
  return url;
}

/** A line, whole, that reads as an address: a street word and a number. */
export function looksLikeAddress(line: string): boolean {
  const text = line.trim();
  if (text.length < 6 || text.length > 140) return false;
  return (
    /\p{N}/u.test(text) && (STREET_WORD.test(text) || STREET_SUFFIX.test(text))
  );
}

function lineSegments(line: string): NoteSegment[] {
  if (HAS_URL.test(line)) {
    const segments: NoteSegment[] = [];
    let at = 0;
    for (const match of line.matchAll(URL_PATTERN)) {
      const url = trimUrl(match[0]);
      const start = match.index;
      if (start > at)
        segments.push({ kind: "text", text: line.slice(at, start) });
      segments.push({
        kind: "url",
        text: url,
        href: /^https?:\/\//i.test(url) ? url : `https://${url}`,
      });
      at = start + url.length;
    }
    if (at < line.length) segments.push({ kind: "text", text: line.slice(at) });
    return segments;
  }

  const labelled = line.match(ADDRESS_LABEL);
  if (labelled && labelled[2].trim()) {
    const place = labelled[2].trim();
    return [
      { kind: "text", text: labelled[1] },
      { kind: "place", text: place, href: mapsHref(place) },
    ];
  }
  if (looksLikeAddress(line)) {
    const place = line.trim();
    return [{ kind: "place", text: place, href: mapsHref(place) }];
  }
  return line ? [{ kind: "text", text: line }] : [];
}

/** The note as lines of segments; line breaks are kept by the caller. */
export function noteLines(note: string): NoteSegment[][] {
  return note.split(/\r?\n/).map(lineSegments);
}

/** How a link reads in the note: no scheme, no "www.", not too long. */
export function shortUrl(url: string, max = 36): string {
  const bare = url.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const clean = bare.endsWith("/") ? bare.slice(0, -1) : bare;
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
