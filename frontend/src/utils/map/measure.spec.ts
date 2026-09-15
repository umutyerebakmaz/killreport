import { describe, expect, it, vi } from 'vitest';
import { labelFontString } from './labelStyle';
import { createLabelMeasurer, type MeasureContext } from './measure';

/** A fake 2d context that counts every character as 10 px. */
function fakeContext() {
  return {
    font: '',
    measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
  } satisfies MeasureContext;
}

describe('createLabelMeasurer', () => {
  it('adds letterSpacing to the measured width', () => {
    const ctx = fakeContext();
    const measure = createLabelMeasurer(ctx)!;

    // 'AB' is two characters: 20 px of text plus 3 px of spacing each.
    expect(measure('region', 'AB')).toBe(26);
    // The system tier spaces by 0, so the bare measurement is the answer.
    expect(measure('system', 'AB')).toBe(20);
  });

  it('sets the context font from the tier before measuring', () => {
    const ctx = fakeContext();
    const measure = createLabelMeasurer(ctx)!;

    measure('constellation', 'Kimotoro');

    // Asserted against `labelFontString` rather than a literal, because what
    // this test is for is that the measurer takes its font from that one
    // function. The literals are pinned once, for all three tiers, in
    // `labelStyle.spec.ts`.
    expect(ctx.font).toBe(labelFontString('constellation'));
  });

  it('measures the uppercased text on the region tier', () => {
    const ctx = fakeContext();
    const measure = createLabelMeasurer(ctx)!;

    measure('region', 'Sinq Laison');

    expect(ctx.measureText).toHaveBeenCalledWith('SINQ LAISON');
  });

  it('does not measure the same name twice', () => {
    const ctx = fakeContext();
    const measure = createLabelMeasurer(ctx)!;

    measure('system', 'Jita');
    measure('system', 'Jita');

    expect(ctx.measureText).toHaveBeenCalledTimes(1);
  });

  it('caches each tier separately', () => {
    const ctx = fakeContext();
    const measure = createLabelMeasurer(ctx)!;

    measure('system', 'Jita');
    measure('constellation', 'Jita');

    expect(ctx.measureText).toHaveBeenCalledTimes(2);
  });

  it('returns null when there is no context', () => {
    expect(createLabelMeasurer(null)).toBeNull();
  });
});
