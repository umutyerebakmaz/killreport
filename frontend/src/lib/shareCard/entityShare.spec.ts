import { describe, expect, it } from 'vitest';
import {
  allianceShareProps,
  allianceShareText,
  characterShareProps,
  characterShareText,
  corporationShareProps,
  corporationShareText,
  type ShareAlliance,
  type ShareCharacter,
  type ShareCorporation,
} from './entityShare';

const character = (over: Partial<ShareCharacter> = {}): ShareCharacter => ({
  id: 365974960,
  name: 'General XAN',
  corporation: { id: 98814817, name: 'Clown Swords.' },
  alliance: { id: 99003581, name: 'Fraternity.' },
  kills: 252,
  losses: 58,
  ...over,
});

const corporation = (
  over: Partial<ShareCorporation> = {},
): ShareCorporation => ({
  id: 98814817,
  name: 'Clown Swords.',
  memberCount: 185,
  alliance: { id: 99003581, name: 'Fraternity.' },
  kills: 439,
  losses: 92,
  ...over,
});

const alliance = (over: Partial<ShareAlliance> = {}): ShareAlliance => ({
  id: 99003581,
  name: 'Fraternity.',
  memberCount: 54429,
  corporationCount: 228,
  sovCount: 329,
  kills: 11861,
  losses: 9593,
  ...over,
});

describe('characterShareText', () => {
  it('lists corporation and alliance', () => {
    expect(characterShareText(character())).toEqual({
      title: 'General XAN',
      description: 'Clown Swords., Fraternity. 252 kills, 58 losses',
    });
  });
  it('leaves out a missing alliance', () => {
    expect(characterShareText(character({ alliance: null })).description).toBe(
      'Clown Swords. 252 kills, 58 losses',
    );
  });
});

describe('corporationShareText', () => {
  it('starts with the alliance', () => {
    expect(corporationShareText(corporation())).toEqual({
      title: 'Clown Swords.',
      description: 'Fraternity. 185 members, 439 kills, 92 losses',
    });
  });
  it('leaves out a missing alliance', () => {
    expect(
      corporationShareText(corporation({ alliance: null })).description,
    ).toBe('185 members, 439 kills, 92 losses');
  });
});

describe('allianceShareText', () => {
  it('groups thousands', () => {
    expect(allianceShareText(alliance())).toEqual({
      title: 'Fraternity.',
      description: '54,429 members, 228 corporations, 329 sov systems',
    });
  });
});

describe('share props', () => {
  it('draws no bars without kills or losses', () => {
    expect(
      characterShareProps(character({ kills: 0, losses: 0 })).bars,
    ).toBeNull();
    expect(
      corporationShareProps(corporation({ kills: 0, losses: 0 })).bars,
    ).toBeNull();
    expect(
      allianceShareProps(alliance({ kills: 0, losses: 0 })).bars,
    ).toBeNull();
  });
  it('formats the numbers', () => {
    const p = allianceShareProps(alliance());
    expect(p.members).toBe('54,429');
    expect(p.kills).toBe('11,861');
    expect(p.bars).toEqual({ kills: 11861, losses: 9593 });
  });
  it('lists only the alliance on a corporation card', () => {
    expect(corporationShareProps(corporation()).memberships).toHaveLength(1);
    expect(
      corporationShareProps(corporation({ alliance: null })).memberships,
    ).toEqual([]);
  });
});
