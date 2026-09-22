import type { KillmailFilterData } from '@services/killmail-filters-realtime';
import type { KillmailDetail } from '@services/killmail/killmail.service';
import type { KillmailAggregateData } from '@services/kill-stats-realtime';

/**
 * The input mapping for the two derived writes every saved killmail needs:
 * the daily leaderboard aggregates (`updateDailyAggregatesRealtime`, inside
 * the saving transaction) and the `killmail_filters` row
 * (`insertKillmailFilter`, after it).
 *
 * Both read the same ESI detail, and both mappings were written out again in
 * every worker that saves a killmail. The copies drifted:
 * `worker-esi-user-killmails` never had either call, so a killmail that
 * reached the database through the character sync first was written to
 * `killmails` and counted nowhere — permanently, because every other writer
 * then skips it as a duplicate (#245). Mapping in one place is what keeps the
 * next writer from repeating that; owning the writes themselves is #244.
 */

/** Null rather than undefined: the services filter on `!== null`. */
function orNull(id: number | undefined): number | null {
  return id ?? null;
}

/**
 * The three attacker id lists, read side by side by the aggregate service, so
 * a missing id stays in place as null instead of shortening its array.
 */
export function toAggregateInput(
  detail: KillmailDetail,
): KillmailAggregateData {
  return {
    killmail_time: new Date(detail.killmail_time),
    character_ids: detail.attackers.map((a) => orNull(a.character_id)),
    corporation_ids: detail.attackers.map((a) => orNull(a.corporation_id)),
    alliance_ids: detail.attackers.map((a) => orNull(a.alliance_id)),
  };
}

/**
 * The pre-computed filter row. Arrays are passed through unreduced —
 * `insertKillmailFilter` drops the nulls and deduplicates them itself, and
 * doing it twice would hide a mistake made here.
 *
 * Location, ship group and value are deliberately absent: that service derives
 * them from joins, because the callers never had them.
 */
export function toFilterInput(detail: KillmailDetail): KillmailFilterData {
  return {
    killmail_id: BigInt(detail.killmail_id),
    killmail_time: new Date(detail.killmail_time),
    solar_system_id: detail.solar_system_id,
    attacker_count: detail.attackers.length,
    victim_ship_type_id: orNull(detail.victim.ship_type_id),
    victim_character_id: orNull(detail.victim.character_id),
    victim_corporation_id: orNull(detail.victim.corporation_id),
    victim_alliance_id: orNull(detail.victim.alliance_id),
    attacker_ship_type_ids: detail.attackers.map((a) => orNull(a.ship_type_id)),
    attacker_character_ids: detail.attackers.map((a) => orNull(a.character_id)),
    attacker_corporation_ids: detail.attackers.map((a) =>
      orNull(a.corporation_id),
    ),
    attacker_alliance_ids: detail.attackers.map((a) => orNull(a.alliance_id)),
  };
}
