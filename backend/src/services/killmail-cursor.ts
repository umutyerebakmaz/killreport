import prismaWorker from '@services/prisma-worker';

/**
 * Artımlı sync'in nerede duracağı, veritabanından türetilir.
 *
 * Eskiden bu bir kolondu (`users.last_killmail_id`) ve worker killmail'leri
 * yazdıktan sonra ilerletirdi. Yayınlamak ile yazmak ayrılınca o defter yalan
 * söylemeye başlar: yayıncı imleci ilerletirse "sync'lendi" artık "kuyruğa
 * kondu" demektir, ve parking'e düşen bir killmail'in üzerinden geçilmiş olur
 * — bir daha hiç denenmez.
 *
 * Buradan okunduğunda "sync'lendi" yeniden "yazıldı" anlamına gelir: düşen bir
 * mesaj bir sonraki turda yeniden listelenir.
 *
 * `killmail_filters` seçilir çünkü aradığımız indeksler orada: attacker
 * dizileri GIN'li, victim kolonları btree'li. Ölçüldü (2026-09-23, 108.890
 * satır): karakter için 4.8 ms, korporasyon için 4.7 ms — ikisi de bitmap
 * index scan.
 */
export async function lastStoredKillmailId(scope: {
  characterId?: number;
  corporationId?: number;
}): Promise<number | undefined> {
  const rows = scope.characterId
    ? await prismaWorker.$queryRaw<{ max: bigint | null }[]>`
        SELECT MAX(killmail_id) AS max FROM killmail_filters
        WHERE attacker_character_ids @> ARRAY[${scope.characterId}]::int[]
           OR victim_character_id = ${scope.characterId}
      `
    : await prismaWorker.$queryRaw<{ max: bigint | null }[]>`
        SELECT MAX(killmail_id) AS max FROM killmail_filters
        WHERE attacker_corporation_ids @> ARRAY[${scope.corporationId}]::int[]
           OR victim_corporation_id = ${scope.corporationId}
      `;

  const max = rows[0]?.max;
  // ::BIGINT comes back as a JavaScript BigInt and JSON.stringify throws on
  // those; every caller passes this straight into a query string or a message.
  return max == null ? undefined : Number(max);
}
