import { MapOwnerKind } from '@/generated/graphql';
import { describe, expect, it } from 'vitest';
import {
  assignFrames,
  atlasSize,
  cellRect,
  LOGO_CELL_PX,
  logoUrl,
  sameBytes,
} from './sovLogos';

const alliance = (ownerId: number) => ({
  ownerId,
  kind: MapOwnerKind.Alliance,
});

describe('logoUrl', () => {
  it('asks the alliance path for an alliance', () => {
    expect(logoUrl(alliance(99003581))).toBe(
      'https://images.evetech.net/alliances/99003581/logo?size=128',
    );
  });

  it('asks the CORPORATION path for a faction', () => {
    // Measured trap: alliances/500003/logo answers 200 with the default
    // alliance emblem, so a faction fetched down the alliance path is drawn
    // as a generic star instead of its own crest — and nothing in the HTTP
    // status says so.
    expect(logoUrl({ ownerId: 500003, kind: MapOwnerKind.Faction })).toBe(
      'https://images.evetech.net/corporations/500003/logo?size=128',
    );
  });

  it('asks for exactly one cell of the atlas', () => {
    // The image server only serves powers of two, and the atlas cell is what
    // the image is drawn into 1:1 — a mismatch would resample every logo.
    expect(logoUrl(alliance(1))).toContain(`size=${LOGO_CELL_PX}`);
  });
});

describe('assignFrames', () => {
  const owners = [alliance(1), alliance(2), alliance(3)];
  const hasOwnLogo = (ownerId: number) => ownerId !== 2 && ownerId !== 3;

  it('gives an owner with its own logo a cell of its own', () => {
    const layout = assignFrames(owners, hasOwnLogo);
    expect(layout.cellByOwner.get(1)).toBe(0);
  });

  it('points every logo-less owner at one shared cell', () => {
    // The default emblem is byte-identical for all of them — 22 of the 79 sov
    // alliances as of 2026-09-20 — so 22 cells would hold 22 copies of one
    // image and the client would download it 22 times.
    const layout = assignFrames(owners, hasOwnLogo);
    expect(layout.cellByOwner.get(2)).toBe(layout.fallbackCell);
    expect(layout.cellByOwner.get(3)).toBe(layout.fallbackCell);
    expect(layout.cellCount).toBe(2);
  });

  it('allocates no fallback cell when every owner has a logo', () => {
    const layout = assignFrames(owners, () => true);
    expect(layout.cellCount).toBe(3);
    expect(layout.fallbackCell).toBe(-1);
  });
});

describe('atlasSize', () => {
  it('fills ten columns and derives the rows', () => {
    expect(atlasSize(80)).toEqual({
      columns: 10,
      rows: 8,
      width: 1280,
      height: 1024,
    });
  });

  it('grows by a row rather than shrinking the cell', () => {
    // A cell that is not exactly LOGO_CELL_PX would resample every logo it
    // holds; an extra row costs 1280 x 128 of texture and nothing else.
    expect(atlasSize(81).rows).toBe(9);
    expect(atlasSize(1)).toEqual({
      columns: 10,
      rows: 1,
      width: 1280,
      height: 128,
    });
  });
});

describe('cellRect', () => {
  it('walks the grid row by row', () => {
    expect(cellRect(0)).toEqual({ x: 0, y: 0, width: 128, height: 128 });
    expect(cellRect(9)).toEqual({ x: 1152, y: 0, width: 128, height: 128 });
    expect(cellRect(10)).toEqual({ x: 0, y: 128, width: 128, height: 128 });
  });
});

describe('sameBytes', () => {
  it('is how a logo-less owner is recognised', () => {
    const a = new Uint8Array([1, 2, 3]).buffer;
    const b = new Uint8Array([1, 2, 3]).buffer;
    const c = new Uint8Array([1, 2, 4]).buffer;
    expect(sameBytes(a, b)).toBe(true);
    expect(sameBytes(a, c)).toBe(false);
    expect(sameBytes(a, new Uint8Array([1, 2]).buffer)).toBe(false);
  });
});
