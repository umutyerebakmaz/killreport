import { corporationShareText } from '@/lib/shareCard/entityShare';
import {
  loadCorporationShare,
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
    () => loadCorporationShare(params, SHARE_METADATA_REVALIDATE),
    corporationShareText,
  );
}

export default function CorporationLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
