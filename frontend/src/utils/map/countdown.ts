/**
 * What a sovereignty timer says, as text.
 *
 * One function for the panel's Timers row and the popup's campaign line, so
 * the two can never disagree about how long is left. All of it is pure: the caller passes `now`, which is what makes the
 * thresholds testable to the millisecond.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Past this, the panel says how old its timers are. The worker runs every minute. */
export const STALE_AFTER_MS = 10 * MINUTE;

export type CountdownCampaign = {
  startTime: string;
  defenderScore?: number | null;
  attackersScore?: number | null;
};

const EVENT_LABEL: Record<string, string> = {
  ihub_defense: 'IHub',
  tcu_defense: 'TCU',
  station_defense: 'Station',
  station_freeport: 'Freeport',
};

/** ESI's event type in the words a pilot uses; an unknown one passes through. */
export function eventLabel(eventType: string): string {
  return EVENT_LABEL[eventType] ?? eventType;
}

/** A campaign's start time is the moment its timer opens; from then it is live. */
export function isLive(campaign: CountdownCampaign, now: number): boolean {
  return Date.parse(campaign.startTime) <= now;
}

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * Floors throughout: "00:00" is the last second before the timer opens, and
 * the timer reads LIVE on the second it actually does rather than one early.
 * ESI's scores are 0..1; they are shown as whole percentages.
 */
export function countdownText(
  campaign: CountdownCampaign,
  now: number,
): string {
  const left = Date.parse(campaign.startTime) - now;

  if (left <= 0) {
    const { defenderScore, attackersScore } = campaign;
    if (defenderScore == null || attackersScore == null) return 'LIVE';
    return `LIVE ${Math.round(defenderScore * 100)}–${Math.round(attackersScore * 100)}`;
  }

  if (left >= DAY) {
    return `${Math.floor(left / DAY)}d ${Math.floor((left % DAY) / HOUR)}h`;
  }

  if (left >= HOUR) {
    return `${Math.floor(left / HOUR)}h ${pad(Math.floor((left % HOUR) / MINUTE))}m`;
  }

  return `${pad(Math.floor(left / MINUTE))}:${pad(Math.floor((left % MINUTE) / SECOND))}`;
}

/**
 * Soonest first. A live timer started before any upcoming one, so a single
 * ascending sort also puts every live one at the top. A copy: the caller's
 * array is Apollo's, and Apollo's results are frozen.
 */
export function byStartTime<T extends { startTime: string }>(
  campaigns: readonly T[],
): T[] {
  return [...campaigns].sort(
    (a, b) => Date.parse(a.startTime) - Date.parse(b.startTime),
  );
}

/** The newest write among the campaigns, or null when there are none. */
export function latestUpdate(
  campaigns: readonly { updatedAt: string }[],
): string | null {
  let latest: string | null = null;
  for (const { updatedAt } of campaigns) {
    if (latest === null || Date.parse(updatedAt) > Date.parse(latest)) {
      latest = updatedAt;
    }
  }
  return latest;
}

export function isStale(latest: string | null, now: number): boolean {
  return latest !== null && now - Date.parse(latest) > STALE_AFTER_MS;
}

/** An ISO timestamp as EVE time, which is UTC: `2026-09-12 14:33 EVE`. */
export function eveTimestamp(iso: string): string {
  return `${new Date(iso).toISOString().slice(0, 16).replace('T', ' ')} EVE`;
}
