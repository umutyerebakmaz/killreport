import { describe, expect, it } from 'vitest';

import { hourSnapshotTime, mergeSystemActivity } from './system-activity';

describe('hourSnapshotTime', () => {
  it('floors to the hour', () => {
    const at = hourSnapshotTime(new Date('2026-09-14T08:49:33.412Z'));
    expect(at.toISOString()).toBe('2026-09-14T08:00:00.000Z');
  });

  it('leaves an exact hour alone', () => {
    const at = hourSnapshotTime(new Date('2026-09-14T08:00:00.000Z'));
    expect(at.toISOString()).toBe('2026-09-14T08:00:00.000Z');
  });

  it('does not mutate its argument', () => {
    const given = new Date('2026-09-14T08:49:33.412Z');
    hourSnapshotTime(given);
    expect(given.toISOString()).toBe('2026-09-14T08:49:33.412Z');
  });
});

describe('mergeSystemActivity', () => {
  const at = new Date('2026-09-14T08:00:00.000Z');

  it('merges a system that both endpoints report', () => {
    const rows = mergeSystemActivity(
      [{ system_id: 30000142, npc_kills: 158, pod_kills: 3, ship_kills: 12 }],
      [{ system_id: 30000142, ship_jumps: 1337 }],
      at,
    );

    expect(rows).toEqual([
      {
        system_id: 30000142,
        npc_kills: 158,
        pod_kills: 3,
        ship_kills: 12,
        ship_jumps: 1337,
        timestamp: at,
      },
    ]);
  });

  it('gives a kills-only system zero kills counts and a null jump count', () => {
    // The two endpoints return different sets of systems: one lists systems
    // with kills, the other systems with jumps. A zero would claim the system
    // was reported as quiet; null says it was not reported at all.
    const [row] = mergeSystemActivity(
      [{ system_id: 30002187, npc_kills: 245, pod_kills: 1, ship_kills: 5 }],
      [],
      at,
    );

    expect(row.ship_jumps).toBeNull();
    expect(row.ship_kills).toBe(5);
  });

  it('gives a jumps-only system zero kills, because ESI reported none', () => {
    // Asymmetric on purpose. ESI's kill endpoint omits a system with no kills
    // in the hour, and the columns are NOT NULL with a zero default that
    // predates this worker — so zero is what the schema already means there.
    const [row] = mergeSystemActivity(
      [],
      [{ system_id: 30000870, ship_jumps: 18 }],
      at,
    );

    expect(row).toEqual({
      system_id: 30000870,
      npc_kills: 0,
      pod_kills: 0,
      ship_kills: 0,
      ship_jumps: 18,
      timestamp: at,
    });
  });

  it('writes one row per system across both lists', () => {
    const rows = mergeSystemActivity(
      [
        { system_id: 1, npc_kills: 1, pod_kills: 0, ship_kills: 0 },
        { system_id: 2, npc_kills: 0, pod_kills: 2, ship_kills: 0 },
      ],
      [
        { system_id: 2, ship_jumps: 20 },
        { system_id: 3, ship_jumps: 30 },
      ],
      at,
    );

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.system_id).sort()).toEqual([1, 2, 3]);
  });

  it('keeps the kills order first, then the jumps-only systems', () => {
    // The unique key is (system_id, timestamp) and createMany takes the batch
    // as given, so the order is not load-bearing — but a stable one keeps the
    // worker's progress log readable against the ESI response.
    const rows = mergeSystemActivity(
      [{ system_id: 7, npc_kills: 0, pod_kills: 0, ship_kills: 1 }],
      [
        { system_id: 9, ship_jumps: 90 },
        { system_id: 7, ship_jumps: 70 },
      ],
      at,
    );

    expect(rows.map((row) => row.system_id)).toEqual([7, 9]);
  });

  it('returns nothing for two empty lists', () => {
    expect(mergeSystemActivity([], [], at)).toEqual([]);
  });

  it('takes the last row when an endpoint repeats a system', () => {
    // ESI has never done this; the merge is a Map, so define what it means
    // rather than leave it to insertion order by accident.
    const [row] = mergeSystemActivity(
      [
        { system_id: 5, npc_kills: 1, pod_kills: 1, ship_kills: 1 },
        { system_id: 5, npc_kills: 2, pod_kills: 2, ship_kills: 2 },
      ],
      [],
      at,
    );

    expect(row.ship_kills).toBe(2);
  });
});
