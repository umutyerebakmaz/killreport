/**
 * `esi_killmail_detail_queue`'nun taşıdığı mesaj.
 *
 * Bir killmail'i adlandırır ve başka hiçbir şey söylemez. Detay ucu
 * (`/killmails/{id}/{hash}/`) public olduğu için worker'ın token'a ihtiyacı
 * yoktur; token gerektiren liste çağrısı yayıncıda kalır (#238).
 *
 * `announce` bir politika taşır, kimlik değil: yayını yapıp yapmama kararını
 * yayıncı verir (toplu backfill vermez), ama çağrıyı yapan worker'dır.
 */
export const KILLMAIL_DETAIL_QUEUE = 'esi_killmail_detail_queue';

export interface KillmailDetailMessage {
  killmailId: number;
  killmailHash: string;
  announce: boolean;
}

export function buildDetailMessage(
  killmailId: number,
  killmailHash: string,
  announce: boolean,
): KillmailDetailMessage {
  return { killmailId, killmailHash, announce };
}
