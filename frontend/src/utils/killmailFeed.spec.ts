import { describe, expect, it } from 'vitest';
import { bufferRealtimeKillmail, mergeRealtimeKillmails } from './killmailFeed';

const km = (id: string) => ({ id });
const ids = (list: { id: string }[]) => list.map((k) => k.id);

describe('mergeRealtimeKillmails', () => {
  it('puts the buffered killmails in front of the fetched page', () => {
    const merged = mergeRealtimeKillmails([km('c'), km('b')], [km('a')], 25);
    expect(ids(merged)).toEqual(['c', 'b', 'a']);
  });

  it('drops a buffered killmail the query has caught up with', () => {
    const merged = mergeRealtimeKillmails(
      [km('c'), km('b')],
      [km('b'), km('a')],
      25,
    );
    expect(ids(merged)).toEqual(['c', 'b', 'a']);
  });

  it('keeps the fetched copy, not the buffered one', () => {
    const buffered = [{ id: 'b', from: 'subscription' }];
    const fetched = [{ id: 'b', from: 'query' }];

    expect(mergeRealtimeKillmails(buffered, fetched, 25)).toEqual([
      { id: 'b', from: 'query' },
    ]);
  });

  it('caps the merged list at the page size', () => {
    const merged = mergeRealtimeKillmails(
      [km('e'), km('d')],
      [km('c'), km('b'), km('a')],
      3,
    );
    expect(ids(merged)).toEqual(['e', 'd', 'c']);
  });

  it('never renders the same id twice, however the two lists overlap', () => {
    const merged = mergeRealtimeKillmails(
      [km('d'), km('c'), km('b')],
      [km('c'), km('b'), km('a')],
      25,
    );
    expect(ids(merged)).toEqual(['d', 'c', 'b', 'a']);
    expect(new Set(ids(merged)).size).toBe(merged.length);
  });

  it('treats a limit of zero as no cap', () => {
    const merged = mergeRealtimeKillmails([km('b')], [km('a')], 0);
    expect(ids(merged)).toEqual(['b', 'a']);
  });

  it('handles an empty buffer and an empty page', () => {
    expect(mergeRealtimeKillmails([], [], 25)).toEqual([]);
    expect(ids(mergeRealtimeKillmails([], [km('a')], 25))).toEqual(['a']);
    expect(ids(mergeRealtimeKillmails([km('a')], [], 25))).toEqual(['a']);
  });
});

describe('bufferRealtimeKillmail', () => {
  it('adds the killmail at the front', () => {
    expect(ids(bufferRealtimeKillmail([km('b')], km('c'), 25))).toEqual([
      'c',
      'b',
    ]);
  });

  it('ignores one it already holds, returning the same array', () => {
    const buffered = [km('c'), km('b')];
    expect(bufferRealtimeKillmail(buffered, km('c'), 25)).toBe(buffered);
  });

  it('drops the oldest once the buffer is full', () => {
    const buffered = [km('c'), km('b'), km('a')];
    expect(ids(bufferRealtimeKillmail(buffered, km('d'), 3))).toEqual([
      'd',
      'c',
      'b',
    ]);
  });

  it('stays bounded across a long run of arrivals', () => {
    let buffered: { id: string }[] = [];
    for (let i = 0; i < 5000; i++) {
      buffered = bufferRealtimeKillmail(buffered, km(`k${i}`), 25);
    }
    expect(buffered).toHaveLength(25);
    expect(buffered[0].id).toBe('k4999');
  });
});
