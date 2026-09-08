/**
 * Path to the region map image. Images are generated with `yarn workspace backend
 * render:region-maps` and stored in the repository; they are manually regenerated
 * after an SDE update.
 */
export const regionMapUrl = (regionId: number): string =>
  `/images/regions/${regionId}.svg`;
