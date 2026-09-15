import type { LabelTier } from './lod';

export interface LabelTierStyle {
  fontSize: number;
  fontWeight: '500' | '600' | '700';
  letterSpacing: number;
  uppercase: boolean;
}

/**
 * Per-tier styling. The design fixes the ORDER, not these numbers: the
 * background tier must read larger, dimmer and more spaced than the foreground
 * one. The values themselves are meant to be tuned by looking.
 *
 * Region is uppercase and letter-spaced because that is what makes a name read
 * as a region rather than as a big system.
 *
 * The weight follows the size — 700 / 600 / 500 against 16 / 14 / 12 — so the two
 * say the same thing rather than pulling against each other. The opposite was
 * tried first, on the cartographic argument that an area name should be airy
 * where a point name is solid, and it was rejected on sight: a heavy system name
 * under a light region name reads as though the small one matters more. Weight
 * is a hierarchy signal before it is a legibility one.
 *
 * The ladder was 16 / 12 / 8 until 2026-09-15 and a system name at 8 px was
 * simply too small to read on the map. Raising the floor to 12 tightens the
 * ladder to four points a step, which means the size alone no longer carries the
 * hierarchy — the weight, the letter-spacing and the region tier's uppercase do,
 * with size only agreeing with them. The cost is paid in the collision filter: a
 * system box is now half again as wide and its height went 9 → 14, so fewer
 * system names survive at the zoom where the tier opens.
 *
 * These numbers live in TypeScript rather than in `map.css` because the
 * measurer and the renderer have to agree: a collision box built at 16 px for
 * text the browser draws at 12 reserves the wrong room, and no test catches it.
 * `map.css` owns colour, halo and transition; it owns no metric.
 */
export const LABEL_TIER_STYLE: Record<LabelTier, LabelTierStyle> = {
  region: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 3,
    uppercase: true,
  },
  constellation: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
    uppercase: false,
  },
  system: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0,
    uppercase: false,
  },
};

/**
 * The face the measurer measures against, and therefore the face the text has
 * to be drawn in.
 *
 * It lives here with the other four metrics rather than in `map.css` for the
 * same reason they do, only more so: the family IS a metric. Change the stack
 * in one place and the collision boxes silently describe a different face,
 * with the drawn text still fitting its own.
 *
 * The name is exported on its own because `document.fonts.load` wants a bare
 * family with no fallback, so the loader cannot use the stack and used to spell
 * the face out a second time.
 */
export const LABEL_FONT_NAME = 'Shentox';

/** The stack the measurer and the elements are set from. */
export const LABEL_FONT_FAMILY = `${LABEL_FONT_NAME}, sans-serif`;

/**
 * Shentox's ascender and descender together are about 1.2 em, so a collision
 * box at the font size alone would clip a descender out of the test and let two
 * names touch.
 */
export const LABEL_LINE_HEIGHT_RATIO = 1.15;

/** The collision box's height, and the minimum lift above a mark. */
export function labelLineHeight(tier: LabelTier): number {
  return Math.round(LABEL_TIER_STYLE[tier].fontSize * LABEL_LINE_HEIGHT_RATIO);
}

/**
 * The CSS font shorthand, in the order a canvas 2d context parses it. The
 * measurer and the element are set from this one function, so they cannot
 * drift.
 */
export function labelFontString(tier: LabelTier): string {
  const style = LABEL_TIER_STYLE[tier];
  return `${style.fontWeight} ${style.fontSize}px ${LABEL_FONT_FAMILY}`;
}

/** What is actually drawn — and therefore what is actually measured. */
export function labelText(tier: LabelTier, name: string): string {
  return LABEL_TIER_STYLE[tier].uppercase ? name.toUpperCase() : name;
}
