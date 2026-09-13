'use client';

import Loader from '@/components/Loader';
import {
  MapCelestialKind,
  useMapGeometryQuery,
  type MapScope,
} from '@/generated/graphql';
import {
  cameraTransform,
  fitCamera,
  zoomLimits,
  zoomToScale,
} from '@/utils/map/camera';
import { edgeSegments, localEdges } from '@/utils/map/edges';
import { layerVisibility, lodBucket } from '@/utils/map/lod';
import { boundsCenter, nearestNode, originFor } from '@/utils/map/origin';
import { gateNeighbours } from '@/utils/map/topology';
import { isWebgl2Available } from '@/utils/map/webgl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildCelestials,
  scaleCelestials,
  setFineVisible,
  type CelestialSprites,
} from './scene/celestials';
import { createScene, type MapScene } from './scene/createScene';
import { drawEdges } from './scene/edges';
import {
  buildSystems,
  scaleSystems,
  type SystemSprites,
} from './scene/systems';
import { useMapCamera } from './useMapCamera';
import { useMapCelestials } from './useMapCelestials';
import { useMapPointer } from './useMapPointer';

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
  const host = useRef<HTMLDivElement>(null);
  // The scene is a render input, not a ref-only side channel: every effect
  // below that draws into it must re-run once it exists, and a ref update
  // does not trigger that. `createScene` still resolves once, asynchronously,
  // in the mount effect — this only changes where the result is held.
  const [scene, setScene] = useState<MapScene | null>(null);
  const systemSprites = useRef<SystemSprites | null>(null);
  const celestialSprites = useRef<CelestialSprites | null>(null);

  // Static universe data behind a 24 hour Redis key and a STATIC_GAME_DATA
  // response cache: cache-first is overridden here at the call site rather than
  // globally, because apolloClient.ts is shared by every page.
  const { data, loading, error } = useMapGeometryQuery({
    variables: { scope },
    fetchPolicy: 'cache-first',
  });
  const geometry = data?.mapGeometry;

  // Memoised: `useMapCamera` and the pointer hook both take this as an input,
  // and a fresh object every render would churn both on every keystroke of an
  // unrelated state update, not just when the geometry or viewport actually
  // change.
  const fit = useMemo(
    () =>
      geometry ? fitCamera(geometry.bounds, size.width, size.height) : null,
    [geometry, size.width, size.height],
  );
  const { camera, onCameraChange } = useMapCamera(scope, fit);

  const bucket = camera ? lodBucket(camera.zoom) : 'galaxy';
  const focus =
    geometry && camera && layerVisibility(bucket).celestials
      ? nearestNode(geometry.nodes, camera.x, camera.z)
      : null;

  // Memoised for the same reason as `fit`: `useMapCelestials` keys its cache
  // on this array's identity, and the local-edge effect below rebuilds its
  // mesh whenever it changes.
  const celestialSystemIds = useMemo(
    () =>
      focus && geometry
        ? [focus.systemId, ...gateNeighbours(geometry.edges, focus.systemId)]
        : [],
    [focus, geometry],
  );
  const celestials = useMapCelestials(celestialSystemIds);

  // The scene outlives every render; React only builds it, feeds it and tears
  // it down. Mount and unmount, once.
  useEffect(() => {
    if (!webgl || !host.current) return;
    let live = true;
    let created: MapScene | null = null;

    createScene(host.current).then((built) => {
      if (!live) {
        built.destroy();
        return;
      }
      created = built;
      setScene(built);
      setSize({
        width: built.app.renderer.width,
        height: built.app.renderer.height,
      });
    });

    return () => {
      live = false;
      created?.destroy();
      setScene(null);
      systemSprites.current = null;
      celestialSprites.current = null;
    };
  }, [webgl]);

  // The galaxy: 5,241 sprites and the full 6,959-segment mesh, built once per
  // scene. The mesh is scene-centre-local, where float32's step is 0.22 px.
  //
  // `scene` is in the dependency array because it is a piece of state that
  // resolves after the mount effect's promise settles: with `fetchPolicy:
  // 'cache-first'` and mapGeometry cached for 24 hours, `geometry` can be
  // present on the very first render, before the scene exists. An effect
  // keyed on `[geometry]` alone would then run exactly once, with no scene to
  // draw into, and never run again — a permanently blank map on every repeat
  // visit.
  useEffect(() => {
    if (!scene || !geometry) return;
    systemSprites.current = buildSystems(scene, geometry.nodes);
    const centre = boundsCenter(geometry.bounds);
    drawEdges(
      scene.edgesGalaxy,
      edgeSegments(geometry.edges, geometry.nodes, centre),
      centre,
    );
  }, [scene, geometry]);

  // The focused neighbourhood: at most 9 systems, so the mesh is small and its
  // vertices are focus-local rather than scene-local.
  useEffect(() => {
    if (!scene || !geometry) return;
    if (!focus) {
      scene.edgesLocal.clear();
      return;
    }
    const origin = originFor(geometry.bounds, focus);
    const near = localEdges(geometry.edges, celestialSystemIds);
    const gates = celestials.filter((c) => c.kind === MapCelestialKind.Gate);
    drawEdges(
      scene.edgesLocal,
      edgeSegments(near, geometry.nodes, origin, gates),
      origin,
    );
  }, [scene, geometry, focus, celestials, celestialSystemIds]);

  useEffect(() => {
    if (!scene || !geometry) return;
    const systemById = new Map(
      geometry.nodes.map((node) => [node.systemId, node]),
    );
    celestialSprites.current = buildCelestials(scene, celestials, systemById);
  }, [scene, geometry, celestials]);

  // Camera and counter-scale. The transform is one object write; the scale
  // pass is 0.60 ms for every system.
  useEffect(() => {
    if (!scene || !camera || !size.width) return;
    const t = cameraTransform(camera, size.width, size.height);
    scene.world.scale.set(t.scaleX, t.scaleY);
    scene.world.position.set(t.x, t.y);

    const scale = zoomToScale(camera.zoom);
    if (systemSprites.current) scaleSystems(systemSprites.current, scale);
    if (celestialSprites.current)
      scaleCelestials(celestialSprites.current, scale);
  }, [scene, camera, size.width, size.height]);

  useEffect(() => {
    if (!scene) return;
    const v = layerVisibility(bucket);
    scene.edgesGalaxy.visible = v.edgesGalaxy;
    scene.edgesLocal.visible = v.edgesLocal;
    scene.systems.visible = v.systems;
    scene.celestials.visible = v.celestials;
    if (celestialSprites.current) {
      setFineVisible(celestialSprites.current, v.fine);
    }
  }, [scene, bucket, celestials]);

  // Pan and zoom: the listeners bind once per canvas and read the latest
  // camera through a ref, in useMapPointer.ts — see that file for why.
  const limits = fit ? zoomLimits(fit.zoom) : null;
  useMapPointer(scene?.app.canvas ?? null, camera, limits, onCameraChange);

  const measure = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });
  }, []);

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
    <div
      ref={(node) => {
        host.current = node;
        measure(node);
      }}
      className="relative w-full h-full bg-ground"
    />
  );
}
