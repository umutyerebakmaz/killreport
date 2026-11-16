/**
 * The snapshot date: midnight UTC of the UTC calendar day `now` falls on,
 * whatever the machine's time zone. Snapshot columns are `@db.Date`, so a
 * local midnight (21:00 UTC the day before, in Istanbul) would land on the
 * wrong day. Mirrored by `utc_day` in the Rust snapshot jobs.
 */
export function utcDay(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}
