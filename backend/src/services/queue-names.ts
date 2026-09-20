/**
 * Every queue this application uses, in one place.
 *
 * It was two places: `ALL_QUEUES` (19 names, which `ensureAllQueuesExist()`
 * declared) and a second hardcoded array inside `getAllQueueStats()` (20 names,
 * which monitoring read). The difference was `esi_type_price_queue` — monitored
 * but never declared — so a queue could be declared and unmonitored, monitored
 * and undeclared, or neither. Six names were in neither list.
 *
 * Declaration equivalence makes this load-bearing: every declaration must pass
 * the same `x-max-priority: 10`, and a second list is a second chance to get
 * that wrong. That is the 406 that took three workers down in #135.
 */
export const ALL_QUEUES: readonly string[] = [
  // ESI info workers (entity enrichment)
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

  // ESI sync workers
  'esi_alliance_corporations_queue',

  // ESI universe workers
  'esi_regions_queue',
  'esi_constellations_queue',
  'esi_solar_systems_queue',

  // ESI universe topology chain
  'esi_stars_queue',
  'esi_planets_queue',
  'esi_moons_queue',
  'esi_asteroid_belts_queue',
  'esi_stargates_queue',
  'esi_stations_queue',
  'esi_topology_dlq',

  // Killmail workers
  'esi_corporation_killmails_queue',
  'esi_user_killmails_queue',

  // zKillboard workers
  'zkillboard_character_queue',

  // Maintenance and backfill workers
  'backfill_killmail_values_queue',
];
