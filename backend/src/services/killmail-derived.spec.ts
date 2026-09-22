import { describe, expect, it } from 'vitest';
import type { KillmailDetail } from '@services/killmail/killmail.service';
import { toAggregateInput, toFilterInput } from './killmail-derived';

/**
 * The two derived writes every killmail needs — the daily leaderboard
 * aggregates and the `killmail_filters` row — take their input from the same
 * ESI detail. Mapping it was copied into each worker that saves a killmail,
 * and the copies drifted: `worker-esi-user-killmails` never had it at all, so
 * killmails that arrived through the character sync first were written to
 * `killmails` and counted nowhere (#245).
 */

function detail(overrides: Partial<KillmailDetail> = {}): KillmailDetail {
  return {
    killmail_id: 128431979,
    killmail_time: '2026-09-19T14:03:22Z',
    solar_system_id: 30002187,
    victim: {
      character_id: 95465499,
      corporation_id: 98000001,
      alliance_id: 99005338,
      ship_type_id: 670,
      damage_taken: 1200,
    },
    attackers: [
      {
        character_id: 90000001,
        corporation_id: 98000002,
        alliance_id: 99000002,
        ship_type_id: 17738,
        damage_done: 900,
        final_blow: true,
        security_status: -1.2,
      },
      {
        character_id: 90000002,
        corporation_id: 98000002,
        ship_type_id: 17738,
        damage_done: 300,
        final_blow: false,
        security_status: 0.4,
      },
    ],
    ...overrides,
  };
}

describe('toAggregateInput', () => {
  it('reads the kill date from the killmail, not from the clock', () => {
    const input = toAggregateInput(detail());

    expect(input.killmail_time).toEqual(new Date('2026-09-19T14:03:22Z'));
  });

  it('carries every attacker id, so the service can count unique ones', () => {
    const input = toAggregateInput(detail());

    expect(input.character_ids).toEqual([90000001, 90000002]);
    expect(input.corporation_ids).toEqual([98000002, 98000002]);
  });

  it('turns a missing id into null rather than dropping the attacker', () => {
    // Position matters: the three arrays are read side by side.
    const input = toAggregateInput(detail());

    expect(input.alliance_ids).toEqual([99000002, null]);
    expect(input.alliance_ids).toHaveLength(input.character_ids.length);
  });

  it('handles a killmail with no attacker ids at all (NPC kill)', () => {
    const input = toAggregateInput(
      detail({
        attackers: [
          {
            ship_type_id: 30003,
            damage_done: 500,
            final_blow: true,
            security_status: 0,
          },
        ],
      }),
    );

    expect(input.character_ids).toEqual([null]);
    expect(input.corporation_ids).toEqual([null]);
    expect(input.alliance_ids).toEqual([null]);
  });
});

describe('toFilterInput', () => {
  it('keys the row on the killmail id as a bigint', () => {
    expect(toFilterInput(detail()).killmail_id).toBe(128431979n);
  });

  it('copies the victim across, with missing ids as null', () => {
    const input = toFilterInput(
      detail({
        victim: {
          corporation_id: 98000001,
          ship_type_id: 670,
          damage_taken: 1200,
        },
      }),
    );

    expect(input.victim_corporation_id).toBe(98000001);
    expect(input.victim_ship_type_id).toBe(670);
    expect(input.victim_character_id).toBeNull();
    expect(input.victim_alliance_id).toBeNull();
  });

  it('counts attackers from the list, not from a field that can disagree', () => {
    expect(toFilterInput(detail()).attacker_count).toBe(2);
  });

  it('passes the attacker arrays through unreduced', () => {
    // Deduplication belongs to insertKillmailFilter, which also drops the
    // nulls; doing it twice would hide a mapping mistake here.
    const input = toFilterInput(detail());

    expect(input.attacker_ship_type_ids).toEqual([17738, 17738]);
    expect(input.attacker_alliance_ids).toEqual([99000002, null]);
  });

  it('takes the solar system and time from the detail', () => {
    const input = toFilterInput(detail());

    expect(input.solar_system_id).toBe(30002187);
    expect(input.killmail_time).toEqual(new Date('2026-09-19T14:03:22Z'));
  });
});
