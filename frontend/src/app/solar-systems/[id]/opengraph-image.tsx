import { SolarSystemShareCard } from '@/components/ShareCard';
import { loadShareCardFonts } from '@/lib/shareCard/fonts';
import { SHARE_CARD_SIZE } from '@/lib/shareCard/palette';
import {
  loadSolarSystemShare,
  SHARE_IMAGE_FETCH_REVALIDATE,
  shareNotFound,
} from '@/lib/shareCard/shareRoute';
import { solarSystemShareProps } from '@/lib/shareCard/solarSystemShare';
import { ImageResponse } from 'next/og';

export const size = SHARE_CARD_SIZE;
export const contentType = 'image/png';
export const alt = 'Solar system share card';
/** ISR: each id is rendered on its first request, then served from the cache. */
export const dynamic = 'force-static';
/** Kills and NPC kills are 24 hour windows, so the image is remade every 15 minutes. */
export const revalidate = 900;

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const entity = await loadSolarSystemShare(
    params,
    SHARE_IMAGE_FETCH_REVALIDATE,
  );
  if (!entity) return shareNotFound();

  const fonts = await loadShareCardFonts();
  return new ImageResponse(
    <SolarSystemShareCard p={await solarSystemShareProps(entity)} />,
    { ...size, fonts },
  );
}
