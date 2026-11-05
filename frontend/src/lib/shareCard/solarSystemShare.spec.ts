import { describe, expect, it } from 'vitest';
import type { ShareSolarSystemQuery } from '@/generated/graphql';
import {
  solarSystemShareProps,
  solarSystemShareText,
  toShareSolarSystem,
} from './solarSystemShare';

const data = (
  over: Partial<ShareSolarSystemQuery> = {},
): ShareSolarSystemQuery => ({
  solarSystem: {
    name: 'Amamake',
    securityStatus: 0.4,
    star: { typeId: 45041 },
    constellation: { name: 'Hed', region: { id: 10000030, name: 'Heimatar' } },
  },
  solarSystemStats: { kills24h: 119 },
  systemActivityHistory: [{ npc_kills: 20 }, { npc_kills: 29 }],
  ...over,
});

describe('solarSystemShareText', () => {
  it('describes Amamake', () => {
    const s = toShareSolarSystem(data());
    expect(s).not.toBeNull();
    expect(solarSystemShareText(s!)).toEqual({
      title: 'Amamake',
      description: '0.4, Hed, Heimatar. 119 kills in the last 24 hours',
    });
  });
});

describe('toShareSolarSystem', () => {
  it('is null without data or a system', () => {
    expect(toShareSolarSystem(null)).toBeNull();
    expect(toShareSolarSystem(data({ solarSystem: null }))).toBeNull();
  });
});

describe('solarSystemShareProps', () => {
  it('sums the NPC kills of the last 24 hours', async () => {
    const p = await solarSystemShareProps(toShareSolarSystem(data())!);
    expect(p.npcKills).toBe('49');
    expect(p.kills).toBe('119');
    expect(p.secText).toBe('0.4');
    expect(p.systemName).toBe('Amamake');
  });

  it('counts zero NPC kills for an empty history', async () => {
    const p = await solarSystemShareProps(
      toShareSolarSystem(data({ systemActivityHistory: [] }))!,
    );
    expect(p.npcKills).toBe('0');
  });

  it('has no star image without a star', async () => {
    const base = data().solarSystem!;
    const p = await solarSystemShareProps(
      toShareSolarSystem(data({ solarSystem: { ...base, star: null } }))!,
    );
    expect(p.starImage).toBeNull();
  });

  it('has no region map when the file is missing', async () => {
    const base = data().solarSystem!;
    const p = await solarSystemShareProps(
      toShareSolarSystem(
        data({
          solarSystem: {
            ...base,
            constellation: { name: 'Hed', region: { id: -1, name: 'Nowhere' } },
          },
        }),
      )!,
    );
    expect(p.regionMap).toBeNull();
  });
});
