/**
 * Path to the constellation map image. Images are generated with `yarn workspace
 * backend render:maps` and stored in the repository; they are manually
 * regenerated after an SDE update.
 */
export const constellationMapUrl = (constellationId: number): string =>
  `/images/constellations/${constellationId}.svg`;
