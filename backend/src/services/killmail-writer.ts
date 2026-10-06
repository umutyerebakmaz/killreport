import { calculateKillmailValues } from '@helpers/calculate-killmail-values';
import { updateDailyAggregatesRealtime } from '@services/kill-stats-realtime';
import { toAggregateInput, toFilterInput } from '@services/killmail-derived';
import { insertKillmailFilter } from '@services/killmail-filters-realtime';
import type { KillmailDetail } from '@services/killmail/killmail.service';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { pubsub } from '@services/pubsub';

export interface SaveKillmailOptions {
  /**
   * Whether to publish NEW_KILLMAIL.
   *
   * Defaults to true. Bulk backfills pass false: sending subscribers 20,000
   * historical killmails as "new" makes the frontend's live list unusable
   * (`frontend/src/app/killmails/page.tsx:158` prepends each incoming event
   * to the list).
   */
  publish?: boolean;
}

/**
 * The one place a killmail is written to the database.
 *
 * `true` = newly written, `false` = already there. "Already there" is a
 * result, not an error; it replaces callers catching P2002 themselves.
 */
export async function saveKillmail(
  detail: KillmailDetail,
  hash: string,
  options: SaveKillmailOptions = {},
): Promise<boolean> {
  // A killmail has at least one attacker. An empty list writes it with
  // attacker_count: 0 and leaves the aggregates counting nobody — "saved but
  // shown nowhere", the same silent breakage we chased in #245. The source
  // has to fetch it again.
  if (!detail.attackers?.length) {
    throw new Error(
      `killmail ${detail.killmail_id} has no attackers; refusing to write it`,
    );
  }

  const existing = await prismaWorker.killmail.findUnique({
    where: { killmail_id: detail.killmail_id },
    select: { killmail_id: true },
  });
  if (existing) return false;

  const { victim, attackers, killmail_time, solar_system_id } = detail;

  try {
    const values = await calculateKillmailValues({
      victim: { ship_type_id: victim.ship_type_id },
      items:
        victim.items?.map((item) => ({
          item_type_id: item.item_type_id,
          quantity_destroyed: item.quantity_destroyed,
          quantity_dropped: item.quantity_dropped,
          singleton: item.singleton,
        })) || [],
    });

    await prismaWorker.$transaction(async (tx) => {
      await tx.killmail.create({
        data: {
          killmail_id: detail.killmail_id,
          killmail_hash: hash,
          killmail_time: new Date(killmail_time),
          solar_system_id,
          total_value: values.totalValue,
          destroyed_value: values.destroyedValue,
          dropped_value: values.droppedValue,
          attacker_count: attackers.length,
        },
      });

      await tx.victim.create({
        data: {
          killmail_id: detail.killmail_id,
          character_id: victim.character_id || null,
          corporation_id: victim.corporation_id,
          alliance_id: victim.alliance_id || null,
          ship_type_id: victim.ship_type_id,
          damage_taken: victim.damage_taken,
          position_x: victim.position?.x ?? null,
          position_y: victim.position?.y ?? null,
          position_z: victim.position?.z ?? null,
          faction_id: victim.faction_id ?? null,
        },
      });

      await tx.attacker.createMany({
        skipDuplicates: true,
        data: attackers.map((attacker) => ({
          killmail_id: detail.killmail_id,
          character_id: attacker.character_id || null,
          corporation_id: attacker.corporation_id || null,
          alliance_id: attacker.alliance_id || null,
          ship_type_id: attacker.ship_type_id || null,
          weapon_type_id: attacker.weapon_type_id || null,
          damage_done: attacker.damage_done,
          final_blow: attacker.final_blow,
          security_status: attacker.security_status ?? null,
          faction_id: attacker.faction_id ?? null,
        })),
      });

      await updateDailyAggregatesRealtime(tx, toAggregateInput(detail));

      // ESI sends items with a null item_type_id in real data; trying to
      // write them blows up the transaction.
      const validItems = (victim.items ?? []).filter(
        (item) => item.item_type_id != null,
      );
      const skipped = (victim.items?.length ?? 0) - validItems.length;
      if (skipped > 0) {
        logger.warn(
          `   ⚠️  skipping ${skipped} invalid items (null item_type_id) for killmail ${detail.killmail_id}`,
        );
      }
      if (validItems.length > 0) {
        await tx.killmailItem.createMany({
          skipDuplicates: true,
          data: validItems.map((item) => ({
            killmail_id: detail.killmail_id,
            item_type_id: item.item_type_id,
            flag: item.flag,
            quantity_dropped: item.quantity_dropped || null,
            quantity_destroyed: item.quantity_destroyed || null,
            singleton: item.singleton,
          })),
        });
      }
    });

    await insertKillmailFilter(toFilterInput(detail));

    if (options.publish ?? true) {
      await pubsub.publish('NEW_KILLMAIL', { killmailId: detail.killmail_id });
    }

    return true;
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2002') return false;
    logger.error(`❌ failed to write killmail ${detail.killmail_id}`, error);
    throw error;
  }
}
