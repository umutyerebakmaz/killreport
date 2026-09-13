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
import { useMapPointer, type SceneCanvas } from './useMapPointer';

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
  // The host div is held in state, not a ref, because the scene is built from
  // it: it renders behind the loading, error and empty-scene returns below, so
  // on a cold cache render 1 has no div at all. A ref would leave the creation
  // effect with nothing to attach to and nothing to re-run it, and the map
  // would stay blank for the whole visit. State makes the node's arrival a
  // render the effect can key on.
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  // The scene is a long-lived mutable Pixi object, not render data — holding
  // it in useState and then mutating its properties (`scene.edgesGalaxy
  // .visible = ...`, below) is exactly what react-hooks' immutability rule
  // exists to catch, and rightly flagged it. It stays a ref; `sceneReady` is
  // the render-visible signal that stands in for "the ref now points at
  // something", so effects can still key off it.
  const scene = useRef<MapScene | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  // `useMapPointer` is called from the render body, and reading `scene
  // .current` there — even just to hand its `.app.canvas` to a hook — is a
  // ref access during render, which is its own lint rule. The canvas itself
  // is a plain DOM node no code here ever assigns properties on, so holding
  // its reference in state carries none of the mutation risk `scene` itself
  // does.
  const [canvas, setCanvas] = useState<SceneCanvas | null>(null);
  const systemSprites = useRef<SystemSprites | null>(null);
  const celestialSprites = useRef<CelestialSprites | null>(null);
  // The camera's linear scale, mirrored into a ref so the build effects can
  // size what they build without taking `camera` as a dependency — which would
  // rebuild all 5,241 system sprites on every wheel tick. The counter-scale
  // effect that writes it is declared before those builds on purpose: effects
  // run in declaration order, so the value is already current by the time
  // anything reads it.
  const cameraScale = useRef(1);

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

  // Memoised: `nearestNode` is a linear scan of all 5,241 nodes, and without
  // this it runs on every render — including the many that have nothing to do
  // with where the camera is pointing.
  const focus = useMemo(
    () =>
      geometry && camera && layerVisibility(bucket).celestials
        ? nearestNode(geometry.nodes, camera.x, camera.z)
        : null,
    [geometry, camera, bucket],
  );

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
    if (!webgl || !host) return;
    let live = true;
    let created: MapScene | null = null;

    createScene(host).then((built) => {
      if (!live) {
        built.destroy();
        return;
      }
      created = built;
      scene.current = built;
      setSceneReady(true);
      setCanvas(built.app.canvas);
      setSize({
        width: built.app.renderer.width,
        height: built.app.renderer.height,
      });
    });

    return () => {
      live = false;
      created?.destroy();
      scene.current = null;
      setSceneReady(false);
      setCanvas(null);
      systemSprites.current = null;
      celestialSprites.current = null;
    };
  }, [webgl, host]);

  // Camera and counter-scale. Both are declared above the build effects, so a
  // commit that changes the camera and the data at once has `cameraScale`
  // updated before anything is built from it.
  //
  // The counter-scale needs neither the scene nor the viewport — only the
  // camera — so it is its own effect: keeping it out of the transform's
  // dependency array is what lets `cameraScale` stay current even on the first
  // commit, before the host has been measured.
  useEffect(() => {
    if (!camera) return;
    const scale = zoomToScale(camera.zoom);
    cameraScale.current = scale;
    if (systemSprites.current) scaleSystems(systemSprites.current, scale);
    if (celestialSprites.current)
      scaleCelestials(celestialSprites.current, scale);
  }, [camera]);

  // The transform is one object write.
  useEffect(() => {
    if (!scene.current || !camera || !size.width) return;
    const t = cameraTransform(camera, size.width, size.height);
    scene.current.world.scale.set(t.scaleX, t.scaleY);
    scene.current.world.position.set(t.x, t.y);
  }, [sceneReady, camera, size.width, size.height]);

  // The galaxy: 5,241 sprites and the full 6,959-segment mesh, built once per
  // scene. The mesh is scene-centre-local, where float32's step is 0.22 px.
  //
  // `sceneReady` is in the dependency array, not `geometry` alone, because
  // `scene` is a ref and a ref update does not trigger a re-run. With
  // `fetchPolicy: 'cache-first'` and mapGeometry cached for 24 hours,
  // `geometry` can already be present on the very first render of a repeat
  // visit, before `createScene()`'s promise resolves — an effect keyed on
  // `[geometry]` alone would run exactly once, find `scene.current === null`,
  // and never run again: a permanently blank map. `scene.current` is always
  // set synchronously before `setSceneReady(true)` is called, so by the time
  // this effect re-runs in response to the flag, the ref is never stale.
  useEffect(() => {
    if (!scene.current || !geometry) return;
    systemSprites.current = buildSystems(
      scene.current,
      geometry.nodes,
      cameraScale.current,
    );
    const centre = boundsCenter(geometry.bounds);
    drawEdges(
      scene.current.edgesGalaxy,
      edgeSegments(geometry.edges, geometry.nodes, centre),
      centre,
    );
  }, [sceneReady, geometry]);

  // The focused neighbourhood: at most 9 systems, so the mesh is small and its
  // vertices are focus-local rather than scene-local.
  useEffect(() => {
    if (!scene.current || !geometry) return;
    if (!focus) {
      scene.current.edgesLocal.clear();
      return;
    }
    const origin = originFor(geometry.bounds, focus);
    const near = localEdges(geometry.edges, celestialSystemIds);
    const gates = celestials.filter((c) => c.kind === MapCelestialKind.Gate);
    drawEdges(
      scene.current.edgesLocal,
      edgeSegments(near, geometry.nodes, origin, gates),
      origin,
    );
  }, [sceneReady, geometry, focus, celestials, celestialSystemIds]);

  useEffect(() => {
    if (!scene.current || !geometry) return;
    const systemById = new Map(
      geometry.nodes.map((node) => [node.systemId, node]),
    );
    celestialSprites.current = buildCelestials(
      scene.current,
      celestials,
      systemById,
      cameraScale.current,
    );
  }, [sceneReady, geometry, celestials]);

  useEffect(() => {
    if (!scene.current) return;
    const v = layerVisibility(bucket);
    scene.current.edgesGalaxy.visible = v.edgesGalaxy;
    scene.current.edgesLocal.visible = v.edgesLocal;
    scene.current.systems.visible = v.systems;
    scene.current.celestials.visible = v.celestials;
    if (celestialSprites.current) {
      setFineVisible(celestialSprites.current, v.fine);
    }
  }, [sceneReady, bucket, celestials]);

  // Pan and zoom: the listeners bind once per canvas and read the latest
  // camera through a ref, in useMapPointer.ts — see that file for why.
  const limits = fit ? zoomLimits(fit.zoom) : null;
  useMapPointer(canvas, camera, limits, onCameraChange);

  // Stable, so React attaches it once rather than detaching and re-attaching on
  // every render — which with `setHost` in it would tear the scene down and
  // rebuild it each time.
  const attachHost = useCallback((node: HTMLDivElement | null) => {
    setHost(node);
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

  return <div ref={attachHost} className="relative w-full h-full bg-ground" />;
}
