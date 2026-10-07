import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let calls: { skip?: boolean }[] = [];
vi.mock('@/generated/graphql', () => ({
  useMapSovChangesQuery: (options: { skip?: boolean }) => {
    calls.push(options);
    return { data: undefined, loading: false };
  },
}));

import { useSovChanges } from './useSovChanges';

beforeEach(() => {
  calls = [];
});

describe('useSovChanges', () => {
  it('skips the query until the Changes tab is open', () => {
    renderHook(() => useSovChanges(false));
    expect(calls.at(-1)).toMatchObject({ skip: true });
  });

  it('runs the query once the tab is open', () => {
    renderHook(() => useSovChanges(true));
    expect(calls.at(-1)).toMatchObject({ skip: false });
  });
});
