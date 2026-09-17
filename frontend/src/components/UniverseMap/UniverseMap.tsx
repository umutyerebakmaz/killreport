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
  parseFraming,
  zoomLimits,
  zoomToScale,
} from '@/utils/map/camera';
import {
  edgeSegments,
  highlightSegments,
  localEdges,
  type MapArea,
  type MapHighlight,
} from '@/utils/map/edges';
import { framingFor } from '@/utils/map/framing';
import { labelCandidates, placeLabels } from '@/utils/map/labels';
import { layerVisibility, lodBucket, visibleLabelTiers } from '@/utils/map/lod';
import { createLabelMeasurer, whenLabelFontsReady } from '@/utils/map/measure';
import { boundsCenter, nearestNode, originFor } from '@/utils/map/origin';
import { systemFloorPx, systemRadiusPx } from '@/utils/map/marks';
import { pickById, pickSystem, type PickTarget } from '@/utils/map/pick';
import { gateNeighbours } from '@/utils/map/topology';
import { isWebgl2Available } from '@/utils/map/webgl';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createLabelLayer,
  destroyLabelLayer,
  drawLabels,
  type LabelLayer,
} from './labels/labelLayer';
import {
  buildCelestials,
  scaleCelestials,
  setFineVisible,
  type CelestialSprites,
} from './scene/celestials';
import { createScene, type MapScene } from './scene/createScene';
import { drawEdges, drawHighlight } from './scene/edges';
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
import { useMapPointer, type MapPick } from './useMapPointer';

function MapMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center h-full p-8 text-center text-ink-muted">
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
  // The overlay the names are written into. A ref for the same reason `scene`
  // is one: it is a long-lived mutable DOM object that no render reads.
  const labelLayer = useRef<LabelLayer | null>(null);
  // The keys placed last frame. A ref rather than state: it is read and written
  // inside the label effect and must never itself trigger a render.
  const stickyLabels = useRef<Set<string>>(new Set());
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

  // The area — a region or a constellation — whose name the pointer is resting
  // on, or null. A hover, so it is never anything to dismiss: the map returns
  // to itself when the pointer moves off the name. `useMapPointer` hands back
  // the same object while the pointer stays on one name, which is what keeps
  // the effect below from redrawing on every move.
  const [highlighted, setHighlighted] = useState<MapArea | null>(null);

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

  const searchParams = useSearchParams();

  // Where the URL says to look. Resolved against the loaded scene on the
  // client — every node carries its three ids — so none of this costs a query.
  // Memoised because `framingFor` filters all 5,241 nodes, and it is an
  // argument to a hook that runs on every render.
  const framing = useMemo(
    () =>
      framingFor(
        parseFraming(searchParams),
        geometry?.nodes ?? [],
        size.width,
        size.height,
      ),
    [searchParams, geometry, size.width, size.height],
  );

  // `framing ?? fit` rather than a new branch inside the hook: the hook already
  // returns "the camera to use when the URL carries none", and a framing is
  // exactly that. An explicit x/z/zoom in the URL still wins over both, which
  // is what makes the back button whole.
  //
  // The selection is held as an ID only, and by the hook rather than here: the
  // popup is anchored to its dot and follows the camera, so its screen position
  // is recomputed every render — a frozen screenX would tear the popup off its
  // system on the first pan.
  const {
    camera,
    onCameraChange,
    focus: selected,
    onFocusChange: setSelected,
  } = useMapCamera(scope, framing ?? fit);

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
        // The label is held clear of the dot, and past the zoom ramp's cap the
        // dot is this radius rather than the floor.
        radius: node.radius,
      })),
    [geometry],
  );

  // The medoid's drawn radius, looked up rather than fetched: the region
  // label's clearance then uses the very number the renderer uses for that
  // dot.
  const radiusBySystem = useMemo(
    () =>
      new Map(
        (geometry?.nodes ?? []).map((node) => [node.systemId, node.radius]),
      ),
    [geometry],
  );

  const regionSources = useMemo(
    () =>
      regions.map((label) => ({
        id: label.id,
        name: label.name,
        x: label.x,
        z: label.z,
        radius:
          label.systemId == null
            ? undefined
            : radiusBySystem.get(label.systemId),
        bounds: label.bounds ?? undefined,
      })),
    [regions, radiusBySystem],
  );

  // Stripped of `kind`, `systemId` and `bounds`: the constellation tier is
  // always a centroid name today (Task 6 has the backend return both as null
  // for this kind), so there is nothing there for `LabelSource` to carry.
  const constellationSources = useMemo(
    () =>
      constellations.map((label) => ({
        id: label.id,
        name: label.name,
        x: label.x,
        z: label.z,
      })),
    [constellations],
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

  // Built once the face is loaded, because a measurer created earlier would
  // measure the fallback font. Null when the browser has no 2d context: the map
  // then draws no labels at all rather than guessing their width.
  const measure = useMemo(
    () => (fontsReady ? createLabelMeasurer() : null),
    [fontsReady],
  );

  // Reported from an effect rather than from the memo above. A memo is not the
  // place for a side effect: StrictMode invokes it twice, so the warning
  // appeared twice, and it was tied to when the memo happened to recompute
  // rather than to the browser having said no. Keyed on the fact itself, so it
  // is logged once per time that fact holds.
  useEffect(() => {
    if (fontsReady && measure === null) {
      console.warn(
        'Map labels are off: this browser gave no 2d canvas context.',
      );
    }
  }, [fontsReady, measure]);

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
      // `app.screen`, not `renderer.width`: the renderer reports physical pixels
      // — CSS size times the resolution — while the camera, the pointer and the
      // label placement all work in CSS pixels. On a HiDPI screen the two differ
      // by the device pixel ratio, and reading the wrong one would fit the map
      // to a viewport twice the real size and put every hit test out by half.
      setSize({
        width: built.app.screen.width,
        height: built.app.screen.height,
      });
      // Requested once per scene. Fired here without blocking the lines above:
      // `fontsReady` is what the label effect waits on instead, so names appear
      // a moment after the dots and lines do — legible before it is labelled,
      // not blank until it is. What is awaited is the face the measurer will
      // measure against, not an atlas. `.catch` only exists to keep the promise
      // from going unhandled; `whenLabelFontsReady` itself already falls
      // through to whatever face resolves for LABEL_FONT_NAME if the load fails.
      whenLabelFontsReady()
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
      systemSprites.current = null;
      celestialSprites.current = null;
    };
  }, [webgl, host]);

  // The label overlay belongs to the host, not to the scene: it survives a
  // renderer rebuild and has nothing to tear down on the GPU.
  useEffect(() => {
    if (!host) return;
    const layer = createLabelLayer(host);
    labelLayer.current = layer;
    return () => {
      destroyLabelLayer(layer);
      labelLayer.current = null;
    };
  }, [host]);

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

  // One projection per camera or viewport change, and the only one. Four
  // places want the same matrix — the world's own transform, label placement,
  // the hit tests and the popup's anchor — and computing it four times from
  // the same three inputs was four chances for them to disagree about where a
  // system is. `null` until the host has been measured.
  const transform = useMemo(
    () =>
      camera && size.width
        ? cameraTransform(camera, size.width, size.height)
        : null,
    [camera, size.width, size.height],
  );

  // The transform is one object write.
  useEffect(() => {
    if (!scene.current || !transform) return;
    scene.current.world.scale.set(transform.scaleX, transform.scaleY);
    scene.current.world.position.set(transform.x, transform.y);
  }, [sceneReady, transform]);

  // Labels live in screen space, so they re-place on every camera change rather
  // than on a bucket change. Their own effect: the dependencies differ from the
  // camera effect's, and folding them in would re-run the 5,241-sprite
  // counter-scale whenever label data arrived.
  useEffect(() => {
    const layer = labelLayer.current;
    if (!layer || !measure || !camera || !transform) return;

    const tiers = visibleLabelTiers(camera.zoom);
    if (tiers.length === 0) {
      drawLabels(layer, []);
      stickyLabels.current = new Set();
      return;
    }

    const candidates = labelCandidates({
      tiers,
      regions: regionSources,
      constellations: constellationSources,
      // System names ride in the geometry that is already loaded; this tier
      // costs no request at all.
      systems: labelSystems,
      measure,
      transform,
      width: size.width,
      height: size.height,
    });

    const placed = placeLabels(candidates, stickyLabels.current);
    stickyLabels.current = new Set(placed.map((candidate) => candidate.key));
    drawLabels(layer, placed);
  }, [
    host,
    measure,
    camera,
    transform,
    size.width,
    size.height,
    labelSystems,
    regionSources,
    constellationSources,
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
  //
  // The segments are memoised rather than resolved inside the effect because
  // the highlight below filters the same list: recomputing 6,989 endpoint
  // pairs on every pointer move across a region name would undo the point of
  // holding the mesh still.
  const galaxyMesh = useMemo(() => {
    if (!geometry) return null;
    const origin = boundsCenter(geometry.bounds);
    return {
      origin,
      segments: edgeSegments(geometry.edges, geometry.nodes, origin),
    };
  }, [geometry]);

  useEffect(() => {
    if (!scene.current || !geometry || !galaxyMesh) return;
    systemSprites.current = buildSystems(
      scene.current,
      geometry.nodes,
      cameraScale.current,
    );
    drawEdges(
      scene.current.edgesGalaxy,
      galaxyMesh.segments,
      galaxyMesh.origin,
    );
  }, [sceneReady, geometry, galaxyMesh]);

  // What the pointer is resting on, at whichever tier it found something.
  //
  // The three sources already exclude one another: an area name sets
  // `highlighted` and clears `hovered` on its way in, and `hovered` is set by
  // the system name and by the hit test over the dot alike — so the finest
  // tier needs no state and no pointer path of its own, only this read.
  //
  // Keyed on `hovered.node.systemId` and not on `hovered`, which is a fresh
  // PickTarget on every report: the hit test runs on every pointermove across
  // the map, so depending on the object would redraw the highlight on each one
  // for an answer that had not changed.
  const hoveredSystemId = hovered?.node.systemId ?? null;
  const highlight = useMemo<MapHighlight | null>(() => {
    if (highlighted) return highlighted;
    return hoveredSystemId === null
      ? null
      : { tier: 'system', id: hoveredSystemId };
  }, [highlighted, hoveredSystemId]);

  // That mesh, lifted, over the galaxy one. Rebuilt on every change of the
  // hovered thing and on nothing else: a region is 99 edges on average and 260
  // at the busiest, a constellation 7.5 and 19, a system 2.65 and 8, against
  // the 14,400 segments the galaxy mesh holds still.
  useEffect(() => {
    if (!scene.current || !galaxyMesh) return;
    drawHighlight(
      scene.current.edgesHighlight,
      highlight === null
        ? []
        : highlightSegments(galaxyMesh.segments, highlight),
      galaxyMesh.origin,
    );
  }, [sceneReady, galaxyMesh, highlight]);

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
    scene.current.edgesHighlight.visible = v.edgesHighlight;
    scene.current.edgesLocal.visible = v.edgesLocal;
    scene.current.systems.visible = v.systems;
    scene.current.celestials.visible = v.celestials;
    if (celestialSprites.current) {
      setFineVisible(celestialSprites.current, v.fine);
    }
  }, [sceneReady, bucket, celestials]);

  // Pan and zoom: the listeners bind once per host and read the latest camera
  // through a ref, in useMapPointer.ts — see that file for why the host and
  // not the canvas.
  //
  // From the galaxy autofit, never from `framing`. zoomLimits puts the floor at
  // fit - 2; a `?focus=` link arrives at SYSTEM_LABEL_ZOOM, and a floor two
  // levels under *that* would forbid zooming back out to the galaxy at all.
  const limits = fit ? zoomLimits(fit.zoom) : null;

  // Rebuilt whenever the camera or the viewport moves, which is correct: the
  // projection these close over has changed. useMapPointer holds them in a ref,
  // so a new identity does not rebind the five listeners.
  const pick = useMemo<MapPick>(() => {
    const at = (pointerX: number, pointerY: number) =>
      transform
        ? pickSystem({
            nodes: pickNodes,
            transform,
            pointerX,
            pointerY,
            cameraScale: cameraScale.current,
          })
        : null;

    // A name says WHICH system without a hit test, so only where its dot is
    // still has to be worked out — which is what anchors the tip to the dot
    // rather than to the name.
    const byId = (systemId: number) =>
      transform ? pickById(pickNodes, systemId, transform) : null;

    return {
      onHover: (pointer) =>
        setHovered(pointer ? at(pointer.x, pointer.y) : null),
      onHoverSystem: (systemId) => setHovered(byId(systemId)),
      // Clicking empty space closes the popup.
      onSelect: (pointer) => {
        const target = at(pointer.x, pointer.y);
        setSelected(target ? target.node.systemId : null);
      },
      onSelectSystem: (systemId) => setSelected(systemId),
      onHoverArea: setHighlighted,
    };
  }, [transform, pickNodes, setSelected]);

  useMapPointer(host, camera, limits, onCameraChange, pick);

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
  return (
    <div
      ref={attachHost}
      // The cursor on the host rather than written to the canvas's own style:
      // the canvas belongs to the scene, which is a ref no render may read,
      // and `cursor` inherits anyway — so the class here reaches the canvas
      // filling it and the labels above it alike.
      className={`relative w-full h-full bg-ground ${
        hovered ? 'cursor-pointer' : ''
      }`}
    >
      {/* No tip over the selected system: the popup already says its name, and
          larger. */}
      {hovered && camera && hovered.node.systemId !== selected && (
        <SystemHoverTip
          name={hovered.node.name}
          securityStatus={hovered.node.securityStatus}
          screenX={hovered.screenX}
          screenY={hovered.screenY}
          anchorRadius={systemRadiusPx(
            hovered.node.radius,
            zoomToScale(camera.zoom),
            systemFloorPx(camera.zoom),
          )}
          viewportWidth={size.width}
          viewportHeight={size.height}
        />
      )}

      {selectedNode && transform && camera && (
        <SystemPopup
          systemId={selectedNode.systemId}
          screenX={selectedNode.x * transform.scaleX + transform.x}
          screenY={selectedNode.z * transform.scaleY + transform.y}
          // The disc the panel has to clear. Same rule the labels use, so the
          // two never disagree about how big a system is drawn.
          anchorRadius={systemRadiusPx(
            selectedNode.radius,
            zoomToScale(camera.zoom),
            systemFloorPx(camera.zoom),
          )}
          viewportWidth={size.width}
          viewportHeight={size.height}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
