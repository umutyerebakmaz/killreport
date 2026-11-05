import { solarSystemShareText } from '@/lib/shareCard/solarSystemShare';
import {
  loadSolarSystemShare,
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
    () => loadSolarSystemShare(params, SHARE_METADATA_REVALIDATE),
    solarSystemShareText,
  );
}

export default function SolarSystemLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
