'use client';

import type { MapScope } from '@/generated/graphql';

/**
 * Placeholder while the renderer is swapped. The Pixi scene lands in Task 7;
 * until then /map is deliberately blank rather than half-drawn, so a partial
 * commit cannot be mistaken for a rendering bug.
 */
export default function UniverseMap({ scope }: { scope: MapScope }) {
  return (
    <div className="flex h-full items-center justify-center bg-ground text-gray-400">
      The map is being rebuilt on PixiJS ({scope}).
    </div>
  );
}
