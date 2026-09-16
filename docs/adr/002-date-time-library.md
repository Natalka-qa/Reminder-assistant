# ADR-002: Date/time library

## Status

Accepted

## Context

Master-plan §15 sets non-negotiable rules for time handling: every user has a timezone, the database stores UTC, the UI shows the user's zone, recurrence is computed in the user's zone, and recurring dates must never be advanced with a flat `+24h` (a calendar day is not always 24 wall-clock hours across a DST transition). The plan leaves the library choice open between `date-fns`/`date-fns-tz` and Luxon, noting Luxon "may be more convenient for timezone-heavy logic."

Sprint 2+ adds recurrence (daily/weekly/monthly repeat rules) and Sprint 4 adds conflict detection — both timezone-heavy. Getting the DST behavior right now, while there's only one call site (`src/lib/date`), is cheaper than retrofitting it once recurrence logic depends on it.

## Decision

Use **Luxon**, isolated entirely behind `src/lib/date/index.ts`. No other module constructs a `DateTime` or does timezone math directly — they call the exported functions (`utcToZoned`, `startOfDayInZone`, `endOfDayInZone`, `addDaysInZone`, `addMinutes`, `formatDateInZone`, `formatTimeInZone`).

`addDaysInZone` is the DST-safe way to step a recurring date forward: it converts the UTC instant into the target zone, adds calendar days there (Luxon resolves the wall-clock arithmetic, including DST shifts), then converts back to UTC. This exists specifically so nothing in the codebase reaches for `+24h`.

## Alternative considered

`date-fns` + `date-fns-tz`: lighter weight and already familiar to more developers, but timezone-aware arithmetic requires composing several functions (`utcToZonedTime`, `zonedTimeToUtc`, plus `date-fns`'s own day math) at every call site, which is exactly the kind of repeated, easy-to-get-wrong composition this ADR wants confined to one file. Luxon's `DateTime` carries the zone with the value, which maps more directly onto the §15 rules.

## Consequences

- `luxon` and `@types/luxon` are the only new dependencies for date handling; no `date-fns` anywhere in the codebase.
- DST and day-boundary behavior is covered by unit tests (`src/lib/date/*.test.ts`) run with a fixed `TZ` environment variable so results don't depend on the machine running them.
