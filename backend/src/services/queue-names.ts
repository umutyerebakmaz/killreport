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

/**
 * The retry topology every application queue is wired into: a fanout dead
 * letter exchange, a wait queue that holds a message for `waitTtlMs` before
 * its TTL expiry dead-letters it onward, a direct retry exchange that routes
 * it back to the queue it came from (by routing key, which is the origin
 * queue's name), and a parking queue for messages that gave up for good.
 */
export const RETRY_TOPOLOGY = {
  dlx: 'killreport.dlx',
  retry: 'killreport.retry',
  wait: 'killreport.wait',
  parking: 'killreport.parking',
  waitTtlMs: 30000,
} as const;

/**
 * The two queues the retry topology owns. They are declared like every other
 * queue but they are not application queues — nothing consumes them.
 */
export const TOPOLOGY_QUEUES: readonly string[] = [
  RETRY_TOPOLOGY.wait,
  RETRY_TOPOLOGY.parking,
];
