import { describe, expect, it } from 'vitest';
import { groupQueues } from './queueGroups';

// A copy of ALL_QUEUES in backend/src/services/queue-names.ts. Ten of these
// used to match no group and vanish from the workers page entirely.
const ALL_QUEUES = [
  'esi_alliance_info_queue',
  'esi_character_info_queue',
  'esi_corporation_info_queue',
  'esi_type_info_queue',
  'esi_category_info_queue',
  'esi_item_group_info_queue',
  'esi_type_price_queue',
  'esi_type_dogma_queue',
  'esi_dogma_attribute_info_queue',
  'esi_dogma_effect_info_queue',
  'esi_alliance_corporations_queue',
  'esi_regions_queue',
  'esi_constellations_queue',
  'esi_solar_systems_queue',
  'esi_stars_queue',
  'esi_planets_queue',
  'esi_moons_queue',
  'esi_asteroid_belts_queue',
  'esi_stargates_queue',
  'esi_stations_queue',
  'esi_corporation_killmails_queue',
  'esi_user_killmails_queue',
  'esi_killmail_detail_queue',
  'zkillboard_character_queue',
  'backfill_killmail_values_queue',
];

const q = (name: string) => ({ name });

function groupOf(name: string): string | undefined {
  return groupQueues([q(name)])[0]?.title;
}

describe('groupQueues', () => {
  it('renders every known queue exactly once', () => {
    const groups = groupQueues(ALL_QUEUES.map(q));
    const rendered = groups.flatMap((g) => g.queues.map((x) => x.name));
    expect(rendered.sort()).toEqual([...ALL_QUEUES].sort());
  });

  it('puts every known queue in a named group, not Other', () => {
    for (const name of ALL_QUEUES) {
      expect(groupOf(name), name).not.toBe('Other Workers');
    }
  });

  it('groups the killmail pipeline together', () => {
    expect(groupOf('esi_killmail_detail_queue')).toBe('Killmail Workers');
    expect(groupOf('esi_user_killmails_queue')).toBe('Killmail Workers');
    expect(groupOf('esi_corporation_killmails_queue')).toBe('Killmail Workers');
  });

  it('keeps the value backfill out of the killmail group', () => {
    expect(groupOf('backfill_killmail_values_queue')).toBe(
      'Maintenance & Backfill Workers',
    );
  });

  it('puts the topology chain with the universe queues', () => {
    for (const name of [
      'esi_stars_queue',
      'esi_planets_queue',
      'esi_moons_queue',
      'esi_asteroid_belts_queue',
      'esi_stargates_queue',
      'esi_stations_queue',
    ]) {
      expect(groupOf(name), name).toBe('ESI Universe Workers');
    }
  });

  it('puts type dogma with the info queues', () => {
    expect(groupOf('esi_type_dogma_queue')).toBe('ESI Info Workers');
  });

  it('drops an unknown queue into Other instead of hiding it', () => {
    expect(groupOf('esi_something_new_queue')).toBe('Other Workers');
    expect(groupOf('killreport.parking')).toBe('Other Workers');
  });

  it('omits empty groups', () => {
    expect(groupQueues([q('zkillboard_character_queue')])).toHaveLength(1);
    expect(groupQueues([])).toEqual([]);
  });
});
