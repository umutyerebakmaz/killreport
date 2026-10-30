import { TrackedEntityType } from '@/generated/graphql';
import { describe, expect, it } from 'vitest';
import {
  groupTrackDialogEntries,
  killmailTrackEntries,
} from './trackDialogEntries';

const n = (id: number, name = `n${id}`) => ({ id, name });
const km = (attackers: object[]) =>
  ({
    victim: { character: n(1), corporation: n(10), alliance: null },
    attackers,
  }) as unknown as Parameters<typeof killmailTrackEntries>[0];
const atk = (o: object) => ({
  damageDone: 0,
  finalBlow: false,
  character: null,
  corporation: null,
  alliance: null,
  ...o,
});

describe('killmailTrackEntries', () => {
  it('lists victim first and tags sections', () => {
    const e = killmailTrackEntries(km([atk({ character: n(2) })]));
    expect(e.map((x) => [x.id, x.section])).toEqual([
      [1, 'VICTIM'],
      [10, 'VICTIM'],
      [2, 'ATTACKERS'],
    ]);
  });
  it('skips null characters and corporations', () => {
    const e = killmailTrackEntries(
      km([atk({ corporation: n(20) }), atk({ character: n(3) })]),
    );
    expect(
      e.filter((x) => x.type === TrackedEntityType.Character).map((x) => x.id),
    ).toEqual([1, 3]);
    expect(
      e
        .filter((x) => x.type === TrackedEntityType.Corporation)
        .map((x) => x.id),
    ).toEqual([10, 20]);
  });
  it('assigns final blow and top damage roles', () => {
    const e = killmailTrackEntries(
      km([
        atk({ character: n(2), damageDone: 500 }),
        atk({ character: n(3), damageDone: 100, finalBlow: true }),
      ]),
    );
    expect(e.find((x) => x.id === 2)?.role).toBe('top damage');
    expect(e.find((x) => x.id === 3)?.role).toBe('final blow');
  });
  it('labels only the attacking pilot, not its corp or alliance', () => {
    const e = killmailTrackEntries(
      km([
        atk({
          character: n(2),
          corporation: n(20),
          alliance: n(30),
          damageDone: 500,
          finalBlow: true,
        }),
      ]),
    );
    expect(e.find((x) => x.id === 2)?.role).toBe('final blow');
    expect(e.find((x) => x.id === 20)?.role).toBeUndefined();
    expect(e.find((x) => x.id === 30)?.role).toBeUndefined();
  });
  it('prefers final blow when the same attacker has both', () => {
    const e = killmailTrackEntries(
      km([atk({ character: n(2), damageDone: 500, finalBlow: true })]),
    );
    expect(e.find((x) => x.id === 2)?.role).toBe('final blow');
  });
});

describe('groupTrackDialogEntries', () => {
  it('keeps the first (type,id) and the order', () => {
    const g = groupTrackDialogEntries(
      killmailTrackEntries(
        km([
          atk({ corporation: n(10) }),
          atk({ corporation: n(10) }),
          atk({ corporation: n(11) }),
        ]),
      ),
    );
    expect(g.CORPORATION.map((x) => [x.id, x.section])).toEqual([
      [10, 'VICTIM'],
      [11, 'ATTACKERS'],
    ]);
  });
});
