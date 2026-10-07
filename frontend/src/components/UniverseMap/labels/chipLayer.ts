import { CHIP_HEIGHT_PX } from '@/utils/map/campaignMarks';
import type { ChipBox } from '@/utils/map/campaignMarks';
import { chipText, isLive, type ChipCampaign } from '@/utils/map/countdown';
import { LABEL_FONT_FAMILY, LABEL_TIER_STYLE } from '@/utils/map/labelStyle';

/**
 * The countdown chips, in an overlay of their own.
 *
 * Not the label layer: that pool writes a name once and promises its text
 * never changes, and a chip's changes every second. The technique is the same
 * — pooled elements, one `transform` write per camera change — so a pan costs
 * a chip what it costs a name.
 */
export interface ChipLayer {
  root: HTMLDivElement;
  /** Keyed on campaign id. Never evicted, like the label pool. */
  pool: Map<number, HTMLSpanElement>;
}

export function createChipLayer(host: HTMLElement): ChipLayer {
  const root = document.createElement('div');
  root.className = 'map-chips';
  host.appendChild(root);
  return { root, pool: new Map() };
}

/**
 * Positions the placed chips and hides the rest.
 *
 * `data-map-system` is what makes a chip clickable for free: useMapPointer
 * already selects whatever system a `[data-map-system]` element under the
 * pointer names, the way it does for a system's name.
 */
export function drawChips(layer: ChipLayer, placed: readonly ChipBox[]): void {
  const style = LABEL_TIER_STYLE.system;

  for (const box of placed) {
    let el = layer.pool.get(box.campaignId);
    if (!el) {
      el = document.createElement('span');
      el.className = 'map-chip';
      el.dataset.mapSystem = String(box.systemId);
      // The face and size the chip was measured in — the system tier's — so
      // the collision box and the drawn chip cannot disagree.
      el.style.fontFamily = LABEL_FONT_FAMILY;
      el.style.fontSize = `${style.fontSize}px`;
      el.style.fontWeight = style.fontWeight;
      el.style.height = `${CHIP_HEIGHT_PX}px`;
      layer.pool.set(box.campaignId, el);
      layer.root.appendChild(el);
    }
    el.style.transform = `translate(-50%, -50%) translate(${box.screenX}px, ${box.screenY}px)`;
    el.classList.add('is-visible');
  }

  const shown = new Set(placed.map((box) => box.campaignId));
  for (const [campaignId, el] of layer.pool) {
    if (!shown.has(campaignId)) el.classList.remove('is-visible');
  }
}

/**
 * Writes each chip's countdown. Called once a second; a text that has not
 * changed — every chip more than an hour out, 59 seconds a minute — is not
 * written, so the browser has nothing to lay out.
 */
export function writeChipText(
  layer: ChipLayer,
  campaigns: readonly ChipCampaign[],
  now: number,
): void {
  for (const campaign of campaigns) {
    const el = layer.pool.get(campaign.campaignId);
    if (!el) continue;

    const text = chipText(campaign, now);
    if (el.textContent !== text) el.textContent = text;

    const live = isLive(campaign, now);
    if (live && el.dataset.live === undefined) el.dataset.live = '';
    if (!live && el.dataset.live !== undefined) delete el.dataset.live;
  }
}

export function destroyChipLayer(layer: ChipLayer): void {
  layer.root.remove();
  layer.pool.clear();
}
