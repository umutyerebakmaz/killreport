import {
  ShareSolarSystemDocument,
  type ShareSolarSystemQuery,
  type ShareSolarSystemQueryVariables,
} from '@/generated/graphql';
import { fetchGraphQL } from '@/lib/shareCard/fetchGraphQL';
import {
  solarSystemShareText,
  toShareSolarSystem,
} from '@/lib/shareCard/solarSystemShare';
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
    ShareSolarSystemQuery,
    ShareSolarSystemQueryVariables
  >(ShareSolarSystemDocument, { id }, 900);
  const entity = toShareSolarSystem(data);
  if (!entity) return {};
  const { title, description } = solarSystemShareText(entity);
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: 'summary_large_image' },
  };
}

export default function SolarSystemLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
