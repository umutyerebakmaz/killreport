import { CharacterShareCard } from '@/components/ShareCard';
import {
  ShareCharacterDocument,
  type ShareCharacterQuery,
  type ShareCharacterQueryVariables,
} from '@/generated/graphql';
import {
  toShareCharacter,
  characterShareProps,
} from '@/lib/shareCard/entityShare';
import { fetchGraphQL } from '@/lib/shareCard/fetchGraphQL';
import { loadShareCardFonts } from '@/lib/shareCard/fonts';
import { SHARE_CARD_SIZE } from '@/lib/shareCard/palette';
import { ImageResponse } from 'next/og';

export const size = SHARE_CARD_SIZE;
export const contentType = 'image/png';
export const alt = 'Character share card';
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
    ShareCharacterQuery,
    ShareCharacterQueryVariables
  >(ShareCharacterDocument, { id }, 3600);
  const entity = toShareCharacter(id, data);
  if (!entity) return new Response(null, { status: 404 });

  const fonts = await loadShareCardFonts();
  return new ImageResponse(
    <CharacterShareCard p={characterShareProps(entity)} />,
    { ...size, fonts },
  );
}
