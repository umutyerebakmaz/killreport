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

/** The server answers 400 to anything that is not a power of two, and 512 is
 *  the largest size this app draws. Verified 2026-09-17. */
const MIN_FETCH = 32;
const MAX_FETCH = 512;

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

/**
 * Temporary: the six call sites that still build their own <img> src. Task 5
 * replaces all of them with <EveImage> and deletes this along with them.
 *
 * `size` here is the fetch size the old getItemImageUrl took, so it is halved
 * back into a drawn size before `eveImageUrl` doubles it again — which keeps
 * every one of those six URLs byte for byte what it is today.
 */
export const legacyItemImageUrl = (
  itemType: { id?: number | null } | null | undefined,
  singleton: number = 1,
  size: number = 64,
  blueprint: boolean = false,
): string => {
  if (!itemType?.id) return '';
  return eveImageUrl({
    kind: 'type',
    id: itemType.id,
    size: size / 2,
    singleton,
    blueprint,
  });
};
