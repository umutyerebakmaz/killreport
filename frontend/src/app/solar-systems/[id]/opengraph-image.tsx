import { SolarSystemShareCard } from '@/components/ShareCard';
import {
  ShareSolarSystemDocument,
  type ShareSolarSystemQuery,
  type ShareSolarSystemQueryVariables,
} from '@/generated/graphql';
import { fetchGraphQL } from '@/lib/shareCard/fetchGraphQL';
import { loadShareCardFonts } from '@/lib/shareCard/fonts';
import { SHARE_CARD_SIZE } from '@/lib/shareCard/palette';
import {
  solarSystemShareProps,
  toShareSolarSystem,
} from '@/lib/shareCard/solarSystemShare';
import { ImageResponse } from 'next/og';

export const size = SHARE_CARD_SIZE;
export const contentType = 'image/png';
export const alt = 'Solar system share card';
/** Kills and NPC kills are 24 hour windows, so the image is remade every 15 minutes. */
export const revalidate = 900;

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return new Response(null, { status: 404 });
  const data = await fetchGraphQL<
    ShareSolarSystemQuery,
    ShareSolarSystemQueryVariables
  >(ShareSolarSystemDocument, { id }, 900);
  const entity = toShareSolarSystem(data);
  if (!entity) return new Response(null, { status: 404 });

  const fonts = await loadShareCardFonts();
  return new ImageResponse(
    <SolarSystemShareCard p={await solarSystemShareProps(entity)} />,
    { ...size, fonts },
  );
}
