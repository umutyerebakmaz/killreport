import { readFile } from 'node:fs/promises';
import path from 'node:path';

const MIME: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

/*
 * The two folders the cards read: tier icons and region maps. Each path is
 * joined from literals so the bundler traces only that folder. A path built
 * from the whole `publicPath` made Turbopack trace all of `public/` (9,400
 * files, most of them the 8,089 solar system maps) into every card route.
 */
function resolvePublicFile(publicPath: string): string | null {
  const name = path.basename(publicPath);
  if (publicPath === `/icons/${name}`) {
    return path.join(process.cwd(), 'public', 'icons', name);
  }
  if (publicPath === `/images/regions/${name}`) {
    return path.join(process.cwd(), 'public', 'images', 'regions', name);
  }
  return null;
}

/**
 * Reads a tier icon or a region map under `public/` as a data URI, or null if
 * it is missing or lives anywhere else.
 */
export async function fileDataUri(publicPath: string): Promise<string | null> {
  const file = resolvePublicFile(publicPath);
  if (!file) return null;
  const mime = MIME[path.extname(file).toLowerCase()];
  if (!mime) return null;
  try {
    const buf = await readFile(file);
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}
