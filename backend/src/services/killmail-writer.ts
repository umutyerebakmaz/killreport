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
  const existing = await prismaWorker.killmail.findUnique({
    where: { killmail_id: detail.killmail_id },
    select: { killmail_id: true },
  });
  if (existing) return false;

  return true;
}
