import { describe, expect, it } from 'vitest';

import { buildSyncMessage } from './killmail-sync-message';

describe('buildSyncMessage', () => {
  it('names a user and nothing else', () => {
    const message = buildSyncMessage(7);

    expect(Object.keys(message).sort()).toEqual(['queuedAt', 'userId']);
    expect(message.userId).toBe(7);
    expect(Date.parse(message.queuedAt)).not.toBeNaN();
  });

  it('carries fullSync only when a full resync was asked for', () => {
    expect(buildSyncMessage(7, true).fullSync).toBe(true);
    expect('fullSync' in buildSyncMessage(7, false)).toBe(false);
  });

  // The regression this whole change exists to prevent: a credential must
  // never reach the broker again, where it would be written to disk once per
  // publish and kept in killreport.parking indefinitely.
  it('serialises without anything token-shaped', () => {
    const wire = JSON.stringify(buildSyncMessage(7, true)).toLowerCase();

    expect(wire).not.toContain('token');
    expect(wire).not.toContain('expires');
  });
});
