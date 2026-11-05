import { allianceShareText } from '@/lib/shareCard/entityShare';
import {
  loadAllianceShare,
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
    () => loadAllianceShare(params, SHARE_METADATA_REVALIDATE),
    allianceShareText,
  );
}

export default function AllianceLayout({ children }: { children: ReactNode }) {
  return children;
}
