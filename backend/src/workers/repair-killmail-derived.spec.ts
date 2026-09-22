import { describe, expect, it } from 'vitest';
import { toAggregateInput, toFilterInput } from '@services/killmail-derived';
import { detailFromRows } from './repair-killmail-derived';

/**
 * The repair reads what the workers wrote — `killmails`, `victims`,
 * `attackers` — and rebuilds the same input the live path would have produced,
 * so both go through one mapping rather than two that can disagree.
 */

const killmail = {
  killmail_id: 128431979,
  killmail_time: new Date('2026-09-19T14:03:22Z'),
  solar_system_id: 30002187,
};

const victim = {
  character_id: 95465499,
  corporation_id: 98000001,
  alliance_id: 99005338,
  ship_type_id: 670,
};

const attackers = [
  {
    character_id: 90000001,
    corporation_id: 98000002,
    alliance_id: 99000002,
    ship_type_id: 17738,
  },
  {
    character_id: 90000002,
    corporation_id: 98000002,
    alliance_id: null,
    ship_type_id: null,
  },
];

describe('detailFromRows', () => {
  it('produces the aggregate input the live path would have produced', () => {
    const input = toAggregateInput(detailFromRows(killmail, victim, attackers));

    expect(input.killmail_time).toEqual(new Date('2026-09-19T14:03:22Z'));
    expect(input.character_ids).toEqual([90000001, 90000002]);
    expect(input.corporation_ids).toEqual([98000002, 98000002]);
    expect(input.alliance_ids).toEqual([99000002, null]);
  });

  it('produces the filter input the live path would have produced', () => {
    const input = toFilterInput(detailFromRows(killmail, victim, attackers));

    expect(input.killmail_id).toBe(128431979n);
    expect(input.solar_system_id).toBe(30002187);
    expect(input.attacker_count).toBe(2);
    expect(input.victim_character_id).toBe(95465499);
    expect(input.victim_alliance_id).toBe(99005338);
    expect(input.attacker_ship_type_ids).toEqual([17738, null]);
  });

  it('keeps a null column null rather than turning it into 0', () => {
    const input = toFilterInput(
      detailFromRows(
        { ...killmail, solar_system_id: null },
        { ...victim, character_id: null, alliance_id: null },
        attackers,
      ),
    );

    expect(input.solar_system_id).toBeNull();
    expect(input.victim_character_id).toBeNull();
    expect(input.victim_alliance_id).toBeNull();
  });

  it('refuses a killmail with no attacker rows', () => {
    // Writing a filter row with empty arrays would look repaired while being
    // wrong, and the aggregates would count nobody. Those killmails need
    // their attackers re-fetched, which is not this script's job.
    expect(() => detailFromRows(killmail, victim, [])).toThrow(
      /no attacker rows/i,
    );
  });
});
