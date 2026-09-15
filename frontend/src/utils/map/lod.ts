/**
 * Where each thing appears, as absolute zooms.
 *
 * deck.gl's orthographic zoom is logarithmic and the unit is metres, so
 * `pixels = metres * 2 ** zoom`. Every threshold below is a measured distance
 * reaching a pixel count, which makes it a property of the zoom alone — not of
 * the canvas. The design's first draft expressed them as offsets from the
 * galaxy fit; that was wrong, because the fit moves with the viewport. On
 * 1400x900 the interior threshold is fit + 13.86 and on 2560x1440 it is
 * fit + 13.18, so a single offset would open the interiors with the discs at
 * 59 px on one screen and 100 px on the other.
 */

/** Discs start growing toward their true radius. */
export const APPROACH_ZOOM = -40;

/** The median system diameter (2 x 3.8809e12 m) reaches 100 px. Interiors stream. */
export const INTERIOR_ZOOM = -36.18;

/** The median moon separation (9.5389e8 m) reaches 10 px. Moons and belts appear. */
export const FINE_ZOOM = -26.51;

/**
 * Two levels past FINE_ZOOM, where median moons sit 40 px apart rather than
 * barely-separable 10. The float32 budget is still 0.076 px there, because the
 * origin is the focused system's centre by this depth.
 */
export const MAX_ZOOM = FINE_ZOOM + 2;

export type LodBucket = 'galaxy' | 'approach' | 'interior' | 'fine';

/**
 * A discrete bucket rather than the raw zoom: layer props then change at a
 * bucket boundary instead of on every wheel tick, which is what keeps the
 * layer array memoisable.
 */
export function lodBucket(zoom: number): LodBucket {
  if (zoom >= FINE_ZOOM) return 'fine';
  if (zoom >= INTERIOR_ZOOM) return 'interior';
  if (zoom >= APPROACH_ZOOM) return 'approach';
  return 'galaxy';
}

/** Whether the focused system's interior should be fetched and drawn. */
export function streamsInteriors(bucket: LodBucket): boolean {
  return bucket === 'interior' || bucket === 'fine';
}

/** Whether moons and belts are drawn. 344,457 moons exist; none is built below this. */
export function showsMoonsAndBelts(bucket: LodBucket): boolean {
  return bucket === 'fine';
}

/**
 * Which containers exist on screen for a bucket. A pure function rather than a
 * branch inside the scene, so the one decision that governs what is drawn can
 * be read and tested without a canvas.
 */
export interface LayerVisibility {
  edgesGalaxy: boolean;
  /**
   * The hovered region's own mesh, drawn over the galaxy one. It follows
   * `edgesGalaxy` exactly: region names stay on screen well past the zoom
   * where the galaxy mesh gives way to the local one, and a highlight of a
   * mesh that is no longer drawn would be lit lines over nothing.
   */
  edgesHighlight: boolean;
  edgesLocal: boolean;
  systems: boolean;
  celestials: boolean;
  fine: boolean;
}

export function layerVisibility(bucket: LodBucket): LayerVisibility {
  const interiors = streamsInteriors(bucket);
  return {
    edgesGalaxy: !interiors,
    edgesHighlight: !interiors,
    edgesLocal: interiors,
    systems: true,
    celestials: interiors,
    fine: showsMoonsAndBelts(bucket),
  };
}

/**
 * Label thresholds, measured 2026-09-14 against the production database.
 *
 * Each is the zoom at which that tier's median nearest-neighbour distance
 * reaches 60 px — the separation a name needs to read. The distances are
 * 7.4114e16 m between regions, 1.3129e16 between constellations and 3.4944e15
 * between systems, which puts the three about two levels apart without anyone
 * choosing that.
 *
 * All three sit inside the galaxy bucket, which is why label visibility is
 * derived from the zoom directly instead of from a LodBucket.
 *
 * The 60 px is a judgement, not a measurement: the distances were measured, the
 * readable separation was chosen. It is one constant, and it is meant to be
 * tuned by looking.
 */
export const REGION_LABEL_ZOOM = -50.13;
export const CONSTELLATION_LABEL_ZOOM = -47.64;
export const SYSTEM_LABEL_ZOOM = -45.73;

export type LabelTier = 'region' | 'constellation' | 'system';

/**
 * Which tiers are on screen, coarsest first.
 *
 * Tiers accumulate: opening one does not close the one beneath it. A map keeps
 * the country name while showing cities, and the viewport clip does most of the
 * thinning on its own — by the constellation threshold the screen covers a small
 * enough area that only one or two region centroids remain inside it.
 *
 * The order is also the collision priority. The coarsest tier is placed first,
 * so what gets sacrificed in a crowd is always the finest.
 */
export function visibleLabelTiers(zoom: number): LabelTier[] {
  const tiers: LabelTier[] = [];
  if (zoom >= REGION_LABEL_ZOOM) tiers.push('region');
  if (zoom >= CONSTELLATION_LABEL_ZOOM) tiers.push('constellation');
  if (zoom >= SYSTEM_LABEL_ZOOM) tiers.push('system');
  return tiers;
}
