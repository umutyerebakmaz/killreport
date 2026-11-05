import { KillmailShareCard } from '@/components/ShareCard';
import { fileDataUri } from '@/lib/shareCard/assets';
import { loadShareCardFonts } from '@/lib/shareCard/fonts';
import { killmailShareProps } from '@/lib/shareCard/killmailShare';
import { SHARE_CARD_SIZE } from '@/lib/shareCard/palette';
import {
  loadKillmailShare,
  SHARE_IMAGE_FETCH_REVALIDATE,
  shareNotFound,
} from '@/lib/shareCard/shareRoute';
import { ImageResponse } from 'next/og';

export const size = SHARE_CARD_SIZE;
export const contentType = 'image/png';
export const alt = 'Killmail share card';
/** ISR: each id is rendered on its first request, then served from the cache. */
export const dynamic = 'force-static';
/**
 * A killmail never changes, but the names on it can arrive after it does
 * (entity enrichment runs behind ingest), and an id that is missing today can
 * be backfilled tomorrow. A day bounds both; a re-render is one request a day.
 */
export const revalidate = 86400;

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const km = await loadKillmailShare(params, SHARE_IMAGE_FETCH_REVALIDATE);
  if (!km) return shareNotFound();

  const props = killmailShareProps(km);
  const [fonts, tierIconSrc] = await Promise.all([
    loadShareCardFonts(),
    props.tierIcon ? fileDataUri(props.tierIcon) : null,
  ]);
  return new ImageResponse(
    <KillmailShareCard p={props} tierIconSrc={tierIconSrc} />,
    { ...size, fonts },
  );
}
