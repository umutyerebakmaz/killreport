import {
  buildDetailMessage,
  KILLMAIL_DETAIL_QUEUE,
} from '@services/killmail-detail-message';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { getRabbitMQChannel } from '@services/rabbitmq';

export interface KillmailRef {
  killmail_id: number;
  killmail_hash: string;
}

export interface PublishOptions {
  announce: boolean;
  /** Toplu backfill 1, canlı sync 5. */
  priority: number;
}

/**
 * Tek sorguda sorulacak id sayısı.
 *
 * `yarn sync:character <id> 999` ~199.800 killmail listeliyor ve PostgreSQL'in
 * genişletilmiş protokolü bind parametrelerini 65.535'te kesiyor; Prisma bunu
 * kendiliğinden parçalamıyor. Tek `IN (…)` ile sorulursa sorgu reddedilir ve
 * script hiçbir şey kuyruğa koymadan ölür.
 */
const LOOKUP_CHUNK = 5_000;

/**
 * Liste aşamasının kuyruğa koyma adımı.
 *
 * Veritabanında olan id'ler **yayınlanmaz**: CLAUDE.md'nin enrichment kalıbı —
 * kaynak veritabanından okur, çözülmüş olanı eler, yalnızca eksik olanı
 * kuyruğa koyar. Bu, "önce detayı çek, sonra duplicate'e takıl" sırasını
 * tersine çevirir; zaten kayıtlı bir karakterin yeniden sync'i sayfa başına
 * tek sorguya iner ve hiç ESI detayı çekmez.
 */
export async function publishKillmailDetails(
  refs: KillmailRef[],
  options: PublishOptions,
): Promise<number> {
  if (refs.length === 0) return 0;

  const stored = new Set<number>();
  for (let i = 0; i < refs.length; i += LOOKUP_CHUNK) {
    const chunk = refs.slice(i, i + LOOKUP_CHUNK);
    const known = await prismaWorker.killmail.findMany({
      where: { killmail_id: { in: chunk.map((r) => r.killmail_id) } },
      select: { killmail_id: true },
    });
    for (const row of known) stored.add(row.killmail_id);
  }

  const missing = refs.filter((r) => !stored.has(r.killmail_id));
  if (missing.length === 0) return 0;

  const channel = await getRabbitMQChannel();
  for (const ref of missing) {
    channel.sendToQueue(
      KILLMAIL_DETAIL_QUEUE,
      Buffer.from(
        JSON.stringify(
          buildDetailMessage(
            ref.killmail_id,
            ref.killmail_hash,
            options.announce,
          ),
        ),
      ),
      { persistent: true, priority: options.priority },
    );
  }

  logger.debug(
    `📤 queued ${missing.length}/${refs.length} killmail(s) for detail fetch`,
  );
  return missing.length;
}
