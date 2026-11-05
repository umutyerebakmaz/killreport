import { CorporationShareCard } from '@/components/ShareCard';
import {
  ShareCorporationDocument,
  type ShareCorporationQuery,
  type ShareCorporationQueryVariables,
} from '@/generated/graphql';
import {
  toShareCorporation,
  corporationShareProps,
} from '@/lib/shareCard/entityShare';
import { fetchGraphQL } from '@/lib/shareCard/fetchGraphQL';
import { loadShareCardFonts } from '@/lib/shareCard/fonts';
import { SHARE_CARD_SIZE } from '@/lib/shareCard/palette';
import { ImageResponse } from 'next/og';

export const size = SHARE_CARD_SIZE;
export const contentType = 'image/png';
export const alt = 'Corporation share card';
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
    ShareCorporationQuery,
    ShareCorporationQueryVariables
  >(ShareCorporationDocument, { id }, 3600);
  const entity = toShareCorporation(id, data);
  if (!entity) return new Response(null, { status: 404 });

  const fonts = await loadShareCardFonts();
  return new ImageResponse(
    <CorporationShareCard p={corporationShareProps(entity)} />,
    { ...size, fonts },
  );
}
