import { describe, expect, it } from 'vitest';
import {
  byStartTime,
  countdownText,
  eventLabel,
  eveTimestamp,
  isLive,
  isStale,
  latestUpdate,
  STALE_AFTER_MS,
} from './countdown';

const NOW = Date.parse('2026-10-07T12:00:00.000Z');
const at = (ms: number) => new Date(NOW + ms).toISOString();
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('countdownText', () => {
  it('shows days and hours from a day out', () => {
    expect(
      countdownText({ startTime: at(DAY + 4 * HOUR + 30 * MINUTE) }, NOW),
    ).toBe('1d 4h');
  });

  it('shows exactly one day as days', () => {
    expect(countdownText({ startTime: at(DAY) }, NOW)).toBe('1d 0h');
  });

  it('shows hours and padded minutes inside a day', () => {
    expect(
      countdownText(
        { startTime: at(2 * HOUR + 4 * MINUTE + 59 * SECOND) },
        NOW,
      ),
    ).toBe('2h 04m');
  });

  it('shows exactly one hour as hours', () => {
    expect(countdownText({ startTime: at(HOUR) }, NOW)).toBe('1h 00m');
  });

  // Inside the hour a fleet is forming up; the seconds are what it is counting.
  it('shows minutes and seconds inside the hour', () => {
    expect(
      countdownText({ startTime: at(42 * MINUTE + 10 * SECOND) }, NOW),
    ).toBe('42:10');
  });

  it('shows the last second as 00:00 rather than going live early', () => {
    expect(countdownText({ startTime: at(999) }, NOW)).toBe('00:00');
  });

  it('is live with both scores as percentages once the timer has started', () => {
    expect(
      countdownText(
        { startTime: at(0), defenderScore: 0.62, attackersScore: 0.38 },
        NOW,
      ),
    ).toBe('LIVE 62–38');
  });

  it('is live alone when ESI has not reported the scores', () => {
    expect(
      countdownText(
        { startTime: at(-MINUTE), defenderScore: null, attackersScore: 0.4 },
        NOW,
      ),
    ).toBe('LIVE');
  });
});

describe('isLive', () => {
  it('is live from the start time on', () => {
    expect(isLive({ startTime: at(0) }, NOW)).toBe(true);
    expect(isLive({ startTime: at(1) }, NOW)).toBe(false);
  });
});

describe('eventLabel', () => {
  it.each([
    ['ihub_defense', 'IHub'],
    ['tcu_defense', 'TCU'],
    ['station_defense', 'Station'],
    ['station_freeport', 'Freeport'],
  ])('names %s as %s', (eventType, label) => {
    expect(eventLabel(eventType)).toBe(label);
  });

  // A new event type from CCP still says something rather than nothing.
  it('passes an unknown type through as it came', () => {
    expect(eventLabel('skyhook_defense')).toBe('skyhook_defense');
  });
});

describe('byStartTime', () => {
  // Live timers started earlier than any upcoming one, so one ascending sort
  // puts them first — the order the panel wants.
  it('puts the live ones first and then the soonest', () => {
    const sorted = byStartTime([
      { id: 'later', startTime: at(3 * HOUR) },
      { id: 'live', startTime: at(-HOUR) },
      { id: 'soon', startTime: at(HOUR) },
    ]);
    expect(sorted.map((c) => c.id)).toEqual(['live', 'soon', 'later']);
  });

  it('does not reorder the caller’s array', () => {
    const input = [{ startTime: at(2) }, { startTime: at(1) }];
    byStartTime(input);
    expect(input[0].startTime).toBe(at(2));
  });
});

describe('freshness', () => {
  it('finds the newest write', () => {
    expect(
      latestUpdate([{ updatedAt: at(-HOUR) }, { updatedAt: at(-MINUTE) }]),
    ).toBe(at(-MINUTE));
  });

  it('has nothing to say about no campaigns', () => {
    expect(latestUpdate([])).toBeNull();
    expect(isStale(null, NOW)).toBe(false);
  });

  it('is stale only past ten minutes', () => {
    expect(isStale(at(-STALE_AFTER_MS), NOW)).toBe(false);
    expect(isStale(at(-STALE_AFTER_MS - 1), NOW)).toBe(true);
  });

  it('prints a write in EVE time, which is UTC', () => {
    expect(eveTimestamp('2026-09-12T14:33:49.046Z')).toBe(
      '2026-09-12 14:33 EVE',
    );
  });
});
