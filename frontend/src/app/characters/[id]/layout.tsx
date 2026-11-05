import {
  ShareCharacterDocument,
  type ShareCharacterQuery,
  type ShareCharacterQueryVariables,
} from '@/generated/graphql';
import {
  toShareCharacter,
  characterShareText,
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
    ShareCharacterQuery,
    ShareCharacterQueryVariables
  >(ShareCharacterDocument, { id }, 3600);
  const entity = toShareCharacter(id, data);
  if (!entity) return {};
  const { title, description } = characterShareText(entity);
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: 'summary_large_image' },
  };
}

export default function CharacterLayout({ children }: { children: ReactNode }) {
  return children;
}
