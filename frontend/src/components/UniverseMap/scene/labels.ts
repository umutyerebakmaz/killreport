import { LABEL_TINT } from '@/utils/map/colors';
import type { LabelCandidate } from '@/utils/map/labels';
import type { LabelTier } from '@/utils/map/lod';
import {
  BitmapFont,
  BitmapFontManager,
  BitmapText,
  type TextStyleFontWeight,
} from 'pixi.js';
import { renderResolution, type MapScene } from './createScene';

export const LABEL_FONT: Record<LabelTier, string> = {
  region: 'MapLabelRegion',
  constellation: 'MapLabelConstellation',
  system: 'MapLabelSystem',
};

/**
 * Per-tier styling. The design fixes the ORDER, not these numbers: the
 * background tier must read larger, dimmer and more spaced than the foreground
 * one. The values themselves are meant to be tuned by looking.
 *
 * Region is uppercase and letter-spaced because that is what makes a name read
 * as a region rather than as a big system.
 *
 * The weight runs the other way to the size, and deliberately. A system name is
 * 8 px, where weight *is* legibility, so it stays at the 600 every entity name
 * on the site is set in (`.system-name` is `font-semibold`). The tiers above it
 * are large enough not to need it and lighten as they grow, which is how a map
 * sets an area name against a point name: airy over a region, solid on a dot.
 *
 * 16 / 12 / 8 rather than the 14 / 12 / 11 this shipped with: the old spread was
 * two pixels across three tiers and read as one size at a glance. A clean four
 * pixel step separates them, and taking the system tier down rather than the
 * others up is what buys room — it is the crowded tier, and a shorter name
 * clears its neighbours sooner. Size is
 * now the whole of the hierarchy — the alphas were 0.45 / 0.7 / 1 and the tints
 * were three greys, and both were tried and reverted for the same reason: over
 * the galaxy there is nothing behind a name, so anything that dims it makes it
 * unreadable rather than quiet.
 *
 * These numbers are coupled to the collision boxes: changing a fontSize or a
 * letterSpacing here means updating `LABEL_CHAR_WIDTH` and `LABEL_LINE_HEIGHT`
 * in `utils/map/labels.ts` to match, or the filter reserves the wrong space.
 */
const TIER_STYLE: Record<
  LabelTier,
  {
    fontSize: number;
    fontWeight: TextStyleFontWeight;
    letterSpacing: number;
    alpha: number;
    uppercase: boolean;
  }
> = {
  region: {
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 3,
    alpha: 1,
    uppercase: true,
  },
  constellation: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 1,
    alpha: 1,
    uppercase: false,
  },
  system: {
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0,
    alpha: 1,
    uppercase: false,
  },
};

let installed = false;

/**
 * Waits for the real Shentox face before anything rasterises against it.
 *
 * Shentox is a webfont, loaded asynchronously by `@font-face` in
 * `app/fonts.css`. `BitmapFont.install` rasterises synchronously, so calling
 * it before the face is ready bakes the `sans-serif` fallback into the atlas
 * — and because the atlas is cached globally under the font's name, the wrong
 * typeface then persists for the rest of the session. `document.fonts.ready`
 * alone is not enough: it can resolve before anything has ever requested the
 * font. `load()` is what actually requests it, one call per size this module
 * is about to rasterise, taken from `TIER_STYLE` rather than a second
 * hardcoded list.
 *
 * Defensive rather than throwing: jsdom's `document.fonts` is a partial
 * implementation, and some environments have none at all. Either way the
 * caller should still get an installed font, just possibly against whatever
 * face is available yet.
 */
async function ensureShentoxLoaded(): Promise<void> {
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
  if (!fonts) return;

  // One request per tier, weight included. `8px Shentox` asks for weight 400, so
  // requesting by size alone would let a 600 atlas rasterise before SemiBold had
  // been fetched — the exact fallback this function exists to prevent. The three
  // tiers are three different faces now, so all three have to be asked for.
  const faces = new Set(
    Object.values(TIER_STYLE).map(
      (style) => `${style.fontWeight} ${style.fontSize}px Shentox`,
    ),
  );

  try {
    await Promise.all([...faces].map((face) => fonts.load(face)));
    await fonts.ready;
  } catch {
    // A rejected load (a missing file, a blocked request) should not stop the
    // map from getting labels at all — it falls through to installing
    // against whatever font is currently resolved for 'Shentox'.
  }
}

/**
 * Three bitmap fonts, one per tier, generated once.
 *
 * BitmapText draws quads from a shared atlas; plain Text rasterises a texture
 * per unique string, and this map has 5,241 system names alone.
 *
 * A font per tier rather than one scaled three ways: the tiers differ by only a
 * few pixels, and scaling a 14 px atlas down to 11 px is visibly softer than
 * rasterising at 11. Three atlases of ASCII are small.
 */
export async function installLabelFonts(): Promise<void> {
  if (installed) return;

  await ensureShentoxLoaded();

  for (const tier of ['region', 'constellation', 'system'] as const) {
    const style = TIER_STYLE[tier];
    BitmapFont.install({
      name: LABEL_FONT[tier],
      style: {
        fontFamily: 'Shentox, sans-serif',
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        // White, because dynamicFill below needs it: it is what lets a tier be
        // tinted at runtime instead of costing another atlas.
        fill: 0xffffff,
        letterSpacing: style.letterSpacing,
      },
      // The preset rather than a hand-rolled range list. Task 8 Step 3 proves
      // every EVE name in this database is printable ASCII.
      chars: BitmapFontManager.ASCII,
      // Managed by the font, not the BitmapText — passing resolution to an
      // instance is ignored and logs a warning.
      //
      // The renderer's own resolution, not the raw ratio: an atlas rasterised
      // finer than the canvas it draws into is minified on every glyph, which is
      // the softness this whole change exists to remove.
      resolution: renderResolution(),
      // Kerning on. It was skipped as costing memory and install time for
      // nothing, which was asserted rather than measured and is wrong: without
      // it every pair sits at its raw advance, so `AV`, `To` and `Ya` stand
      // apart and a name takes more room than it should. That looseness is the
      // most visible difference between these labels and the same name set in
      // DOM text anywhere else on the site. The cost is one pass over the
      // character list at install time, three times per session.
      skipKerning: false,
      // Runtime tinting without a new atlas per colour. Phase 4's colour
      // registry will want this; enabling it now costs nothing.
      dynamicFill: true,
    });
  }

  // Set only after every install above has actually happened: a failed or
  // interrupted first attempt must not latch this true and skip the retry a
  // second call would otherwise make.
  installed = true;
}

/**
 * Writes the placed labels onto the stage, reusing the text objects.
 *
 * This runs on EVERY camera change — every pointermove of a drag — so it is a
 * pool, not a rebuild. PixiJS's own performance guidance rates destroy-and-
 * recreate on frequently respawned objects as a high-severity mistake: it
 * deallocates GPU resources, triggers GC and forces fresh uploads. Creating up
 * to 300 BitmapText objects per pointer tick would be exactly that.
 *
 * The pool is keyed on `LabelCandidate.key` (`tier:id`), and a key's text never
 * changes — a region is always called the same thing. So a reused entry only
 * has its position and visibility touched, which is the cheap path BitmapText
 * exists for.
 *
 * Entries that fall out of the placed set are hidden rather than destroyed:
 * they come back as soon as the camera moves again, and a hidden Container
 * costs nothing to skip.
 */
export function drawLabels(scene: MapScene, placed: LabelCandidate[]): void {
  const pool = poolFor(scene);

  for (const candidate of placed) {
    let text = pool.get(candidate.key);

    if (!text) {
      const style = TIER_STYLE[candidate.tier];
      text = new BitmapText({
        text: style.uppercase ? candidate.name.toUpperCase() : candidate.name,
        style: { fontFamily: LABEL_FONT[candidate.tier] },
      });
      text.anchor.set(0.5);
      text.alpha = style.alpha;
      text.tint = LABEL_TINT[candidate.tier];
      pool.set(candidate.key, text);
      scene.labels.addChild(text);
    }

    // The candidate's own coordinates, rounded to a whole CSS pixel. The lift
    // above the dot is already in them — labelCandidates applies it, so the
    // collision filter and the viewport clip see the box the glyphs actually
    // occupy.
    //
    // The rounding is what keeps the atlas sampling 1:1. A glyph quad landing on
    // a fractional coordinate is resampled across two texels whatever the
    // canvas resolution, and at label sizes that is the difference between type
    // and a smudge. Whole CSS pixels rather than device pixels, so the grid
    // holds at any integer resolution; the shift is at most half a pixel and the
    // collision boxes are built with padding far larger than that.
    text.position.set(
      Math.round(candidate.screenX),
      Math.round(candidate.screenY),
    );
    text.visible = true;
  }

  // Everything not placed this pass goes invisible. Iterating the pool rather
  // than diffing two sets: the pool is bounded by how many distinct labels have
  // ever been on screen, and hiding is one property write.
  const shown = new Set(placed.map((candidate) => candidate.key));
  for (const [key, text] of pool) {
    if (!shown.has(key)) text.visible = false;
  }
}

/**
 * One pool per scene, hung off the scene object rather than a module-level Map
 * so a second scene — or a remount — does not inherit the first one's text.
 */
const POOLS = new WeakMap<MapScene, Map<string, BitmapText>>();

function poolFor(scene: MapScene): Map<string, BitmapText> {
  let pool = POOLS.get(scene);
  if (!pool) {
    pool = new Map();
    POOLS.set(scene, pool);
  }
  return pool;
}
