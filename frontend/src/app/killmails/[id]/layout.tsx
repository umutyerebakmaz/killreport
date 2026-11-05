import {
  ShareKillmailDocument,
  type ShareKillmailQuery,
  type ShareKillmailQueryVariables,
} from '@/generated/graphql';
import { fetchGraphQL } from '@/lib/shareCard/fetchGraphQL';
import { hasVictim, killmailShareText } from '@/lib/shareCard/killmailShare';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await fetchGraphQL<
    ShareKillmailQuery,
    ShareKillmailQueryVariables
  >(ShareKillmailDocument, { id }, false);
  const km = data?.killmail;
  if (!hasVictim(km)) return {};
  const { title, description } = killmailShareText(km);
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: 'summary_large_image' },
  };
}

export default function KillmailLayout({ children }: { children: ReactNode }) {
  return children;
}
