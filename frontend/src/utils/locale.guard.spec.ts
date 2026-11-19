import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(__dirname, '..');

/**
 * A `toLocale*String` call with no locale formats with whatever locale the
 * machine has: the server renders `1,234`, a Turkish browser hydrates
 * `1.234`, and a spec that passes in CI fails on a tr-TR desktop. Every call
 * names `'en-US'`, the format EVE itself uses.
 */
const NO_LOCALE =
  /toLocale(?:Date|Time)?String\(\s*(?:\)|undefined\b)|Intl\.(?:NumberFormat|DateTimeFormat)\(\s*(?:\)|undefined\b)/g;

/** `file:line` for every call in non-spec, non-generated source with no locale. */
function callsWithoutLocale(): string[] {
  return (fs.readdirSync(SRC, { recursive: true }) as string[])
    .map((file) => file.split(path.sep).join('/'))
    .filter(
      (file) =>
        /\.tsx?$/.test(file) &&
        !/\.(spec|test)\.tsx?$/.test(file) &&
        !file.startsWith('generated/'),
    )
    .flatMap((file) =>
      fs
        .readFileSync(path.join(SRC, file), 'utf8')
        .split('\n')
        .flatMap((line, i) =>
          line.match(NO_LOCALE) ? [`${file}:${i + 1}`] : [],
        ),
    )
    .sort();
}

describe('locale guard', () => {
  it('every toLocale*String and Intl formatter names a locale', () =>
    expect(callsWithoutLocale()).toEqual([]));
});
