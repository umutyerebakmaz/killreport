import type { CameraTransform } from './camera';
import { chipPrefix, isLive, type ChipCampaign } from './countdown';
import {
  offScreen,
  overlaps,
  projectX,
  projectZ,
  systemLabelLift,
  type LabelCandidate,
} from './labels';
import { systemFloorPx, systemRadiusPx } from './marks';
import { drawnRadiusPx } from './sovLogos';

/** Clear space between a system's drawn mark and the ring around it. */
export const RING_GAP_PX = 3;

/** The ring's stroke, in screen pixels at every zoom. */
export const RING_STROKE_PX = 1.5;

/** A chip's box: one 12 px line plus its border and padding. */
export const CHIP_HEIGHT_PX = 18;

export const CHIP_PAD_X_PX = 6;

/**
 * The countdown's share of a chip's width, reserved rather than measured: the
 * text changes every second, and a box measured from it would grow and shrink
 * and push its neighbours in and out of view. Wide enough for `LIVE 100–100`
 * and `23h 59m` at 12 px, rounded up — too wide hides a neighbour a little
 * early, too narrow lets two chips overlap.
 */
export const CHIP_COUNTDOWN_RESERVE_PX = 72;

/** A campaign with the position of the system it is fought over. */
export interface CampaignSource {
  campaignId: number;
  systemId: number;
  x: number;
  z: number;
  radius: number;
  startTime: string;
  prefix: string;
}

/**
 * Campaigns joined to the scene's nodes, in the order given — which is the
 * chip priority, so the caller sorts first. A campaign whose system the scene
 * does not hold (every one of them, on the POCHVEN and WORMHOLE maps) is
 * dropped: there is nowhere to draw it.
 */
export function campaignSources(
  campaigns: readonly ChipCampaign[],
  nodes: readonly { systemId: number; x: number; z: number; radius: number }[],
): CampaignSource[] {
  const byId = new Map(nodes.map((node) => [node.systemId, node]));
  const sources: CampaignSource[] = [];

  for (const campaign of campaigns) {
    const node = byId.get(campaign.solarSystemId);
    if (!node) continue;
    sources.push({
      campaignId: campaign.campaignId,
      systemId: node.systemId,
      x: node.x,
      z: node.z,
      radius: node.radius,
      startTime: campaign.startTime,
      prefix: chipPrefix(campaign),
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

  return rings;
}

export interface ChipBox {
  campaignId: number;
  systemId: number;
  screenX: number;
  screenY: number;
  halfWidth: number;
  halfHeight: number;
}

/**
 * Greedy, in the order given: the caller sorts soonest first, so in a crowd
 * the timers about to open are the ones that stay. A chip that does not fit
 * is dropped — its ring still marks the system, and the panel lists it.
 *
 * Anchored above the system, where its name would sit, by the same lift the
 * system label uses; the name itself is not drawn under a chip, which carries
 * it — see `withoutChippedNames`.
 */
export function placeChips({
  sources,
  measure,
  transform,
  width,
  height,
  logos,
}: {
  sources: readonly CampaignSource[];
  measure: (text: string) => number;
  transform: CameraTransform;
  width: number;
  height: number;
  /** Whether the sovereignty layer is drawing logos, as `labelCandidates` takes it. */
  logos: boolean;
}): ChipBox[] {
  const scale = transform.scaleX;
  const floorPx = systemFloorPx(Math.log2(scale));
  const halfHeight = CHIP_HEIGHT_PX / 2;
  const placed: ChipBox[] = [];

  for (const source of sources) {
    const lift = systemLabelLift(
      CHIP_HEIGHT_PX,
      systemRadiusPx(source.radius, scale, floorPx),
      logos,
    );

    const chip: ChipBox = {
      campaignId: source.campaignId,
      systemId: source.systemId,
      screenX: projectX(transform, source.x),
      screenY: projectZ(transform, source.z) - lift,
      halfWidth:
        (measure(source.prefix) +
          CHIP_COUNTDOWN_RESERVE_PX +
          2 * CHIP_PAD_X_PX) /
        2,
      halfHeight,
    };

    if (offScreen(chip, width, height)) continue;
    if (placed.some((other) => overlaps(chip, other))) continue;
    placed.push(chip);
  }

  return placed;
}

/**
 * The label candidates minus the name of every system that got a chip: the
 * chip already carries the name. Only the system tier — ids are unique within
 * a tier, and a region sharing the number is a different thing.
 *
 * Run before `placeLabels`, so a suppressed name does not take a slot.
 */
export function withoutChippedNames(
  candidates: LabelCandidate[],
  chips: readonly ChipBox[],
): LabelCandidate[] {
  if (chips.length === 0) return candidates;
  const chipped = new Set(chips.map((chip) => chip.systemId));
  return candidates.filter(
    (candidate) =>
      candidate.tier !== 'system' ||
      candidate.systemId === undefined ||
      !chipped.has(candidate.systemId),
  );
}
