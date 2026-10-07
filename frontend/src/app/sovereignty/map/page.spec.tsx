import { describe, expect, it, vi } from 'vitest';

const redirect = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (url: string) => redirect(url),
}));

import SovereigntyMapPage from './page';

describe('/sovereignty/map', () => {
  // Old links and bookmarks keep working; the map they open is the one map.
  it('sends the reader to the universe map on its sovereignty layer', () => {
    SovereigntyMapPage();
    expect(redirect).toHaveBeenCalledWith('/map?layer=sovereignty');
  });
});
