import { describe, expect, it } from 'vitest';

import { hasFittingSlots } from './fitting-slots';

describe('hasFittingSlots', () => {
  it('gives ships and Upwell structures their slots', () => {
    expect(hasFittingSlots('Ship', 25)).toBe(true); // Frigate
    expect(hasFittingSlots('Structure', 1657)).toBe(true); // Citadel
  });

  it('gives a capsule and a shuttle none, as before', () => {
    expect(hasFittingSlots('Ship', 29)).toBe(false);
    expect(hasFittingSlots('Ship', 31)).toBe(false);
  });

  it('gives nothing that cannot be fitted any slots', () => {
    expect(hasFittingSlots('Deployable', 4093)).toBe(false); // Mobile Cynosural Beacon
    expect(hasFittingSlots('Fighter', 1652)).toBe(false); // Light Fighter
    expect(hasFittingSlots('Starbase', 365)).toBe(false); // Control Tower
    expect(hasFittingSlots('Orbitals', 1025)).toBe(false); // Customs Office
  });

  it('keeps the slots when the category is not known yet', () => {
    // A type whose group or category has not been fetched from ESI: showing
    // the slots is the old behaviour, and the safer miss for a real ship.
    expect(hasFittingSlots(undefined, undefined)).toBe(true);
  });
});
