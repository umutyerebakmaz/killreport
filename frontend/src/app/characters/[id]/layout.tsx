import { characterShareText } from '@/lib/shareCard/entityShare';
import {
  loadCharacterShare,
  SHARE_METADATA_REVALIDATE,
  shareMetadata,
} from '@/lib/shareCard/shareRoute';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  return shareMetadata(
    () => loadCharacterShare(params, SHARE_METADATA_REVALIDATE),
    characterShareText,
  );
}

export default function CharacterLayout({ children }: { children: ReactNode }) {
  return children;
}
