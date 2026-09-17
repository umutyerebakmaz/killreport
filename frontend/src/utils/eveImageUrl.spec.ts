import { describe, expect, it } from 'vitest';

import { eveImageUrl, fetchSize } from './eveImageUrl';

describe('fetchSize', () => {
  it('asks for twice the drawn size, rounded up to a power of two', () => {
    expect(fetchSize(32)).toBe(64);
    expect(fetchSize(40)).toBe(128);
    expect(fetchSize(48)).toBe(128);
    expect(fetchSize(56)).toBe(128);
    expect(fetchSize(64)).toBe(128);
    expect(fetchSize(128)).toBe(256);
  });

  it('clamps to the range the image server serves this app', () => {
    // The server answers 400 to anything that is not a power of two
    // between 32 and 1024; 512 is the largest this app asks for.
    expect(fetchSize(1)).toBe(32);
    expect(fetchSize(16)).toBe(32);
    expect(fetchSize(256)).toBe(512);
    expect(fetchSize(4000)).toBe(512);
  });
});

describe('eveImageUrl', () => {
  it('builds the render for a ship and the icon on request', () => {
    expect(eveImageUrl({ kind: 'ship', id: 587, size: 64 })).toBe(
      'https://images.evetech.net/types/587/render?size=128',
    );
    expect(eveImageUrl({ kind: 'ship', id: 587, size: 64, icon: true })).toBe(
      'https://images.evetech.net/types/587/icon?size=128',
    );
  });

  it('builds the icon for an ordinary type', () => {
    expect(eveImageUrl({ kind: 'type', id: 1877, size: 32 })).toBe(
      'https://images.evetech.net/types/1877/icon?size=64',
    );
  });

  it('uses bp for a blueprint original and bpc for a copy', () => {
    expect(
      eveImageUrl({ kind: 'type', id: 787, size: 32, blueprint: true }),
    ).toBe('https://images.evetech.net/types/787/bp?size=64');
    expect(
      eveImageUrl({
        kind: 'type',
        id: 787,
        size: 32,
        blueprint: true,
        singleton: 2,
      }),
    ).toBe('https://images.evetech.net/types/787/bpc?size=64');
  });

  it('builds the portrait and the two logos', () => {
    expect(eveImageUrl({ kind: 'character', id: 95465499, size: 64 })).toBe(
      'https://images.evetech.net/characters/95465499/portrait?size=128',
    );
    expect(eveImageUrl({ kind: 'corporation', id: 98000001, size: 32 })).toBe(
      'https://images.evetech.net/corporations/98000001/logo?size=64',
    );
    expect(eveImageUrl({ kind: 'alliance', id: 99000001, size: 32 })).toBe(
      'https://images.evetech.net/alliances/99000001/logo?size=64',
    );
  });
});
