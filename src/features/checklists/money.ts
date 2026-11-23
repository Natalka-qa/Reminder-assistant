// sprint-26-tasks.md S26-12 — prices and links on list items (gifts, lab
// tests): one currency per list, prices in cents. Pure, shared by the app
// and the bot.

export const CURRENCIES = [
  { code: "EUR", symbol: "€" },
  { code: "USD", symbol: "$" },
  { code: "GBP", symbol: "£" },
  { code: "UAH", symbol: "₴" },
  { code: "PLN", symbol: "zł" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export const CURRENCY_CODES = CURRENCIES.map((value) => value.code) as [
  CurrencyCode,
  ...CurrencyCode[],
];

export const DEFAULT_CURRENCY: CurrencyCode = "EUR";

/** The largest price an item may have: 999 999.99. */
export const PRICE_MAX_CENTS = 99_999_999;

export function currencySymbol(code: string): string {
  return CURRENCIES.find((value) => value.code === code)?.symbol ?? code;
}

/** "€49.99", "€50" (whole amounts without cents), "₴1,299". */
export function formatMoney(cents: number, currency: string): string {
  const whole = cents % 100 === 0;
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    }).format(cents / 100);
  } catch {
    return `${currencySymbol(currency)}${(cents / 100).toFixed(whole ? 0 : 2)}`;
  }
}

// A number as people type it: "49", "49.99", "49,99", "1 299", "1,299.50".
const AMOUNT = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d{1,3}(?:[ \u00a0]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?`;

/**
 * What the Price field holds → cents; "" → null, not a price → NaN.
 * A currency sign around it is allowed and ignored ("€49.99").
 */
export function parsePrice(raw: string): number | null {
  const trimmed = raw
    .trim()
    .replace(/^[€$£₴]\s*|\s*(?:[€$£₴]|zł|eur|usd|gbp|uah|грн|pln)$/iu, "");
  if (trimmed === "") return null;
  if (!new RegExp(`^(?:${AMOUNT})$`, "u").test(trimmed)) return Number.NaN;
  return amountToCents(trimmed);
}

function amountToCents(amount: string): number {
  const compact = amount.replace(/[ \u00a0]/gu, "");
  // "1,299.50" — a comma before a dot groups thousands; otherwise a comma
  // is the decimal point ("49,99").
  const normal = /,\d{3}(?:\.|$)/u.test(compact)
    ? compact.replace(/,/gu, "")
    : compact.replace(",", ".");
  return Math.round(Number(normal) * 100);
}

const URL_PATTERN = /https?:\/\/[^\s<>"]+/iu;

// A price in a typed line needs a currency, so "Milk — 2 l" and "Squats —
// 3×12" stay notes: "€49.99", "$20", "49,99 €", "300 грн", "50 zł".
const LINE_PRICE = new RegExp(
  String.raw`(?:^|\s)(?:[€$£₴]\s?(${AMOUNT})|(${AMOUNT})\s?(?:[€$£₴]|zł|eur|usd|gbp|uah|грн|pln)(?![\p{L}\d]))`,
  "iu",
);

/** A link as typed: no scheme → https (a bare "amazon.es/…"). */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  return /^https?:\/\//iu.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** "amazon.es" — what a link shows as; the raw text if it doesn't parse. */
export function urlLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./u, "");
  } catch {
    return url;
  }
}

/**
 * One typed line → its link and price, and the rest (text and note) with
 * them taken out: "Lego — €49.99 https://amazon.es/x" → "Lego", the link,
 * 4999.
 */
export function takeExtras(line: string): {
  rest: string;
  url: string | null;
  priceCents: number | null;
} {
  let rest = line;
  const url = URL_PATTERN.exec(rest)?.[0].replace(/[).,;:!?]+$/u, "") ?? null;
  if (url) rest = rest.replace(url, " ");
  const price = LINE_PRICE.exec(rest);
  let priceCents: number | null = null;
  if (price) {
    const cents = amountToCents(price[1] ?? price[2]);
    if (cents <= PRICE_MAX_CENTS) {
      priceCents = cents;
      rest = rest.replace(price[0], " ");
    }
  }
  rest = rest
    .replace(/\s+/gu, " ")
    // A dash or "·" left at either end once they're gone: "Lego —".
    .replace(/^[\s—–\-·:]+|[\s—–\-·:,]+$/gu, "")
    // Two dashes in a row where the price sat between them.
    .replace(/\s[—–-]\s+[—–-]\s/u, " — ");
  return { rest, url, priceCents };
}

export type ChecklistTotals = { total: number; left: number };

/**
 * Sums of the priced items: all of them, and the unchecked ones (still to
 * buy, still to do). Null — no item has a price.
 */
export function checklistTotals(
  items: readonly { priceCents: number | null; checked: boolean }[],
): ChecklistTotals | null {
  const priced = items.filter((item) => item.priceCents !== null);
  if (priced.length === 0) return null;
  return {
    total: priced.reduce((sum, item) => sum + item.priceCents!, 0),
    left: priced
      .filter((item) => !item.checked)
      .reduce((sum, item) => sum + item.priceCents!, 0),
  };
}

/** "Total €240 · Left €90"; all ticked — "Total €240 · all done". */
export function totalsLabel(totals: ChecklistTotals, currency: string): string {
  const total = `Total ${formatMoney(totals.total, currency)}`;
  return totals.left === 0
    ? `${total} · all done`
    : totals.left === totals.total
      ? total
      : `${total} · Left ${formatMoney(totals.left, currency)}`;
}
