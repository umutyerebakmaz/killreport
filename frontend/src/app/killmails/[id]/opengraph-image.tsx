import { KillmailShareCard } from '@/components/ShareCard';
import {
  ShareKillmailDocument,
  type ShareKillmailQuery,
  type ShareKillmailQueryVariables,
} from '@/generated/graphql';
import { fileDataUri } from '@/lib/shareCard/assets';
import { fetchGraphQL } from '@/lib/shareCard/fetchGraphQL';
import { loadShareCardFonts } from '@/lib/shareCard/fonts';
import { hasVictim, killmailShareProps } from '@/lib/shareCard/killmailShare';
import { SHARE_CARD_SIZE } from '@/lib/shareCard/palette';
import { ImageResponse } from 'next/og';

export const size = SHARE_CARD_SIZE;
export const contentType = 'image/png';
export const alt = 'Killmail share card';
/** A killmail never changes, so the image is made once. */
export const revalidate = false;

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await fetchGraphQL<
    ShareKillmailQuery,
    ShareKillmailQueryVariables
  >(ShareKillmailDocument, { id }, false);
  const km = data?.killmail;
  if (!hasVictim(km)) return new Response(null, { status: 404 });

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
