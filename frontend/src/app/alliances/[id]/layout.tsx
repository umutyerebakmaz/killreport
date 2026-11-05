import {
  ShareAllianceDocument,
  type ShareAllianceQuery,
  type ShareAllianceQueryVariables,
} from '@/generated/graphql';
import {
  toShareAlliance,
  allianceShareText,
} from '@/lib/shareCard/entityShare';
import { fetchGraphQL } from '@/lib/shareCard/fetchGraphQL';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return {};
  const data = await fetchGraphQL<
    ShareAllianceQuery,
    ShareAllianceQueryVariables
  >(ShareAllianceDocument, { id }, 3600);
  const entity = toShareAlliance(id, data);
  if (!entity) return {};
  const { title, description } = allianceShareText(entity);
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: 'summary_large_image' },
  };
}

export default function AllianceLayout({ children }: { children: ReactNode }) {
  return children;
}
