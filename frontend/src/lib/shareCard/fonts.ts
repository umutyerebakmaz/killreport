import type { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

type ImageResponseOptions = NonNullable<
  ConstructorParameters<typeof ImageResponse>[1]
>;

const FONT_DIR = path.join(process.cwd(), 'assets', 'fonts');

const FILES = [
  { file: 'RobotoCondensed-Regular.ttf', weight: 400 },
  { file: 'RobotoCondensed-Medium.ttf', weight: 500 },
  { file: 'RobotoCondensed-Bold.ttf', weight: 700 },
] as const;

const fontsPromise: Promise<NonNullable<ImageResponseOptions['fonts']>> =
  Promise.all(
    FILES.map(async ({ file, weight }) => ({
      name: 'RC',
      data: await readFile(path.join(FONT_DIR, file)),
      weight,
      style: 'normal' as const,
    })),
  );

/** Roboto Condensed 400/500/700 for ImageResponse, read once per process. */
export function loadShareCardFonts(): Promise<ImageResponseOptions['fonts']> {
  return fontsPromise;
}
