/**
 * Bölge harita görselinin yolu. Görseller `yarn workspace backend
 * render:region-maps` ile üretilip repoda tutuluyor; SDE güncellemesinden
 * sonra elle yeniden üretilirler.
 */
export const regionMapUrl = (regionId: number): string =>
  `/images/regions/${regionId}.svg`;
