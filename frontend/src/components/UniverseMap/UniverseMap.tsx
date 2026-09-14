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
import { labelCandidates, placeLabels } from '@/utils/map/labels';
import { layerVisibility, lodBucket, visibleLabelTiers } from '@/utils/map/lod';
import { boundsCenter, nearestNode, originFor } from '@/utils/map/origin';
import { pickSystem, type PickTarget } from '@/utils/map/pick';
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
import { drawLabels, installLabelFonts } from './scene/labels';
import {
  buildSystems,
  scaleSystems,
  type SystemSprites,
} from './scene/systems';
import SystemHoverTip from './SystemHoverTip';
import SystemPopup from './SystemPopup';
import { useMapCamera } from './useMapCamera';
import { useMapCelestials } from './useMapCelestials';
import { useMapLabels } from './useMapLabels';
import { useMapPointer, type MapPick, type SceneCanvas } from './useMapPointer';

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
  // Separate from `sceneReady`: the scene itself must not wait on a webfont
  // download, only the label effect below should. See the scene-creation
  // effect for how the two are decoupled.
  const [fontsReady, setFontsReady] = useState(false);
  const systemSprites = useRef<SystemSprites | null>(null);
  const celestialSprites = useRef<CelestialSprites | null>(null);
  // The camera's linear scale, mirrored into a ref so the build effects can
  // size what they build without taking `camera` as a dependency — which would
  // rebuild all 5,241 system sprites on every wheel tick. The counter-scale
  // effect that writes it is declared before those builds on purpose: effects
  // run in declaration order, so the value is already current by the time
  // anything reads it.
  const cameraScale = useRef(1);

  // The hovered system is held as a full PickTarget: the tip follows the
  // cursor, so its position is refreshed by the next hover anyway.
  const [hovered, setHovered] = useState<PickTarget | null>(null);
  // The selected one is held as an ID only. The popup is anchored to its dot
  // and follows the camera, so its screen position has to be recomputed every
  // render — a frozen screenX would tear the popup off its system on the first
  // pan.
  const [selected, setSelected] = useState<number | null>(null);

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

  const { regions, constellations } = useMapLabels(scope, camera?.zoom ?? null);

  // Hoisted out of the label effect below: it would otherwise re-map all
  // 5,241 nodes into LabelSource objects on every camera change (every
  // pointermove of a drag), rather than once per geometry load.
  const labelSystems = useMemo(
    () =>
      (geometry?.nodes ?? []).map((node) => ({
        id: node.systemId,
        name: node.name,
        x: node.x,
        z: node.z,
      })),
    [geometry],
  );

  // What pickSystem needs, which is what labelSystems needs plus the radius and
  // the security. Memoised for the same reason: without it every render remaps
  // all 5,241 nodes, including the many that have nothing to do with the
  // pointer.
  const pickNodes = useMemo(
    () =>
      (geometry?.nodes ?? []).map((node) => ({
        systemId: node.systemId,
        name: node.name,
        x: node.x,
        z: node.z,
        radius: node.radius,
        securityStatus: node.securityStatus,
      })),
    [geometry],
  );

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
      // Set immediately: 5,241 dots, 6,959 gate lines and the pan/zoom wiring
      // have nothing to do with typography, and must not wait on a webfont
      // download.
      setSceneReady(true);
      setCanvas(built.app.canvas);
      setSize({
        width: built.app.renderer.width,
        height: built.app.renderer.height,
      });
      // Generated once per session; the guard inside makes a second call free.
      // Fired here without blocking the lines above: `fontsReady` is what the
      // label effect waits on instead, so names appear a moment after the
      // dots and lines do — legible before it is labelled, not blank until
      // it is. `.catch` only exists to keep the promise from going unhandled;
      // `installLabelFonts` itself already falls back to whatever face is
      // resolved for 'Shentox' if the load fails.
      installLabelFonts()
        .then(() => {
          if (live) setFontsReady(true);
        })
        .catch(() => {});
    });

    return () => {
      live = false;
      created?.destroy();
      scene.current = null;
      setSceneReady(false);
      setFontsReady(false);
      setCanvas(null);
      systemSprites.current = null;
      celestialSprites.current = null;
    };
  }, [webgl, host]);

  // The viewport, kept in step with the host. deck.gl reported its own size
  // through `onResize`; Pixi's `resizeTo: host` keeps the canvas itself correct
  // but tells React nothing, and `size` is what `cameraTransform` centres on
  // and what `fit` derives the zoom floor from — so without this the camera
  // goes on centring the viewport the map was opened at. An observer on the
  // host rather than a window listener, because the map sits in a flex layout
  // whose height can change with no window resize at all.
  useEffect(() => {
    if (!host) return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      // A hidden or detached element measures 0x0. `fitZoom` has a fallback for
      // a non-positive span, but there is no reason to hand it one.
      if (box.width > 0 && box.height > 0) {
        setSize({ width: box.width, height: box.height });
      }
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [host]);

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

  // Labels live in screen space, so they re-place on every camera change rather
  // than on a bucket change. Their own effect: the dependencies differ from the
  // camera effect's, and folding them in would re-run the 5,241-sprite
  // counter-scale whenever label data arrived.
  useEffect(() => {
    const s = scene.current;
    if (!s || !sceneReady || !fontsReady || !camera || !size.width) return;

    const tiers = visibleLabelTiers(camera.zoom);
    if (tiers.length === 0) {
      drawLabels(s, []);
      return;
    }

    const candidates = labelCandidates({
      tiers,
      regions,
      constellations,
      // System names ride in the geometry that is already loaded; this tier
      // costs no request at all.
      systems: labelSystems,
      transform: cameraTransform(camera, size.width, size.height),
      width: size.width,
      height: size.height,
    });

    drawLabels(s, placeLabels(candidates));
  }, [
    sceneReady,
    fontsReady,
    camera,
    size.width,
    size.height,
    labelSystems,
    regions,
    constellations,
  ]);

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

  // Rebuilt whenever the camera or the viewport moves, which is correct: the
  // projection these close over has changed. useMapPointer holds them in a ref,
  // so a new identity does not rebind the five listeners.
  const pick = useMemo<MapPick>(() => {
    const at = (pointerX: number, pointerY: number) =>
      camera && size.width
        ? pickSystem({
            nodes: pickNodes,
            transform: cameraTransform(camera, size.width, size.height),
            pointerX,
            pointerY,
            cameraScale: cameraScale.current,
          })
        : null;

    return {
      onHover: (pointer) =>
        setHovered(pointer ? at(pointer.x, pointer.y) : null),
      // Clicking empty space closes the popup.
      onSelect: (pointer) => {
        const target = at(pointer.x, pointer.y);
        setSelected(target ? target.node.systemId : null);
      },
    };
  }, [camera, size.width, size.height, pickNodes]);

  useMapPointer(canvas, camera, limits, onCameraChange, pick);

  // The only thing this slice writes to the canvas element itself, and the
  // hover's only mark on the scene. Not a Pixi object, so it stays here rather
  // than in scene/.
  useEffect(() => {
    if (!canvas) return;
    canvas.style.cursor = hovered ? 'pointer' : 'default';
  }, [canvas, hovered]);

  // Stable, so React attaches it once rather than detaching and re-attaching on
  // every render — which with `setHost` in it would tear the scene down and
  // rebuild it each time.
  //
  // The measurement here is the synchronous first one; the observer above takes
  // over from the next change onward.
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

  const selectedNode = selected
    ? (geometry.nodes.find((node) => node.systemId === selected) ?? null)
    : null;
  // Recomputed every render rather than remembered from the click: the popup is
  // anchored to its system, so it has to travel with the camera.
  const transform =
    camera && size.width
      ? cameraTransform(camera, size.width, size.height)
      : null;

  return (
    <div ref={attachHost} className="relative w-full h-full bg-ground">
      {/* No tip over the selected system: the popup already says its name, and
          larger. */}
      {hovered && hovered.node.systemId !== selected && (
        <SystemHoverTip
          name={hovered.node.name}
          securityStatus={hovered.node.securityStatus}
          screenX={hovered.screenX}
          screenY={hovered.screenY}
          viewportWidth={size.width}
          viewportHeight={size.height}
        />
      )}

      {selectedNode && transform && (
        <SystemPopup
          systemId={selectedNode.systemId}
          screenX={selectedNode.x * transform.scaleX + transform.x}
          screenY={selectedNode.z * transform.scaleY + transform.y}
          viewportWidth={size.width}
          viewportHeight={size.height}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
