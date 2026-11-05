// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fileDataUri } from './assets';

describe('fileDataUri', () => {
  it('encodes an existing svg as a data URI', async () => {
    const uri = await fileDataUri('/icons/t2.svg');
    expect(uri?.startsWith('data:image/svg+xml;base64,')).toBe(true);
  });

  it('returns null for a missing file', async () => {
    expect(await fileDataUri('/images/regions/1.svg')).toBeNull();
  });

  it('rejects paths that escape public/', async () => {
    expect(await fileDataUri('/../package.json')).toBeNull();
  });
});
