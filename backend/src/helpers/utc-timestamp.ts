/**
 * A UTC instant as the zone-less text a `timestamp(3)` column stores:
 * `2026-11-26 10:00:00.123`. Bound as text in raw SQL, because a JS `Date`
 * crosses the session time zone (Europe/Istanbul locally) on its way into a
 * column without one. EVE time is UTC.
 */
export function utcTimestamp(date: Date): string {
  return date.toISOString().replace('T', ' ').replace('Z', '');
}
