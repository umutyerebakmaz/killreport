'use client';

import Loader from '@/components/Loader';
import { parseScope } from '@/utils/map/camera';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

// deck.gl reaches for window and a WebGL context at module scope, so the canvas
// never renders on the server.
const UniverseMap = dynamic(
  () => import('@/components/UniverseMap/UniverseMap'),
  {
    ssr: false,
    loading: () => (
      <Loader size="lg" text="Loading the map..." className="h-full p-8" />
    ),
  },
);

function MapContent() {
  const searchParams = useSearchParams();

  // Derived on every render, not seeded on mount: App Router keeps this
  // component mounted when only the query string changes, so the UNIVERSE menu's
  // /map?scope=POCHVEN link would otherwise be swallowed. That was #201.
  const scope = parseScope(searchParams);

  // The map is the only page that wants the whole viewport. Rather than change
  // the header's height for every other page, it cancels main's own padding:
  // main is a flex-1 child of a full-height column, so 100% of its content box
  // plus the 4rem of vertical padding taken back is exactly what is left over
  // between header and footer.
  return (
    <div className="-mx-6 -my-8 h-[calc(100%+4rem)] lg:-mx-8 xl:-mx-12 2xl:-mx-16">
      <UniverseMap scope={scope} />
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense
      fallback={
        <Loader size="lg" text="Loading the map..." className="h-full p-8" />
      }
    >
      <MapContent />
    </Suspense>
  );
}
