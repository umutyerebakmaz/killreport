/**
 * Every image URL this app asks the EVE image server for.
 *
 * Pure, and deliberately free of the item shapes the callers hold: a
 * blueprint is passed in as a boolean rather than as an `itemType` to poke
 * at, so this file needs no `any` and can be tested without React.
 */

export type EveImageKind =
  | 'ship' // /types/{id}/render, or /icon once the render has 404'd
  | 'type' // /types/{id}/icon — /bp or /bpc for a blueprint
  | 'character' // /characters/{id}/portrait
  | 'corporation' // /corporations/{id}/logo
  | 'alliance'; // /alliances/{id}/logo

/** The server answers 400 to anything that is not a power of two, and serves
 *  up to 1024: a ship render at size=1024 comes back as a 1024x1024 JPEG,
 *  size=2048 as a 400. Verified 2026-10-01. Only the 800px fit screen hull
 *  is drawn large enough to reach the top. */
const MIN_FETCH = 32;
const MAX_FETCH = 1024;

/**
 * The size to request for an image drawn at `size` CSS pixels: twice it, for
 * a high-density display, rounded up to a power of two and clamped to what
 * the server serves. The doubling lives here so that no call site repeats it.
 */
export const fetchSize = (size: number): number => {
  const wanted = 2 ** Math.ceil(Math.log2(Math.max(1, size) * 2));
  return Math.min(MAX_FETCH, Math.max(MIN_FETCH, wanted));
};

export interface EveImageUrlArgs {
  kind: EveImageKind;
  id: number;
  /** The drawn size in CSS pixels, square. The fetch size is derived. */
  size: number;
  /** `type` only: 2 is a blueprint copy, anything else an original. */
  singleton?: number;
  /** `type` only: the caller's `isBlueprint(itemType)`. */
  blueprint?: boolean;
  /** `ship` only: ask for the icon rather than the render. */
  icon?: boolean;
}

export const eveImageUrl = ({
  kind,
  id,
  size,
  singleton = 1,
  blueprint = false,
  icon = false,
}: EveImageUrlArgs): string => {
  const s = fetchSize(size);

  switch (kind) {
    case 'ship':
      return `https://images.evetech.net/types/${id}/${icon ? 'icon' : 'render'}?size=${s}`;
    case 'type':
      if (blueprint) {
        return `https://images.evetech.net/types/${id}/${singleton === 2 ? 'bpc' : 'bp'}?size=${s}`;
      }
      return `https://images.evetech.net/types/${id}/icon?size=${s}`;
    case 'character':
      return `https://images.evetech.net/characters/${id}/portrait?size=${s}`;
    case 'corporation':
      return `https://images.evetech.net/corporations/${id}/logo?size=${s}`;
    case 'alliance':
      return `https://images.evetech.net/alliances/${id}/logo?size=${s}`;
  }
};
