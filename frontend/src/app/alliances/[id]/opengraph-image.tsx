import { AllianceShareCard } from '@/components/ShareCard';
import {
  ShareAllianceDocument,
  type ShareAllianceQuery,
  type ShareAllianceQueryVariables,
} from '@/generated/graphql';
import {
  toShareAlliance,
  allianceShareProps,
} from '@/lib/shareCard/entityShare';
import { fetchGraphQL } from '@/lib/shareCard/fetchGraphQL';
import { loadShareCardFonts } from '@/lib/shareCard/fonts';
import { SHARE_CARD_SIZE } from '@/lib/shareCard/palette';
import { ImageResponse } from 'next/og';

export const size = SHARE_CARD_SIZE;
export const contentType = 'image/png';
export const alt = 'Alliance share card';
/** Totals move with every killmail, so the image is remade hourly. */
export const revalidate = 3600;

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return new Response(null, { status: 404 });
  const data = await fetchGraphQL<
    ShareAllianceQuery,
    ShareAllianceQueryVariables
  >(ShareAllianceDocument, { id }, 3600);
  const entity = toShareAlliance(id, data);
  if (!entity) return new Response(null, { status: 404 });

  const fonts = await loadShareCardFonts();
  return new ImageResponse(
    <AllianceShareCard p={allianceShareProps(entity)} />,
    { ...size, fonts },
  );
}
