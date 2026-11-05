import { readFile } from 'node:fs/promises';
import path from 'node:path';

const MIME: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

/** Reads a file under `public/` as a data URI, or null if it is missing. */
export async function fileDataUri(publicPath: string): Promise<string | null> {
  if (publicPath.includes('..')) return null;
  const mime = MIME[path.extname(publicPath).toLowerCase()];
  if (!mime) return null;
  try {
    const buf = await readFile(path.join(process.cwd(), 'public', publicPath));
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}
