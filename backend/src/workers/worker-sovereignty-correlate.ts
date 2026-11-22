#!/usr/bin/env node
/**
 * Sovereignty Killmail Correlation Worker
 *
 * Links killmails to sovereignty campaigns: a killmail in a campaign's system
 * and activity window gets `related_campaign_id` + `is_war_related`, and the
 * tagged kills roll up into `campaign_combat_stats` (kill count, ISK
 * destroyed, defender/attacker split).
 *
 * - A campaign is eligible while active and for 24 hours after it ends, so
 *   the kills of its last minutes and killmails that arrive late still land.
 * - Its window is [start_time - 24 h, end_time], or up to now while active.
 * - A killmail two eligible campaigns both claim goes to the one that started
 *   first, then to the lower campaign_id. A tagged killmail is never
 *   re-evaluated.
 *
 * All three statements run in one transaction. The Rust counterpart,
 * `backend-rs/workers/worker-sovereignty-correlate`, runs the same SQL.
 *
 * Usage:
 *   yarn worker:sov:correlate
 */

import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';

/**
 * `now` as a UTC 'YYYY-MM-DD HH:MM:SS.mmm' string. The columns are `timestamp`
 * without time zone; a JS Date travels as timestamptz and would be cast in the
 * session's time zone, and a database now() would be local time too.
 */
export function timestampFor(now: Date): string {
  return now.toISOString().replace('T', ' ').replace('Z', '');
}

export async function correlateSovereigntyKillmails(now: Date = new Date()) {
  const startTime = Date.now();
  const ts = timestampFor(now);
  logger.info('⚔️  starting sovereignty killmail correlation...');

  try {
    const { campaigns, tagged, withKills } = await prismaWorker.$transaction(
      async (tx) => {
        const [{ n: campaigns }] = await tx.$queryRaw<{ n: number }[]>`
          SELECT COUNT(*)::int AS n FROM sovereignty_campaigns
          WHERE end_time IS NULL OR end_time >= ${ts}::timestamp - interval '24 hours'`;

        const tagged = await tx.$executeRaw`
          WITH
            eligible AS (
              SELECT campaign_id, solar_system_id, start_time,
                     start_time - interval '24 hours' AS window_start,
                     COALESCE(end_time, ${ts}::timestamp) AS window_end
              FROM sovereignty_campaigns
              WHERE end_time IS NULL OR end_time >= ${ts}::timestamp - interval '24 hours'),
            picks AS (
              SELECT DISTINCT ON (k.killmail_id) k.killmail_id, e.campaign_id
              FROM killmails k
              JOIN eligible e ON e.solar_system_id = k.solar_system_id
               AND k.killmail_time >= e.window_start AND k.killmail_time <= e.window_end
              WHERE k.related_campaign_id IS NULL
              ORDER BY k.killmail_id, e.start_time, e.campaign_id)
          UPDATE killmails k
          SET related_campaign_id = p.campaign_id, is_war_related = true, updated_at = ${ts}::timestamp
          FROM picks p
          WHERE k.killmail_id = p.killmail_id AND k.related_campaign_id IS NULL`;

        // A kill is a defender loss when its victim's alliance is the
        // campaign's defender; the attacker side is total - defender. The inner
        // join writes no row for a campaign without kills.
        const withKills = await tx.$executeRaw`
          WITH
            eligible AS (
              SELECT campaign_id, defender_id FROM sovereignty_campaigns
              WHERE end_time IS NULL OR end_time >= ${ts}::timestamp - interval '24 hours'),
            totals AS (
              SELECT e.campaign_id,
                     COUNT(*)::int AS war_kills,
                     COALESCE(SUM(k.total_value), 0) AS isk,
                     (COUNT(*) FILTER (WHERE v.alliance_id = e.defender_id))::int AS def_ships,
                     COALESCE(SUM(k.total_value) FILTER (WHERE v.alliance_id = e.defender_id), 0) AS def_isk
              FROM eligible e
              JOIN killmails k ON k.related_campaign_id = e.campaign_id
              LEFT JOIN victims v ON v.killmail_id = k.killmail_id
              GROUP BY e.campaign_id)
          INSERT INTO campaign_combat_stats
            (campaign_id, war_kills, isk_destroyed, ships_destroyed, defender_isk_lost,
             attacker_isk_lost, defender_ships_lost, attacker_ships_lost, last_correlated)
          SELECT campaign_id, war_kills, isk, war_kills, def_isk, isk - def_isk,
                 def_ships, war_kills - def_ships, ${ts}::timestamp
          FROM totals
          ON CONFLICT (campaign_id) DO UPDATE SET
            war_kills = EXCLUDED.war_kills, isk_destroyed = EXCLUDED.isk_destroyed,
            ships_destroyed = EXCLUDED.ships_destroyed,
            defender_isk_lost = EXCLUDED.defender_isk_lost,
            attacker_isk_lost = EXCLUDED.attacker_isk_lost,
            defender_ships_lost = EXCLUDED.defender_ships_lost,
            attacker_ships_lost = EXCLUDED.attacker_ships_lost,
            last_correlated = EXCLUDED.last_correlated`;

        return { campaigns, tagged, withKills };
      },
    );

    logger.info(`📡 correlating against ${campaigns} campaigns`);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(
      `✅ correlation complete: ${tagged} new killmails tagged, ` +
        `${withKills}/${campaigns} campaigns have war kills (${duration}s)`,
    );
  } catch (error) {
    logger.error('❌ sovereignty correlation failed', { error });
    throw error;
  }
}

// Run only when executed directly, so the spec can import the correlation
if (require.main === module) {
  correlateSovereigntyKillmails()
    .then(async () => {
      await prismaWorker.$disconnect();
      process.exit(0);
    })
    .catch(async () => {
      await prismaWorker.$disconnect();
      process.exit(1);
    });
}
