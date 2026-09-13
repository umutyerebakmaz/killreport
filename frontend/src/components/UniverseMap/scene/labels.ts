import { LABEL_LINE_HEIGHT, type LabelCandidate } from '@/utils/map/labels';
import type { LabelTier } from '@/utils/map/lod';
import { BitmapFont, BitmapFontManager, BitmapText } from 'pixi.js';
import type { MapScene } from './createScene';

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
 */
const TIER_STYLE: Record<
  LabelTier,
  { fontSize: number; letterSpacing: number; alpha: number; uppercase: boolean }
> = {
  region: { fontSize: 14, letterSpacing: 3, alpha: 0.45, uppercase: true },
  constellation: {
    fontSize: 12,
    letterSpacing: 1,
    alpha: 0.7,
    uppercase: false,
  },
  system: { fontSize: 11, letterSpacing: 0, alpha: 1, uppercase: false },
};

let installed = false;

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
export function installLabelFonts(): void {
  if (installed) return;

  for (const tier of ['region', 'constellation', 'system'] as const) {
    const style = TIER_STYLE[tier];
    BitmapFont.install({
      name: LABEL_FONT[tier],
      style: {
        fontFamily: 'Shentox, sans-serif',
        fontSize: style.fontSize,
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
      resolution: window.devicePixelRatio || 1,
      // Kerning metadata costs memory and install time and buys nothing at
      // label sizes.
      skipKerning: true,
      // Runtime tinting without a new atlas per colour. Phase 4's colour
      // registry will want this; enabling it now costs nothing.
      dynamicFill: true,
    });
  }

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
      pool.set(candidate.key, text);
      scene.labels.addChild(text);
    }

    // Nudged above the dot rather than centred on it, so the name does not sit
    // on the mark it belongs to.
    text.position.set(
      candidate.screenX,
      candidate.screenY - LABEL_LINE_HEIGHT[candidate.tier],
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
