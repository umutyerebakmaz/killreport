import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaClient } from '../../generated/prisma/client';
import {
  buildSovereigntyAlert,
  type SovereigntyAlertEvent,
} from './alert-builder';

/**
 * The alert is hydrated once, in the worker, and the subscription resolver
 * only passes it on — so a name the builder fails to resolve is a name every
 * subscriber sees missing. These tests cover the lookups, the fallbacks each
 * one has when a row is absent, and the message text built from them.
 */

const findUnique = {
  solarSystem: vi.fn(),
  alliance: vi.fn(),
  constellation: vi.fn(),
  region: vi.fn(),
};

const client = {
  solarSystem: { findUnique: findUnique.solarSystem },
  alliance: { findUnique: findUnique.alliance },
  constellation: { findUnique: findUnique.constellation },
  region: { findUnique: findUnique.region },
} as unknown as PrismaClient;

const JITA = 30000142;

/** Wire up the happy path: Jita, in The Forge, owned by an alliance. */
function resolveEverything() {
  findUnique.solarSystem.mockResolvedValue({
    name: 'Jita',
    constellation_id: 20000020,
  });
  findUnique.constellation.mockResolvedValue({ region_id: 10000002 });
  findUnique.region.mockResolvedValue({ name: 'The Forge' });
  findUnique.alliance.mockResolvedValue({
    name: 'Pandemic Horde',
    ticker: 'REKTD',
  });
}

const build = (event: SovereigntyAlertEvent) =>
  buildSovereigntyAlert(client, event);

beforeEach(() => {
  findUnique.solarSystem.mockResolvedValue(null);
  findUnique.alliance.mockResolvedValue(null);
  findUnique.constellation.mockResolvedValue(null);
  findUnique.region.mockResolvedValue(null);
});

describe('buildSovereigntyAlert', () => {
  describe('name resolution', () => {
    it('hydrates system, region and alliance names', async () => {
      resolveEverything();

      const alert = await build({
        type: 'campaign_started',
        systemId: JITA,
        defenderId: 498125261,
      });

      expect(alert).toMatchObject({
        type: 'campaign_started',
        solarSystemId: JITA,
        solarSystemName: 'Jita',
        regionName: 'The Forge',
        allianceId: 498125261,
        allianceName: 'Pandemic Horde',
        allianceTicker: 'REKTD',
      });
    });

    it('walks system → constellation → region for the region name', async () => {
      resolveEverything();

      await build({ type: 'campaign_started', systemId: JITA });

      expect(findUnique.solarSystem).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: JITA } }),
      );
      expect(findUnique.constellation).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 20000020 } }),
      );
      expect(findUnique.region).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 10000002 } }),
      );
    });

    it('skips the alliance lookup when the event names no alliance', async () => {
      resolveEverything();

      const alert = await build({ type: 'campaign_started', systemId: JITA });

      expect(findUnique.alliance).not.toHaveBeenCalled();
      expect(alert.allianceId).toBeNull();
      expect(alert.allianceName).toBeNull();
      expect(alert.allianceTicker).toBeNull();
    });

    it('skips the region walk when the system has no constellation', async () => {
      findUnique.solarSystem.mockResolvedValue({
        name: 'J111825',
        constellation_id: null,
      });

      const alert = await build({
        type: 'campaign_started',
        systemId: 31000123,
      });

      expect(findUnique.constellation).not.toHaveBeenCalled();
      expect(findUnique.region).not.toHaveBeenCalled();
      expect(alert.regionName).toBeNull();
    });

    it('leaves the region null when the constellation has no region', async () => {
      findUnique.solarSystem.mockResolvedValue({
        name: 'Jita',
        constellation_id: 20000020,
      });
      findUnique.constellation.mockResolvedValue({ region_id: null });

      const alert = await build({ type: 'campaign_started', systemId: JITA });

      expect(findUnique.region).not.toHaveBeenCalled();
      expect(alert.regionName).toBeNull();
    });

    it('leaves the region null when the region row is missing', async () => {
      findUnique.solarSystem.mockResolvedValue({
        name: 'Jita',
        constellation_id: 20000020,
      });
      findUnique.constellation.mockResolvedValue({ region_id: 10000002 });

      const alert = await build({ type: 'campaign_started', systemId: JITA });

      expect(alert.regionName).toBeNull();
    });

    it('reports an unresolved alliance as null rather than dropping the id', async () => {
      resolveEverything();
      findUnique.alliance.mockResolvedValue(null);

      const alert = await build({
        type: 'campaign_started',
        systemId: JITA,
        defenderId: 498125261,
      });

      expect(alert.allianceId).toBe(498125261);
      expect(alert.allianceName).toBeNull();
      expect(alert.allianceTicker).toBeNull();
    });

    it('falls back to the raw id in the message when the system is unknown', async () => {
      const alert = await build({ type: 'campaign_started', systemId: JITA });

      expect(alert.message).toBe(`New sovereignty campaign in #${JITA}`);
      expect(alert.solarSystemName).toBeNull();
      expect(alert.solarSystemId).toBe(JITA);
    });
  });

  describe('campaign_started', () => {
    it('names the system and region', async () => {
      resolveEverything();

      const alert = await build({ type: 'campaign_started', systemId: JITA });

      expect(alert.message).toBe(
        'New sovereignty campaign in Jita (The Forge)',
      );
      expect(alert.outcome).toBeNull();
      expect(alert.changeType).toBeNull();
    });

    it('drops the parenthesised region when there is none', async () => {
      findUnique.solarSystem.mockResolvedValue({
        name: 'Jita',
        constellation_id: null,
      });

      const alert = await build({ type: 'campaign_started', systemId: JITA });

      expect(alert.message).toBe('New sovereignty campaign in Jita');
    });

    it('takes the alliance from the defender', async () => {
      resolveEverything();

      const alert = await build({
        type: 'campaign_started',
        systemId: JITA,
        defenderId: 99005338,
      });

      expect(alert.allianceId).toBe(99005338);
    });
  });

  describe('campaign_ended', () => {
    it('appends the outcome', async () => {
      resolveEverything();

      const alert = await build({
        type: 'campaign_ended',
        systemId: JITA,
        outcome: 'defender_win',
      });

      expect(alert.message).toBe(
        'Campaign in Jita (The Forge) ended — defender_win',
      );
      expect(alert.outcome).toBe('defender_win');
    });

    it('says unresolved when no outcome was recorded', async () => {
      resolveEverything();

      const alert = await build({ type: 'campaign_ended', systemId: JITA });

      expect(alert.message).toBe(
        'Campaign in Jita (The Forge) ended — unresolved',
      );
      expect(alert.outcome).toBeNull();
    });

    it('takes the alliance from the defender', async () => {
      resolveEverything();

      const alert = await build({
        type: 'campaign_ended',
        systemId: JITA,
        defenderId: 99005338,
      });

      expect(alert.allianceId).toBe(99005338);
    });
  });

  describe('territory_change', () => {
    it('credits the new owner', async () => {
      resolveEverything();

      const alert = await build({
        type: 'territory_change',
        systemId: JITA,
        previousOwnerId: 1354830081,
        newOwnerId: 99005338,
        changeType: 'captured',
      });

      expect(alert.allianceId).toBe(99005338);
      expect(findUnique.alliance).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 99005338 } }),
      );
    });

    it('falls back to the previous owner when sovereignty was dropped', async () => {
      resolveEverything();

      const alert = await build({
        type: 'territory_change',
        systemId: JITA,
        previousOwnerId: 1354830081,
        newOwnerId: null,
        changeType: 'lost',
      });

      expect(alert.allianceId).toBe(1354830081);
    });

    it('names the change type and the region', async () => {
      resolveEverything();

      const alert = await build({
        type: 'territory_change',
        systemId: JITA,
        changeType: 'captured',
      });

      expect(alert.message).toBe('Jita sovereignty captured (The Forge)');
      expect(alert.changeType).toBe('captured');
      expect(alert.outcome).toBeNull();
    });

    it('says changed when the change type is missing', async () => {
      resolveEverything();

      const alert = await build({ type: 'territory_change', systemId: JITA });

      expect(alert.message).toBe('Jita sovereignty changed (The Forge)');
      expect(alert.changeType).toBeNull();
    });

    it('omits the region suffix when there is no region', async () => {
      findUnique.solarSystem.mockResolvedValue({
        name: 'Jita',
        constellation_id: null,
      });

      const alert = await build({
        type: 'territory_change',
        systemId: JITA,
        changeType: 'captured',
      });

      expect(alert.message).toBe('Jita sovereignty captured');
    });
  });

  it('stamps an ISO timestamp', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-04T08:00:00.000Z'));

    const alert = await build({ type: 'campaign_started', systemId: JITA });

    expect(alert.timestamp).toBe('2026-09-04T08:00:00.000Z');
    vi.useRealTimers();
  });
});
