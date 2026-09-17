import {
  LABEL_FONT_NAME,
  LABEL_TIER_STYLE,
  labelFontString,
  labelText,
} from './labelStyle';
import type { LabelTier } from './lod';

/** What the measurer needs from a canvas 2d context, and nothing more. */
export type MeasureContext = {
  font: string;
  measureText: (text: string) => { width: number };
};

export type LabelMeasure = (tier: LabelTier, name: string) => number;

function browserContext(): MeasureContext | null {
  if (typeof document === 'undefined') return null;
  return document.createElement('canvas').getContext('2d');
}

/**
 * Exact label widths, memoised per tier.
 *
 * `measureText` rather than an element's `offsetWidth`: the collision filter
 * wants the width BEFORE the element exists, and reading a layout property per
 * label per frame is the thrash the pooled layer exists to avoid. It is
 * synchronous, kerned, and — once the font string matches — the same advance
 * the browser will draw.
 *
 * letterSpacing is added here rather than set on the context: `ctx.letterSpacing`
 * is not implemented everywhere, and CSS adds the spacing after every character
 * including the last, which is what the element will do.
 *
 * Null when there is no 2d context (an old browser, a canvas-less test
 * environment). The caller draws no labels at all in that case; there is
 * deliberately no estimated-width fallback, because that is the mean-glyph
 * guess this whole change removes.
 *
 * The cache is per measurer and keyed on the raw name, so a remount starts
 * clean. 6,354 names measured once is a few milliseconds.
 */
export function createLabelMeasurer(
  ctx?: MeasureContext | null,
): LabelMeasure | null {
  const context = ctx === undefined ? browserContext() : ctx;
  if (!context) return null;

  const cache: Record<LabelTier, Map<string, number>> = {
    region: new Map(),
    constellation: new Map(),
    system: new Map(),
  };

  return (tier, name) => {
    const memo = cache[tier];
    const hit = memo.get(name);
    if (hit !== undefined) return hit;

    const text = labelText(tier, name);
    context.font = labelFontString(tier);
    const width =
      context.measureText(text).width +
      LABEL_TIER_STYLE[tier].letterSpacing * text.length;

    memo.set(name, width);
    return width;
  };
}

/**
 * Waits for the real label face before anything is measured against it.
 *
 * It is a webfont, self-hosted and loaded asynchronously by `next/font` in
 * `app/layout.tsx`. Measuring before the face is ready measures the
 * `sans-serif` fallback, and every collision box for the session is then built
 * on the wrong advances. `document.fonts.ready` alone is not enough: it can resolve before
 * anything has ever requested the font. `load()` is what actually requests it,
 * one call per face this module is about to measure, taken from
 * `LABEL_TIER_STYLE` rather than a second hardcoded list.
 *
 * Defensive rather than throwing: jsdom's `document.fonts` is a partial
 * implementation and some environments have none at all. Either way the caller
 * gets to carry on, just possibly against whatever face is available yet.
 */
export async function whenLabelFontsReady(): Promise<void> {
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
  if (!fonts) return;

  // One request per tier, weight included: a request by size alone asks for
  // weight 400, which would let a 600 measurement run before SemiBold had been
  // fetched — the exact fallback this function exists to prevent.
  const faces = new Set(
    Object.values(LABEL_TIER_STYLE).map(
      (style) => `${style.fontWeight} ${style.fontSize}px ${LABEL_FONT_NAME}`,
    ),
  );

  try {
    await Promise.all([...faces].map((face) => fonts.load(face)));
    await fonts.ready;
  } catch {
    // A rejected load (a missing file, a blocked request) must not stop the map
    // from getting labels at all.
  }
}
