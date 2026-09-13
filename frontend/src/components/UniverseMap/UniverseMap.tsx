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
  panCamera,
  zoomCameraAt,
  zoomLimits,
  zoomToScale,
  type MapCamera,
} from '@/utils/map/camera';
import { edgeSegments, localEdges } from '@/utils/map/edges';
import { layerVisibility, lodBucket } from '@/utils/map/lod';
import { boundsCenter, nearestNode, originFor } from '@/utils/map/origin';
import { gateNeighbours } from '@/utils/map/topology';
import { isWebgl2Available } from '@/utils/map/webgl';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  const scene = useRef<MapScene | null>(null);
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

  const fit = geometry
    ? fitCamera(geometry.bounds, size.width, size.height)
    : null;
  const { camera, onCameraChange } = useMapCamera(scope, fit);

  const bucket = camera ? lodBucket(camera.zoom) : 'galaxy';
  const focus =
    geometry && camera && layerVisibility(bucket).celestials
      ? nearestNode(geometry.nodes, camera.x, camera.z)
      : null;

  const celestialSystemIds =
    focus && geometry
      ? [focus.systemId, ...gateNeighbours(geometry.edges, focus.systemId)]
      : [];
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
      scene.current = built;
      setSize({
        width: built.app.renderer.width,
        height: built.app.renderer.height,
      });
    });

    return () => {
      live = false;
      created?.destroy();
      scene.current = null;
      systemSprites.current = null;
      celestialSprites.current = null;
    };
  }, [webgl]);

  // The galaxy: 5,241 sprites and the full 6,959-segment mesh, built once per
  // scene. The mesh is scene-centre-local, where float32's step is 0.22 px.
  useEffect(() => {
    const s = scene.current;
    if (!s || !geometry) return;
    systemSprites.current = buildSystems(s, geometry.nodes);
    const centre = boundsCenter(geometry.bounds);
    drawEdges(
      s.edgesGalaxy,
      edgeSegments(geometry.edges, geometry.nodes, centre),
      centre,
    );
  }, [geometry]);

  // The focused neighbourhood: at most 9 systems, so the mesh is small and its
  // vertices are focus-local rather than scene-local.
  useEffect(() => {
    const s = scene.current;
    if (!s || !geometry) return;
    if (!focus) {
      s.edgesLocal.clear();
      return;
    }
    const origin = originFor(geometry.bounds, focus);
    const near = localEdges(geometry.edges, celestialSystemIds);
    const gates = celestials.filter((c) => c.kind === MapCelestialKind.Gate);
    drawEdges(
      s.edgesLocal,
      edgeSegments(near, geometry.nodes, origin, gates),
      origin,
    );
  }, [geometry, focus, celestials, celestialSystemIds]);

  useEffect(() => {
    const s = scene.current;
    if (!s || !geometry) return;
    const systemById = new Map(
      geometry.nodes.map((node) => [node.systemId, node]),
    );
    celestialSprites.current = buildCelestials(s, celestials, systemById);
  }, [geometry, celestials]);

  // Camera and counter-scale. The transform is one object write; the scale pass
  // is 0.60 ms for every system.
  useEffect(() => {
    const s = scene.current;
    if (!s || !camera || !size.width) return;
    const t = cameraTransform(camera, size.width, size.height);
    s.world.scale.set(t.scaleX, t.scaleY);
    s.world.position.set(t.x, t.y);

    const scale = zoomToScale(camera.zoom);
    if (systemSprites.current) scaleSystems(systemSprites.current, scale);
    if (celestialSprites.current)
      scaleCelestials(celestialSprites.current, scale);
  }, [camera, size.width, size.height]);

  useEffect(() => {
    const s = scene.current;
    if (!s) return;
    const v = layerVisibility(bucket);
    s.edgesGalaxy.visible = v.edgesGalaxy;
    s.edgesLocal.visible = v.edgesLocal;
    s.systems.visible = v.systems;
    s.celestials.visible = v.celestials;
    if (celestialSprites.current) {
      setFineVisible(celestialSprites.current, v.fine);
    }
  }, [bucket, celestials]);

  // Pan and zoom. deck.gl shipped a controller; Pixi does not, so the events
  // land here and the arithmetic lives in camera.ts where it is tested.
  useEffect(() => {
    const s = scene.current;
    if (!s || !camera || !fit) return;
    const canvas = s.app.canvas;
    const limits = zoomLimits(fit.zoom);
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let current = camera;

    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const up = () => (dragging = false);
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      current = panCamera(current, e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX;
      lastY = e.clientY;
      onCameraChange(current);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      current = zoomCameraAt(
        current,
        -e.deltaY / 300,
        e.clientX - rect.left,
        e.clientY - rect.top,
        rect.width,
        rect.height,
        limits,
      );
      onCameraChange(current);
    };

    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointerleave', up);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('wheel', wheel, { passive: false });

    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointerleave', up);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('wheel', wheel);
    };
  }, [camera, fit, onCameraChange]);

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
