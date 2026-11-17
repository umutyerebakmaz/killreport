import { describe, expect, it } from 'vitest';

import { buildSyncMessage, isFullSync } from './killmail-sync-message';

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

describe('isFullSync', () => {
  // The incremental cursor is MAX(killmail_id) over killmail_filters, which
  // RedisQ fills with all of EVE. A user who has never synced usually has a
  // killmail there already, so an incremental first sync stops on it at the
  // top of page 1 and the history is never fetched.
  it('is full for a user who has never synced, even when not asked for', () => {
    expect(isFullSync(null, false)).toBe(true);
  });

  it('is incremental for a user who has synced before', () => {
    expect(isFullSync(new Date('2026-11-17T10:00:00Z'), false)).toBe(false);
  });

  it('is full whenever a full resync is asked for', () => {
    expect(isFullSync(new Date('2026-11-17T10:00:00Z'), true)).toBe(true);
  });
});
