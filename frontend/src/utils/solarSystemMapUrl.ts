/**
 * Path to the solar system map image. Images are generated with `yarn workspace
 * backend render:maps` and stored in the repository; they are manually
 * regenerated after an SDE update.
 */
export const solarSystemMapUrl = (systemId: number): string =>
  `/images/solar-systems/${systemId}.svg`;
