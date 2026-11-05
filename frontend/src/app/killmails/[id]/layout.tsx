import { killmailShareText } from '@/lib/shareCard/killmailShare';
import {
  loadKillmailShare,
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
    () => loadKillmailShare(params, SHARE_METADATA_REVALIDATE),
    killmailShareText,
  );
}

export default function KillmailLayout({ children }: { children: ReactNode }) {
  return children;
}
