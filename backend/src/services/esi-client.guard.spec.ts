import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(__dirname, '..');

/** Every non-spec, non-generated .ts file under backend/src containing `needle`. */
function filesContaining(needle: string): string[] {
  return (fs.readdirSync(SRC, { recursive: true }) as string[])
    .map((file) => file.split(path.sep).join('/'))
    .filter(
      (file) =>
        file.endsWith('.ts') &&
        !file.endsWith('.spec.ts') &&
        !file.startsWith('generated/') &&
        !path.posix.basename(file).startsWith('generated-'),
    )
    .filter((file) =>
      fs.readFileSync(path.join(SRC, file), 'utf8').includes(needle),
    )
    .sort();
}

describe('esi client guard', () => {
  it('only esi-client.ts names esi.evetech.net', () =>
    expect(filesContaining('esi.evetech.net')).toEqual([
      'services/esi-client.ts',
    ]));

  it('nothing calls esiRateLimiter.execute', () =>
    expect(filesContaining('esiRateLimiter.execute')).toEqual([]));
});
