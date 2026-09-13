'use client';

import Loader from '@/components/Loader';
import { useMapGeometryQuery, type MapScope } from '@/generated/graphql';
import { fitCamera, zoomLimits, type MapCamera } from '@/utils/map/camera';
import { boundsCenter, toLocal } from '@/utils/map/origin';
import { isWebgl2Available } from '@/utils/map/webgl';
import { OrthographicView, type OrthographicViewState } from '@deck.gl/core';
import { LineLayer, ScatterplotLayer } from '@deck.gl/layers';
import { DeckGL } from '@deck.gl/react';
import { useCallback, useMemo, useState } from 'react';
import { edgeSegments, edgesLayerProps, systemsLayerProps } from './layers';
import { useMapCamera } from './useMapCamera';

/**
 * flipY: false, so +z points up the screen. That is the orientation the region
 * and constellation SVGs already shipped with — backend/src/scripts/star-map-svg.ts
 * projects "x is screen x, -z is screen y" into an SVG whose +y runs downward —
 * and a map that disagrees with its own thumbnails is a bug nobody can name.
 *
 * The consequence is that nothing in this component negates a coordinate: world
 * y is z, everywhere, and the only transform is subtracting the origin.
 */
const VIEW = new OrthographicView({ id: 'universe', flipY: false });

function MapMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center h-full p-8 text-center text-gray-400">
      {children}
    </div>
  );
}

export default function UniverseMap({ scope }: { scope: MapScope }) {
  const [webgl] = useState(isWebgl2Available);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Static universe data behind a 24 hour Redis key and a STATIC_GAME_DATA
  // response cache: cache-first is the one place in this app that overrides the
  // client's cache-and-network default, and it is overridden here at the call
  // site rather than globally (frontend/src/lib/apolloClient.ts:244 is shared by
  // every page).
  const { data, loading, error } = useMapGeometryQuery({
    variables: { scope },
    fetchPolicy: 'cache-first',
  });

  const geometry = data?.mapGeometry;

  const origin = useMemo(
    () => (geometry ? boundsCenter(geometry.bounds) : { x: 0, z: 0 }),
    [geometry],
  );

  const fit = useMemo<MapCamera | null>(
    () =>
      geometry ? fitCamera(geometry.bounds, size.width, size.height) : null,
    [geometry, size.width, size.height],
  );

  const { camera, onCameraChange } = useMapCamera(scope, fit);

  const layers = useMemo(() => {
    if (!geometry) return [];
    return [
      new LineLayer(
        edgesLayerProps({
          segments: edgeSegments(geometry.edges, geometry.nodes, origin),
        }),
      ),
      new ScatterplotLayer(
        systemsLayerProps({ nodes: geometry.nodes, origin }),
      ),
    ];
  }, [geometry, origin]);

  const viewState = useMemo<OrthographicViewState | null>(() => {
    if (!camera || !fit) return null;
    const [x, z] = toLocal(origin, camera.x, camera.z);
    return { target: [x, z, 0], zoom: camera.zoom, ...zoomLimits(fit.zoom) };
  }, [camera, fit, origin]);

  const measure = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });
  }, []);

  const onViewStateChange = useCallback(
    ({ viewState: next }: { viewState: OrthographicViewState }) => {
      const target = next.target ?? [0, 0, 0];
      onCameraChange({
        x: target[0] + origin.x,
        z: target[1] + origin.z,
        zoom: typeof next.zoom === 'number' ? next.zoom : 0,
      });
    },
    [onCameraChange, origin],
  );

  if (!webgl) {
    return (
      <MapMessage>
        This map needs WebGL 2, which this browser has turned off or does not
        support. The region and system pages show the same space as static maps.
      </MapMessage>
    );
  }

  if (error) {
    return (
      <MapMessage>Could not load the map geometry: {error.message}</MapMessage>
    );
  }

  if (loading && !geometry) {
    return (
      <Loader size="lg" text="Loading the map..." className="h-full p-8" />
    );
  }

  if (!geometry || geometry.nodes.length === 0) {
    return <MapMessage>This scene has no systems to draw.</MapMessage>;
  }

  return (
    <div ref={measure} className="relative w-full h-full bg-ground">
      {viewState && (
        <DeckGL
          views={VIEW}
          viewState={viewState}
          onViewStateChange={onViewStateChange}
          onResize={setSize}
          controller
          layers={layers}
        />
      )}
    </div>
  );
}
