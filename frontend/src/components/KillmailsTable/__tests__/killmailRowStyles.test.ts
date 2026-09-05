import { describe, expect, it } from 'vitest';
import { getKillmailRowStyles } from '../killmailRowStyles';
import { Killmail } from '../types';

/**
 * The function is a pure mapping from "is this entity the victim or an
 * attacker?" to a set of classes, so the tests assert the classes verbatim.
 * That is the point: these strings are the contract with the theme, and a
 * silent drift back to a raw palette is exactly what they exist to catch.
 */

const CHARACTER = 42;
const CORPORATION = 4200;
const ALLIANCE = 420000;

function killmail(overrides: Partial<Killmail> = {}): Killmail {
  return {
    id: 1,
    victim: {},
    attackers: [],
    ...overrides,
  } as Killmail;
}

describe('getKillmailRowStyles', () => {
  describe('uninvolved rows', () => {
    it('uses the theme surfaces when no entity is given', () => {
      expect(getKillmailRowStyles({ killmail: killmail() })).toEqual({
        totalValueColor: 'text-orange-400',
        rowBgColor: 'bg-surface',
        rowHoverColor: 'hover:bg-surface-inset',
      });
    });

    it('steps one shade lighter for the detail variant', () => {
      expect(
        getKillmailRowStyles({ killmail: killmail(), variant: 'detail' }),
      ).toEqual({
        totalValueColor: 'text-orange-400',
        rowBgColor: 'bg-surface-inset',
        rowHoverColor: 'hover:bg-gray-700',
      });
    });

    it('uses them again when the entity appears on neither side', () => {
      const km = killmail({
        victim: { character: { id: 7 } },
        attackers: [{ character: { id: 8 } }],
      } as Partial<Killmail>);

      expect(
        getKillmailRowStyles({ killmail: km, characterId: CHARACTER }),
      ).toEqual({
        totalValueColor: 'text-orange-400',
        rowBgColor: 'bg-surface',
        rowHoverColor: 'hover:bg-surface-inset',
      });
    });
  });

  describe('losses', () => {
    it('reads a character victim as a loss, at the lighter weight', () => {
      const km = killmail({
        victim: { character: { id: CHARACTER } },
      } as Partial<Killmail>);

      // variant only reaches the uninvolved branch; a loss ignores it
      expect(
        getKillmailRowStyles({
          killmail: km,
          characterId: CHARACTER,
          variant: 'detail',
        }),
      ).toEqual({
        totalValueColor: 'text-red-500',
        rowBgColor: 'bg-red-500/15',
        rowHoverColor: 'hover:bg-red-500/20',
      });
    });

    it('weights a corporation loss more heavily than a character one', () => {
      const km = killmail({
        victim: { corporation: { id: CORPORATION } },
      } as Partial<Killmail>);

      expect(
        getKillmailRowStyles({ killmail: km, corporationId: CORPORATION }),
      ).toEqual({
        totalValueColor: 'text-red-500',
        rowBgColor: 'bg-red-500/20',
        rowHoverColor: 'hover:bg-red-500/30',
      });
    });

    it('reads an alliance victim as a loss', () => {
      const km = killmail({
        victim: { alliance: { id: ALLIANCE } },
      } as Partial<Killmail>);

      expect(
        getKillmailRowStyles({ killmail: km, allianceId: ALLIANCE }),
      ).toEqual({
        totalValueColor: 'text-red-500',
        rowBgColor: 'bg-red-500/20',
        rowHoverColor: 'hover:bg-red-500/30',
      });
    });
  });

  describe('kills', () => {
    it('reads a character among the attackers as a kill', () => {
      const km = killmail({
        attackers: [{ character: { id: 9 } }, { character: { id: CHARACTER } }],
      } as Partial<Killmail>);

      expect(
        getKillmailRowStyles({ killmail: km, characterId: CHARACTER }),
      ).toEqual({
        totalValueColor: 'text-green-500',
        rowBgColor: 'bg-green-500/15',
        rowHoverColor: 'hover:bg-green-500/20',
      });
    });

    it('counts any attacker from the corporation', () => {
      const km = killmail({
        attackers: [{ corporation: { id: CORPORATION } }],
      } as Partial<Killmail>);

      expect(
        getKillmailRowStyles({ killmail: km, corporationId: CORPORATION }),
      ).toEqual({
        totalValueColor: 'text-green-500',
        rowBgColor: 'bg-green-500/20',
        rowHoverColor: 'hover:bg-green-500/30',
      });
    });
  });

  it('prefers the loss when the entity is on both sides of the same kill', () => {
    const km = killmail({
      victim: { character: { id: CHARACTER } },
      attackers: [{ character: { id: CHARACTER } }],
    } as Partial<Killmail>);

    expect(
      getKillmailRowStyles({ killmail: km, characterId: CHARACTER }),
    ).toMatchObject({ totalValueColor: 'text-red-500' });
  });
});
