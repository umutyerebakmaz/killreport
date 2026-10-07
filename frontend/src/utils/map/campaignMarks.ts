import type { CameraTransform } from './camera';
import { isLive } from './countdown';
import { offScreen, projectX, projectZ } from './labels';
import { systemFloorPx } from './marks';
import { drawnRadiusPx } from './sovLogos';

/** Clear space between a system's drawn mark and the ring around it. */
export const RING_GAP_PX = 3;

/** The ring's stroke, in screen pixels at every zoom. */
export const RING_STROKE_PX = 1.5;

/**
 * Each ring is drawn as this many arcs with gaps between them: a plain circle
 * turning on its centre looks exactly like one standing still, and the gaps
 * are what make the spin visible. Three reads as a turning marker at the
 * ring's few-pixel radius; more arcs shrink each one toward a dash.
 */
export const RING_ARC_COUNT = 3;

/** The gap between two arcs of a ring, in radians (30°). */
export const RING_ARC_GAP_RAD = Math.PI / 6;

/** One full clockwise turn of every ring, in milliseconds. */
export const RING_SPIN_PERIOD_MS = 6_000;

/** A campaign with the position of the system it is fought over. */
export interface CampaignSource {
  systemId: number;
  x: number;
  z: number;
  radius: number;
  startTime: string;
}

/**
 * Campaigns joined to the scene's nodes, in the order given. A campaign whose
 * system the scene does not hold (every one of them, on the POCHVEN and
 * WORMHOLE maps) is dropped: there is nowhere to draw it.
 */
export function campaignSources(
  campaigns: readonly { solarSystemId: number; startTime: string }[],
  nodes: readonly { systemId: number; x: number; z: number; radius: number }[],
): CampaignSource[] {
  const byId = new Map(nodes.map((node) => [node.systemId, node]));
  const sources: CampaignSource[] = [];

  for (const campaign of campaigns) {
    const node = byId.get(campaign.solarSystemId);
    if (!node) continue;
    sources.push({
      systemId: node.systemId,
      x: node.x,
      z: node.z,
      radius: node.radius,
      startTime: campaign.startTime,
    });
  }

  return sources;
}

export interface RingMark {
  x: number;
  y: number;
  radius: number;
  live: boolean;
}

/**
 * Where each ring goes on screen. In screen space rather than the world's:
 * the stroke stays the same width at every zoom, and screen coordinates are
 * small enough for float32 — world metres are not.
 *
 * `drawsLogo` is asked per system, not per layer: with crests on, a system
 * whose owner is not the isolated one, or whose logo has not loaded, is still
 * a dot, and its ring hugs the dot rather than a disc that is not there.
 *
 * Live rings come last in the result, which is draw order.
 */
export function ringMarks({
  sources,
  transform,
  width,
  height,
  drawsLogo,
  now,
}: {
  sources: readonly CampaignSource[];
  transform: CameraTransform;
  width: number;
  height: number;
  drawsLogo: (systemId: number) => boolean;
  now: number;
}): RingMark[] {
  const scale = transform.scaleX;
  const floorPx = systemFloorPx(Math.log2(scale));
  const rings: RingMark[] = [];

  for (const source of sources) {
    const x = projectX(transform, source.x);
    const y = projectZ(transform, source.z);
    const radius =
      drawnRadiusPx(source.radius, scale, floorPx, drawsLogo(source.systemId)) +
      RING_GAP_PX;

    const box = {
      screenX: x,
      screenY: y,
      halfWidth: radius,
      halfHeight: radius,
    };
    if (offScreen(box, width, height)) continue;

    rings.push({ x, y, radius, live: isLive(source, now) });
  }

  // Live rings last, so they are drawn on top: two campaigns in one system
  // give two rings of one size, and the upcoming one must not hide the live
  // one. A stable partition, so each group keeps its soonest-first order.
  return [
    ...rings.filter((ring) => !ring.live),
    ...rings.filter((ring) => ring.live),
  ];
}

/**
 * How far round every ring has turned at `timeMs`, in radians in [0, 2π).
 * From the clock, not a per-frame step, so the speed is the same at 30 fps
 * and at 144. Increasing, which on screen is clockwise: Pixi's y points down,
 * so an angle growing from +x moves towards +y — below the centre.
 */
export function ringSpinAngle(
  timeMs: number,
  periodMs: number = RING_SPIN_PERIOD_MS,
): number {
  const turn = (((timeMs % periodMs) + periodMs) % periodMs) / periodMs;
  return turn * 2 * Math.PI;
}

export interface RingArc {
  start: number;
  end: number;
}

/**
 * A ring's arcs, rotated by `angle`: RING_ARC_COUNT evenly spaced arcs with
 * RING_ARC_GAP_RAD between each pair, start < end, each drawn clockwise from
 * start to end. Angles are not wrapped; Pixi draws any range.
 */
export function ringArcs(
  angle: number,
  count: number = RING_ARC_COUNT,
  gap: number = RING_ARC_GAP_RAD,
): RingArc[] {
  const step = (2 * Math.PI) / count;
  const arcs: RingArc[] = [];
  for (let i = 0; i < count; i++) {
    const start = angle + i * step + gap / 2;
    arcs.push({ start, end: start + step - gap });
  }
  return arcs;
}

/**
 * Whether the rings spin: only while there is a ring to turn, and never for a
 * viewer who asked for reduced motion — they get the same arcs, standing still.
 */
export function shouldSpinRings(
  ringCount: number,
  reducedMotion: boolean,
): boolean {
  return ringCount > 0 && !reducedMotion;
}
