import { AllianceShareCard } from '@/components/ShareCard';
import { allianceShareProps } from '@/lib/shareCard/entityShare';
import { loadShareCardFonts } from '@/lib/shareCard/fonts';
import { SHARE_CARD_SIZE } from '@/lib/shareCard/palette';
import {
  loadAllianceShare,
  SHARE_IMAGE_FETCH_REVALIDATE,
  shareNotFound,
} from '@/lib/shareCard/shareRoute';
import { ImageResponse } from 'next/og';

export const size = SHARE_CARD_SIZE;
export const contentType = 'image/png';
export const alt = 'Alliance share card';
/** ISR: each id is rendered on its first request, then served from the cache. */
export const dynamic = 'force-static';
/** Totals move with every killmail, so the image is remade hourly. */
export const revalidate = 3600;

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const entity = await loadAllianceShare(params, SHARE_IMAGE_FETCH_REVALIDATE);
  if (!entity) return shareNotFound();

  const fonts = await loadShareCardFonts();
  return new ImageResponse(
    <AllianceShareCard p={allianceShareProps(entity)} />,
    {
      ...size,
      fonts,
    },
  );
}
