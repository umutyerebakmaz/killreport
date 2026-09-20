import type { MapNode } from '@/generated/graphql';
import { describe, expect, it } from 'vitest';
import { securityTint } from './colors';
import type { EdgeSegment } from './edges';
import {
  buildSovIndex,
  groupSegmentsByTint,
  MAP_LAYERS,
  SOV_LOGO_ZOOM,
  type MapLayerData,
} from './layers';
import { SOV_COLORS, SOV_UNOWNED_TINT, sovTint } from './sovColors';

const OWNED = Number(Object.keys(SOV_COLORS)[0]);
const UNCOLOURED = 1;

function node(systemId: number, securityStatus = 0.5): MapNode {
  return {
    systemId,
    name: `S-${systemId}`,
    x: 0,
    z: 0,
    radius: 1e12,
    securityStatus,
    constellationId: 20000001,
    regionId: 10000001,
  };
}

const DATA: MapLayerData = {
  sovereignty: buildSovIndex({
    systems: [
      { systemId: 1, ownerId: OWNED },
      { systemId: 2, ownerId: OWNED },
      { systemId: 3, ownerId: UNCOLOURED },
    ],
  }),
};

describe('the security layer', () => {
  it('records today behaviour unchanged', () => {
    const layer = MAP_LAYERS.security;
    expect(layer.tint(node(1, 0.9), DATA)).toBe(securityTint(0.9));
    expect(layer.tint(node(1, -0.3), DATA)).toBe(securityTint(-0.3));
  });

  it('leaves every gate neutral and never asks for logos', () => {
    const layer = MAP_LAYERS.security;
    expect(layer.edgeTint({ from: 1, to: 2 }, DATA)).toBeNull();
    expect(layer.usesLogos(0)).toBe(false);
    expect(layer.usesLogos(-60)).toBe(false);
  });
});

describe('the sovereignty layer', () => {
  const layer = MAP_LAYERS.sovereignty;

  it('paints a held system in its owner colour', () => {
    expect(layer.tint(node(1), DATA)).toBe(sovTint(OWNED));
  });

  it('paints an unheld system neutral, not its security colour', () => {
    // Security is another layer's sentence; telling two magnitudes at once
    // leaves neither readable.
    expect(layer.tint(node(99, 0.9), DATA)).toBe(SOV_UNOWNED_TINT);
  });

  it('paints an owner the dictionary does not name neutral too', () => {
    // The layer has to be correct while the dictionary is incomplete; the
    // logo carries the identity of a system drawn this way.
    expect(layer.tint(node(3), DATA)).toBe(SOV_UNOWNED_TINT);
  });

  it('falls back to neutral when the layer has no data yet', () => {
    expect(layer.tint(node(1), { sovereignty: null })).toBe(SOV_UNOWNED_TINT);
  });

  it('colours a gate whose two ends share an owner', () => {
    expect(layer.edgeTint({ from: 1, to: 2 }, DATA)).toBe(sovTint(OWNED));
  });

  it('leaves a border gate neutral, which is what draws the border', () => {
    // Different owners, held-to-unheld and unheld-to-unheld alike. Painting
    // half of it in each end's colour would blur the one line that separates
    // two territories.
    expect(layer.edgeTint({ from: 1, to: 3 }, DATA)).toBeNull();
    expect(layer.edgeTint({ from: 1, to: 99 }, DATA)).toBeNull();
    expect(layer.edgeTint({ from: 98, to: 99 }, DATA)).toBeNull();
  });

  it('leaves a gate between two systems of an uncoloured owner neutral', () => {
    // Same owner at both ends, but no colour to paint it with: neutral is the
    // honest answer, not a colour invented at the edge.
    const both: MapLayerData = {
      sovereignty: buildSovIndex({
        systems: [
          { systemId: 3, ownerId: UNCOLOURED },
          { systemId: 4, ownerId: UNCOLOURED },
        ],
      }),
    };
    expect(layer.edgeTint({ from: 3, to: 4 }, both)).toBeNull();
  });

  it('opens the logos at the measured zoom and not below it', () => {
    // -46.2 is where 90% of held systems are more than 16 px from their
    // nearest neighbour, measured 2026-09-19.
    expect(SOV_LOGO_ZOOM).toBe(-46.2);
    expect(layer.usesLogos(SOV_LOGO_ZOOM)).toBe(true);
    expect(layer.usesLogos(SOV_LOGO_ZOOM + 1)).toBe(true);
    expect(layer.usesLogos(SOV_LOGO_ZOOM - 0.01)).toBe(false);
  });
});

describe('buildSovIndex', () => {
  it('indexes the pairs by system and resolves each owner colour once', () => {
    const index = buildSovIndex({ systems: [{ systemId: 1, ownerId: OWNED }] });
    expect(index.ownerBySystem.get(1)).toBe(OWNED);
    expect(index.tintByOwner.get(OWNED)).toBe(sovTint(OWNED));
  });

  it('leaves an owner with no dictionary entry out of the tint map', () => {
    const index = buildSovIndex({
      systems: [{ systemId: 3, ownerId: UNCOLOURED }],
    });
    expect(index.ownerBySystem.get(3)).toBe(UNCOLOURED);
    expect(index.tintByOwner.has(UNCOLOURED)).toBe(false);
  });
});

function segment(from: number, to: number): EdgeSegment {
  return {
    from: [0, 0],
    to: [1, 1],
    regions: [10000001, 10000001],
    constellations: [20000001, 20000001],
    systems: [from, to],
  };
}

describe('groupSegmentsByTint', () => {
  it('puts every segment in one neutral group for the security layer', () => {
    const groups = groupSegmentsByTint(
      [segment(1, 2), segment(1, 3)],
      MAP_LAYERS.security,
      DATA,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].tint).toBeNull();
    expect(groups[0].segments).toHaveLength(2);
  });

  it('splits the sov layer into one group per colour, neutral first', () => {
    // Neutral first is draw order: the borders go down before the territories,
    // so a coloured line is never covered by the grey it separates.
    const groups = groupSegmentsByTint(
      [segment(1, 3), segment(1, 2), segment(2, 1)],
      MAP_LAYERS.sovereignty,
      DATA,
    );
    expect(groups.map((g) => g.tint)).toEqual([null, sovTint(OWNED)]);
    expect(groups[0].segments).toHaveLength(1);
    expect(groups[1].segments).toHaveLength(2);
  });

  it('emits no empty group', () => {
    const groups = groupSegmentsByTint([], MAP_LAYERS.sovereignty, DATA);
    expect(groups).toEqual([]);
  });
});
