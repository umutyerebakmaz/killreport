import {
  LABEL_FONT_FAMILY,
  LABEL_TIER_STYLE,
  labelLineHeight,
  labelText,
} from '@/utils/map/labelStyle';
import type { LabelCandidate } from '@/utils/map/labels';

export interface LabelLayer {
  /** The absolutely positioned overlay, a sibling of the Pixi canvas. */
  root: HTMLDivElement;
  /** Keyed on `LabelCandidate.key`; a key's text never changes. */
  /**
   * Keyed `tier:id`, and never evicted: a name that leaves the viewport keeps
   * its element so that coming back is a class change rather than a rebuild.
   * The ceiling is one span per name ever shown — about 5,241 systems plus the
   * regions and constellations after a full tour of the galaxy — all of them
   * `visibility: hidden` and so never painted. Eviction would buy back memory
   * nobody is short of and cost the re-entry it exists to make free.
   */
  pool: Map<string, HTMLSpanElement>;
}

export function createLabelLayer(host: HTMLElement): LabelLayer {
  const root = document.createElement('div');
  root.className = 'map-labels';
  host.appendChild(root);
  return { root, pool: new Map() };
}

/**
 * Writes the placed labels into the overlay, reusing the elements.
 *
 * This runs on EVERY camera change — every pointermove of a drag — so it is a
 * pool, not a rebuild. Creating up to 300 elements per pointer tick would mean
 * 300 insertions and 300 style recalculations a frame; reusing them means one
 * `transform` write each, which the compositor can take without a layout.
 *
 * The transform is the only per-frame write for that reason: `left`/`top` would
 * invalidate layout, and `translate(-50%, -50%)` centres the text on its anchor
 * without the layer ever needing to know how wide it is.
 *
 * No rounding to whole pixels. DOM text is laid out by the browser with subpixel
 * positioning — unlike the bitmap atlas this replaces, whose glyph quads
 * resampled across two texels on a fractional coordinate; rounding here would
 * only make a pan visibly step.
 *
 * Entries that fall out of the placed set lose `is-visible` rather than being
 * removed: they come back as soon as the camera moves again.
 */
export function drawLabels(layer: LabelLayer, placed: LabelCandidate[]): void {
  // Collected rather than shown as we go, because a name appended in this pass
  // has to have its before-change style resolved before it is told to fade in.
  // See the flush below.
  const showing: HTMLSpanElement[] = [];
  let appended = false;

  for (const candidate of placed) {
    let el = layer.pool.get(candidate.key);

    if (!el) {
      const style = LABEL_TIER_STYLE[candidate.tier];
      el = document.createElement('span');
      el.className = `map-label map-label--${candidate.tier}`;
      el.textContent = labelText(candidate.tier, candidate.name);
      // The metrics come from labelStyle, the same constants the measurer read,
      // so the collision box and the drawn text cannot disagree. map.css owns
      // everything else about how this looks.
      el.style.fontFamily = LABEL_FONT_FAMILY;
      el.style.fontSize = `${style.fontSize}px`;
      el.style.fontWeight = style.fontWeight;
      el.style.letterSpacing = `${style.letterSpacing}px`;
      // The line height too, and from the same function the collision box is
      // built with. Absolute positioning blockifies the span, so its height IS
      // its line box: leaving this to CSS is what let `map.css` restate the
      // metric as 1.0 against the measurer's 1.15, and a painted box 15%
      // shorter than the box the filter reserved is a disagreement no test can
      // see.
      el.style.lineHeight = `${labelLineHeight(candidate.tier)}px`;
      if (candidate.systemId !== undefined) {
        el.dataset.mapSystem = String(candidate.systemId);
      }
      // The same stamp at the two area tiers: useMapPointer reads whichever is
      // there to light that area's own mesh while the pointer rests on its
      // name.
      if (candidate.regionId !== undefined) {
        el.dataset.mapRegion = String(candidate.regionId);
      }
      if (candidate.constellationId !== undefined) {
        el.dataset.mapConstellation = String(candidate.constellationId);
      }
      layer.pool.set(candidate.key, el);
      layer.root.appendChild(el);
      appended = true;
    }

    el.style.transform = `translate(-50%, -50%) translate(${candidate.screenX}px, ${candidate.screenY}px)`;
    showing.push(el);
  }

  // A transition runs from a resolved before-change style, and an element
  // appended and given `is-visible` in one synchronous block never has one: the
  // browser sees a single style, so the 150 ms fade did not start and the name
  // popped. Because the pool is never evicted, each distinct name popped
  // exactly once and faded correctly forever after — which read as "the fade is
  // broken while I explore, and fine once I come back".
  //
  // One forced read covers the whole batch: a layout flush resolves the style
  // of every element appended above, so a frame that creates 300 names pays for
  // one layout rather than 300. Guarded, so the ordinary case — a pan that only
  // moves pooled elements — pays for nothing at all. A `requestAnimationFrame`
  // would do the same job a frame later, but it would also race the hide sweep
  // below: a name placed and then unplaced before the callback ran would be
  // revealed after being hidden.
  if (appended) layer.root.getBoundingClientRect();

  for (const el of showing) el.classList.add('is-visible');

  const shown = new Set(placed.map((candidate) => candidate.key));
  for (const [key, el] of layer.pool) {
    if (!shown.has(key)) el.classList.remove('is-visible');
  }
}

export function destroyLabelLayer(layer: LabelLayer): void {
  layer.root.remove();
  layer.pool.clear();
}
