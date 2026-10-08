// 2026-10-08 — what the app calls you when the name is empty: the first
// word of the email's part before "@", capitalised ("natalia.cherniavska@…"
// → "Natalia"), and nothing at all when that word doesn't look like a name
// ("jd77", "x"): a greeting without a name reads better than "there".

/** Letters only, at least two of them, in any alphabet. */
const NAME_LIKE = /^\p{L}{2,}$/u;

export function displayName(
  name: string | null | undefined,
  email: string | null | undefined,
): string | null {
  const own = name?.trim();
  if (own) return own;
  const local = email?.split("@")[0] ?? "";
  const first = local.split(/[._\-+\d]+/).find((part) => part.length > 0);
  if (!first || !NAME_LIKE.test(first)) return null;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}
