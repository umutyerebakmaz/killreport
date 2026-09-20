import { MapOwnerKind } from '@/generated/graphql';
import {
  assignFrames,
  atlasSize,
  cellRect,
  DEFAULT_EMBLEM_OWNER_ID,
  logoUrl,
  sameBytes,
  type LogoOwner,
} from '@/utils/map/sovLogos';
import { Rectangle, Texture } from 'pixi.js';

export interface LogoAtlas {
  textureByOwner: Map<number, Texture>;
  /** Owners drawn with the shared default emblem; they keep their tint. */
  tintedOwners: Set<number>;
  destroy(): void;
}

async function fetchBytes(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url);
    return response.ok ? await response.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/**
 * Every owner's logo on one texture, built once per session.
 *
 * One base texture and one draw call is what keeps `buildSystems`'s batching:
 * 5,241 sprites sharing a texture are one batch, and 80 textures would be 80.
 *
 * "This alliance has no logo" cannot be read off the HTTP status — the server
 * answers 200 with EVE's default alliance emblem — so the default is fetched
 * once and every response is compared to it byte for byte. The 22 owners that
 * match share a single cell, and their sprites keep their colour so that one
 * emblem can still stand for 22 different alliances.
 *
 * Returns null when nothing could be drawn at all, which the caller reads as
 * "stay on dots".
 */
export async function buildLogoAtlas(
  owners: LogoOwner[],
): Promise<LogoAtlas | null> {
  const fallbackBytes = await fetchBytes(
    logoUrl({
      ownerId: DEFAULT_EMBLEM_OWNER_ID,
      kind: MapOwnerKind.Alliance,
    }),
  );

  const downloads = await Promise.all(
    owners.map(async (owner) => ({
      owner,
      bytes: await fetchBytes(logoUrl(owner)),
    })),
  );

  const bytesByOwner = new Map<number, ArrayBuffer>();
  const missing = new Set<number>();
  for (const { owner, bytes } of downloads) {
    if (!bytes) {
      missing.add(owner.ownerId);
      continue;
    }
    // A failed default download leaves nothing to compare against, so every
    // logo is taken at face value: the 22 then draw the emblem untinted,
    // which is the wrong reading but never a blank map.
    if (fallbackBytes && sameBytes(bytes, fallbackBytes)) {
      missing.add(owner.ownerId);
      continue;
    }
    bytesByOwner.set(owner.ownerId, bytes);
  }

  const layout = assignFrames(owners, (id) => bytesByOwner.has(id));
  if (layout.cellCount === 0) return null;

  const size = atlasSize(layout.cellCount);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) return null;

  async function draw(cell: number, bytes: ArrayBuffer): Promise<void> {
    const bitmap = await createImageBitmap(new Blob([bytes]));
    const rect = cellRect(cell);
    context!.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height);
    bitmap.close();
  }

  const drawings: Promise<void>[] = [];
  for (const [ownerId, bytes] of bytesByOwner) {
    drawings.push(draw(layout.cellByOwner.get(ownerId)!, bytes));
  }
  if (layout.fallbackCell >= 0 && fallbackBytes) {
    drawings.push(draw(layout.fallbackCell, fallbackBytes));
  }
  await Promise.all(drawings);

  const base = Texture.from(canvas);
  const textureByOwner = new Map<number, Texture>();
  const frames = new Map<number, Texture>();

  for (const [ownerId, cell] of layout.cellByOwner) {
    // One Texture per CELL, not per owner: the 22 that share the default
    // emblem share its frame too, so Pixi holds one object for all of them.
    let frame = frames.get(cell);
    if (!frame) {
      const rect = cellRect(cell);
      frame = new Texture({
        source: base.source,
        frame: new Rectangle(rect.x, rect.y, rect.width, rect.height),
      });
      frames.set(cell, frame);
    }
    textureByOwner.set(ownerId, frame);
  }

  return {
    textureByOwner,
    tintedOwners: missing,
    destroy: () => {
      for (const frame of frames.values()) frame.destroy();
      base.destroy(true);
    },
  };
}
