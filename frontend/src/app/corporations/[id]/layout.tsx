import {
  ShareCorporationDocument,
  type ShareCorporationQuery,
  type ShareCorporationQueryVariables,
} from '@/generated/graphql';
import {
  toShareCorporation,
  corporationShareText,
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
    ShareCorporationQuery,
    ShareCorporationQueryVariables
  >(ShareCorporationDocument, { id }, 3600);
  const entity = toShareCorporation(id, data);
  if (!entity) return {};
  const { title, description } = corporationShareText(entity);
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: 'summary_large_image' },
  };
}

export default function CorporationLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
