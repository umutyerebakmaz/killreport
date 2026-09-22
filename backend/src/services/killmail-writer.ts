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
   * NEW_KILLMAIL yayınlansın mı.
   *
   * Varsayılan true. Toplu backfill'ler false geçer: abonelere 20.000 tarihî
   * killmail'i "yeni" diye göndermek, frontend'in canlı listesini
   * (`frontend/src/app/killmails/page.tsx:158` gelen olayı listenin başına
   * ekliyor) kullanılamaz hâle getirir.
   */
  publish?: boolean;
}

/**
 * Bir killmail'i veritabanına yazmanın tek yeri.
 *
 * `true` = yeni yazıldı, `false` = zaten vardı. "Zaten vardı" bir hata değil
 * sonuçtur; çağıranların P2002 yakalamasının yerine geçer.
 */
export async function saveKillmail(
  detail: KillmailDetail,
  hash: string,
  options: SaveKillmailOptions = {},
): Promise<boolean> {
  // Bir killmail'in en az bir attacker'ı vardır. Boş liste, killmail'i
  // attacker_count: 0 ile yazar ve agregatların kimseyi saymamasına yol açar —
  // yani "kaydedildi ama hiçbir yerde görünmüyor" durumu, #245'te uğraştığımız
  // sessiz bozukluğun aynısı. Kaynağın onu yeniden çekmesi gerekir.
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
          position_x: victim.position?.x || null,
          position_y: victim.position?.y || null,
          position_z: victim.position?.z || null,
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

      // ESI gerçek veride item_type_id'si null olan item gönderiyor; bunlar
      // yazılmaya kalkılırsa transaction patlar.
      const validItems = (victim.items ?? []).filter(
        (item) => item.item_type_id != null,
      );
      const skipped = (victim.items?.length ?? 0) - validItems.length;
      if (skipped > 0) {
        logger.warn(
          `   ⚠️  Skipping ${skipped} invalid items (null item_type_id) for killmail ${detail.killmail_id}`,
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
    logger.error(`❌ Failed to write killmail ${detail.killmail_id}`, error);
    throw error;
  }
}
