import { QueryResolvers } from '@generated-types';
import prisma from '@services/prisma';

/**
 * Sovereignty Query Resolvers
 *
 * Reads from the sovereignty foundation tables (populated by the
 * worker-sovereignty-* cron workers) and enriches EVE entity ids with
 * human-readable names where those entities exist in our database.
 *
 * Serialization notes (no custom scalars in this codebase):
 *   - DateTime  -> String via .toISOString()
 *   - BigInt    -> String via .toString()
 */

type NameRow = { id: number; name: string; ticker: string };

async function allianceNames(ids: (number | null | undefined)[]): Promise<Map<number, NameRow>> {
  const unique = [...new Set(ids.filter((x): x is number => typeof x === 'number'))];
  if (unique.length === 0) return new Map();
  const rows = await prisma.alliance.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, ticker: true },
  });
  return new Map(rows.map((r) => [r.id, r]));
}

async function systemInfo(
  ids: number[]
): Promise<Map<number, { name: string; constellation_id: number | null }>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = await prisma.solarSystem.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, constellation_id: true },
  });
  return new Map(rows.map((r) => [r.id, { name: r.name, constellation_id: r.constellation_id }]));
}

/**
 * Resolves system -> region via the constellation hop (there is no direct
 * system->region FK). Takes an already-built systemInfo map and returns two
 * lookups. Reused by campaigns, structures and by-region aggregation.
 */
async function resolveRegions(
  systems: Map<number, { name: string; constellation_id: number | null }>
) {
  const constellationIds = [...new Set(
    [...systems.values()].map((s) => s.constellation_id).filter((x): x is number => x != null)
  )];
  const constellations = constellationIds.length
    ? await prisma.constellation.findMany({
      where: { id: { in: constellationIds } },
      select: { id: true, region_id: true },
    })
    : [];
  const constToRegion = new Map(constellations.map((c) => [c.id, c.region_id]));
  const regionIds = [...new Set(constellations.map((c) => c.region_id).filter((x): x is number => x != null))];
  const regions = regionIds.length
    ? await prisma.region.findMany({ where: { id: { in: regionIds } }, select: { id: true, name: true } })
    : [];
  const regionNames = new Map(regions.map((r) => [r.id, r.name]));

  return {
    regionIdForSystem: (systemId: number): number | null => {
      const sys = systems.get(systemId);
      return sys?.constellation_id != null ? constToRegion.get(sys.constellation_id) ?? null : null;
    },
    regionName: (regionId: number | null): string | null =>
      regionId != null ? regionNames.get(regionId) ?? null : null,
  };
}

const STRUCTURE_TYPE_NAMES: Record<number, string> = { 32458: 'IHub', 32226: 'TCU' };

/** Enriches raw SovereigntyStructure rows with system/region/alliance names. */
async function enrichStructures(
  rows: {
    structure_id: bigint;
    solar_system_id: number;
    structure_type_id: number;
    alliance_id: number;
    vulnerability_occupancy_level: number | null;
    vulnerable_start_time: Date | null;
    vulnerable_end_time: Date | null;
    first_seen: Date;
    last_seen: Date;
  }[]
) {
  const [systems, alliances] = await Promise.all([
    systemInfo(rows.map((r) => r.solar_system_id)),
    allianceNames(rows.map((r) => r.alliance_id)),
  ]);
  const regions = await resolveRegions(systems);

  return rows.map((s) => {
    const sys = systems.get(s.solar_system_id);
    const regionId = regions.regionIdForSystem(s.solar_system_id);
    const a = alliances.get(s.alliance_id);
    return {
      structureId: s.structure_id.toString(),
      solarSystemId: s.solar_system_id,
      solarSystemName: sys?.name ?? null,
      regionId,
      regionName: regions.regionName(regionId),
      allianceId: s.alliance_id,
      allianceName: a?.name ?? null,
      allianceTicker: a?.ticker ?? null,
      structureTypeId: s.structure_type_id,
      structureTypeName: STRUCTURE_TYPE_NAMES[s.structure_type_id] ?? `Type ${s.structure_type_id}`,
      occupancyLevel: s.vulnerability_occupancy_level,
      vulnerableStartTime: s.vulnerable_start_time?.toISOString() ?? null,
      vulnerableEndTime: s.vulnerable_end_time?.toISOString() ?? null,
      firstSeen: s.first_seen.toISOString(),
      lastSeen: s.last_seen.toISOString(),
    };
  });
}

/**
 * Loads the most recent daily AllianceTerritoryStats row for each of the given
 * alliances. Returns an empty map if the snapshot worker hasn't produced any rows.
 */
async function latestTerritoryStats(allianceIds: number[]) {
  if (allianceIds.length === 0) return new Map<number, {
    campaigns_attacking: number;
    campaigns_defending: number;
    systems_gained: number;
    systems_lost: number;
  }>();
  const latest = await prisma.allianceTerritoryStats.aggregate({ _max: { date: true } });
  if (!latest._max.date) return new Map();
  const rows = await prisma.allianceTerritoryStats.findMany({
    where: { date: latest._max.date, alliance_id: { in: allianceIds } },
  });
  return new Map(rows.map((r) => [r.alliance_id, r]));
}

/**
 * Ranks alliances by an activity column (campaigns_attacking / campaigns_defending)
 * from the latest daily snapshot. Shared by the aggressive/defensive leaderboards.
 */
async function activityLeaderboard(
  column: 'campaigns_attacking' | 'campaigns_defending',
  limit: number
) {
  const latest = await prisma.allianceTerritoryStats.aggregate({ _max: { date: true } });
  if (!latest._max.date) return [];
  const rows = await prisma.allianceTerritoryStats.findMany({
    where: { date: latest._max.date, [column]: { gt: 0 } } as any,
    orderBy: { [column]: 'desc' } as any,
    take: limit,
  });
  const names = await allianceNames(rows.map((r) => r.alliance_id));
  return rows.map((r, idx) => {
    const a = names.get(r.alliance_id);
    return {
      rank: idx + 1,
      allianceId: r.alliance_id,
      allianceName: a?.name ?? null,
      allianceTicker: a?.ticker ?? null,
      campaignsAttacking: r.campaigns_attacking,
      campaignsDefending: r.campaigns_defending,
      systemsGained: r.systems_gained,
      systemsLost: r.systems_lost,
    };
  });
}

type CampaignRow = {
  campaign_id: number;
  constellation_id: number;
  solar_system_id: number;
  structure_id: bigint;
  event_type: string;
  defender_id: number | null;
  defender_score: number | null;
  attackers_score: number | null;
  start_time: Date;
  end_time: Date | null;
  outcome: string | null;
};

/**
 * Shared enrichment for campaign rows (active or ended): system/region/defender
 * names, per-campaign combat stats incl. the attacker-vs-defender split,
 * participants, outcome, and duration. Used by active-campaigns and history.
 */
async function enrichCampaigns(campaigns: CampaignRow[]) {
  if (campaigns.length === 0) return [];
  const ids = campaigns.map((c) => c.campaign_id);

  const [systems, defenders, combatStats, participants] = await Promise.all([
    systemInfo(campaigns.map((c) => c.solar_system_id)),
    allianceNames(campaigns.map((c) => c.defender_id)),
    prisma.campaignCombatStats.findMany({ where: { campaign_id: { in: ids } } }),
    prisma.campaignParticipant.findMany({
      where: { campaign_id: { in: ids } },
      orderBy: { score: 'desc' },
    }),
  ]);

  const combatByCampaign = new Map(combatStats.map((s) => [s.campaign_id, s]));
  const participantNames = await allianceNames(participants.map((p) => p.alliance_id));
  const participantsByCampaign = new Map<number, typeof participants>();
  for (const p of participants) {
    const list = participantsByCampaign.get(p.campaign_id) ?? [];
    list.push(p);
    participantsByCampaign.set(p.campaign_id, list);
  }

  const regions = await resolveRegions(systems);

  return campaigns.map((c) => {
    const sys = systems.get(c.solar_system_id);
    const regionId = regions.regionIdForSystem(c.solar_system_id);
    const def = c.defender_id != null ? defenders.get(c.defender_id) : null;
    const cs = combatByCampaign.get(c.campaign_id);
    const durationHours = c.end_time
      ? Math.round(((c.end_time.getTime() - c.start_time.getTime()) / 3_600_000) * 10) / 10
      : null;
    return {
      campaignId: c.campaign_id,
      eventType: c.event_type,
      solarSystemId: c.solar_system_id,
      solarSystemName: sys?.name ?? null,
      constellationId: c.constellation_id,
      regionId,
      regionName: regions.regionName(regionId),
      structureId: c.structure_id.toString(),
      defenderId: c.defender_id,
      defenderName: def?.name ?? null,
      defenderTicker: def?.ticker ?? null,
      defenderScore: c.defender_score,
      attackersScore: c.attackers_score,
      startTime: c.start_time.toISOString(),
      endTime: c.end_time?.toISOString() ?? null,
      outcome: c.outcome,
      durationHours,
      warKills: cs?.war_kills ?? 0,
      iskDestroyed: cs?.isk_destroyed ?? 0,
      defenderIskLost: cs?.defender_isk_lost ?? 0,
      attackerIskLost: cs?.attacker_isk_lost ?? 0,
      defenderShipsLost: cs?.defender_ships_lost ?? 0,
      attackerShipsLost: cs?.attacker_ships_lost ?? 0,
      participants: (participantsByCampaign.get(c.campaign_id) ?? []).map((p) => {
        const a = participantNames.get(p.alliance_id);
        return {
          allianceId: p.alliance_id,
          allianceName: a?.name ?? null,
          allianceTicker: a?.ticker ?? null,
          score: p.score,
        };
      }),
    };
  });
}

export const sovereigntyQueries: QueryResolvers = {
  sovereigntyOverview: async () => {
    const [ownedSystems, activeCampaigns, trackedStructures, alliances, war] = await Promise.all([
      prisma.sovereigntyMapCurrent.count(),
      prisma.sovereigntyCampaign.count({ where: { end_time: null } }),
      prisma.sovereigntyStructure.count({ where: { destroyed_at: null } }),
      prisma.sovereigntyMapCurrent.findMany({
        where: { alliance_id: { not: null } },
        distinct: ['alliance_id'],
        select: { alliance_id: true },
      }),
      prisma.killmail.aggregate({
        where: { is_war_related: true },
        _count: { _all: true },
        _sum: { total_value: true },
      }),
    ]);
    return {
      ownedSystems,
      activeCampaigns,
      trackedStructures,
      trackedAlliances: alliances.length,
      warKills: war._count._all,
      iskDestroyed: war._sum.total_value ?? 0,
    };
  },

  sovereigntyActiveCampaigns: async (_, { limit }) => {
    const campaigns = await prisma.sovereigntyCampaign.findMany({
      where: { end_time: null },
      orderBy: { start_time: 'desc' },
      take: limit ?? 100,
    });
    return enrichCampaigns(campaigns);
  },

  sovereigntyCampaignHistory: async (_, { limit, offset }) => {
    const take = limit ?? 25;
    const skip = offset ?? 0;
    const [campaigns, totalCount] = await Promise.all([
      prisma.sovereigntyCampaign.findMany({
        where: { end_time: { not: null } },
        orderBy: { end_time: 'desc' },
        take,
        skip,
      }),
      prisma.sovereigntyCampaign.count({ where: { end_time: { not: null } } }),
    ]);
    return { items: await enrichCampaigns(campaigns), totalCount };
  },

  sovereigntyOutcomeStats: async () => {
    const grouped = await prisma.sovereigntyCampaign.groupBy({
      by: ['outcome'],
      where: { end_time: { not: null } },
      _count: { _all: true },
    });
    const byOutcome = new Map(grouped.map((g) => [g.outcome, g._count._all]));
    const defenderWon = byOutcome.get('defender_won') ?? 0;
    const attackerWon = byOutcome.get('attacker_won') ?? 0;
    const abandoned = byOutcome.get('abandoned') ?? 0;
    return {
      defenderWon,
      attackerWon,
      abandoned,
      totalResolved: defenderWon + attackerWon + abandoned,
    };
  },

  topDefenders: async (_, { limit }) => {
    // Alliances ranked by successful defenses among ended campaigns they defended.
    // Only campaigns with a decided outcome count toward the record, so legacy
    // ended rows without an inferred outcome don't dilute the success rate.
    const grouped = await prisma.sovereigntyCampaign.groupBy({
      by: ['defender_id', 'outcome'],
      where: { end_time: { not: null }, defender_id: { not: null }, outcome: { not: null } },
      _count: { _all: true },
    });
    const totals = new Map<number, { won: number; total: number }>();
    for (const g of grouped) {
      if (g.defender_id == null) continue;
      const t = totals.get(g.defender_id) ?? { won: 0, total: 0 };
      t.total += g._count._all;
      if (g.outcome === 'defender_won') t.won += g._count._all;
      totals.set(g.defender_id, t);
    }
    const names = await allianceNames([...totals.keys()]);
    return [...totals.entries()]
      .sort((a, b) => b[1].won - a[1].won || b[1].total - a[1].total)
      .slice(0, limit ?? 10)
      .map(([allianceId, t], idx) => {
        const a = names.get(allianceId);
        return {
          rank: idx + 1,
          allianceId,
          allianceName: a?.name ?? null,
          allianceTicker: a?.ticker ?? null,
          defensesWon: t.won,
          defensesTotal: t.total,
          defenseSuccessRate: t.total > 0 ? t.won / t.total : 0,
        };
      });
  },

  allianceTerritoryRankings: async (_, { limit }) => {
    const take = limit ?? 25;
    const grouped = await prisma.sovereigntyMapCurrent.groupBy({
      by: ['alliance_id'],
      where: { alliance_id: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { alliance_id: 'desc' } },
      take,
    });

    const allianceIds = grouped.map((g) => g.alliance_id).filter((x): x is number => x != null);
    const names = await allianceNames(allianceIds);

    const ihubs = allianceIds.length
      ? await prisma.sovereigntyStructure.groupBy({
        by: ['alliance_id'],
        where: { destroyed_at: null, structure_type_id: 32458, alliance_id: { in: allianceIds } },
        _count: { _all: true },
      })
      : [];
    const ihubCounts = new Map(ihubs.map((i) => [i.alliance_id, i._count._all]));

    // Activity fields from the latest daily snapshot (default 0 if no row yet).
    const stats = await latestTerritoryStats(allianceIds);

    return grouped.map((g, idx) => {
      const a = g.alliance_id != null ? names.get(g.alliance_id) : null;
      const s = g.alliance_id != null ? stats.get(g.alliance_id) : null;
      return {
        rank: idx + 1,
        allianceId: g.alliance_id as number,
        allianceName: a?.name ?? null,
        allianceTicker: a?.ticker ?? null,
        systemsControlled: g._count._all,
        ihubCount: (g.alliance_id != null ? ihubCounts.get(g.alliance_id) : 0) ?? 0,
        campaignsAttacking: s?.campaigns_attacking ?? 0,
        campaignsDefending: s?.campaigns_defending ?? 0,
        systemsGained: s?.systems_gained ?? 0,
        systemsLost: s?.systems_lost ?? 0,
      };
    });
  },

  mostAggressiveAlliances: (_, { limit }) => activityLeaderboard('campaigns_attacking', limit ?? 10),

  mostDefensiveAlliances: (_, { limit }) => activityLeaderboard('campaigns_defending', limit ?? 10),

  recentTerritoryChanges: async (_, { limit }) => {
    const changes = await prisma.territoryChange.findMany({
      orderBy: { detected_at: 'desc' },
      take: limit ?? 50,
    });

    const systems = await systemInfo(changes.map((c) => c.solar_system_id));
    const names = await allianceNames([
      ...changes.map((c) => c.previous_owner_id),
      ...changes.map((c) => c.new_owner_id),
    ]);

    return changes.map((c) => {
      const prev = c.previous_owner_id != null ? names.get(c.previous_owner_id) : null;
      const next = c.new_owner_id != null ? names.get(c.new_owner_id) : null;
      return {
        id: c.id.toString(),
        solarSystemId: c.solar_system_id,
        solarSystemName: systems.get(c.solar_system_id)?.name ?? null,
        previousOwnerId: c.previous_owner_id,
        previousOwnerName: prev?.name ?? null,
        newOwnerId: c.new_owner_id,
        newOwnerName: next?.name ?? null,
        changeType: c.change_type,
        detectedAt: c.detected_at.toISOString(),
      };
    });
  },

  sovereigntyStructures: async (_, { allianceId, systemId, limit }) => {
    const rows = await prisma.sovereigntyStructure.findMany({
      where: {
        destroyed_at: null,
        alliance_id: allianceId ?? undefined,
        solar_system_id: systemId ?? undefined,
      },
      orderBy: { last_seen: 'desc' },
      take: limit ?? 200,
    });
    return enrichStructures(rows);
  },

  sovereigntyUpcomingTimers: async (_, { hoursAhead, limit }) => {
    const now = new Date();
    const horizon = new Date(now.getTime() + (hoursAhead ?? 24) * 60 * 60 * 1000);
    const rows = await prisma.sovereigntyStructure.findMany({
      where: {
        destroyed_at: null,
        vulnerable_start_time: { gte: now, lte: horizon },
      },
      orderBy: { vulnerable_start_time: 'asc' },
      take: limit ?? 100,
    });
    return enrichStructures(rows);
  },

  activeCampaignsByRegion: async (_, { limit }) => {
    const campaigns = await prisma.sovereigntyCampaign.findMany({
      where: { end_time: null },
      select: { solar_system_id: true },
    });
    const systems = await systemInfo(campaigns.map((c) => c.solar_system_id));
    const regions = await resolveRegions(systems);

    const counts = new Map<number, number>();
    for (const c of campaigns) {
      const regionId = regions.regionIdForSystem(c.solar_system_id);
      if (regionId == null) continue;
      counts.set(regionId, (counts.get(regionId) ?? 0) + 1);
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit ?? 20)
      .map(([regionId, campaignCount]) => ({
        regionId,
        regionName: regions.regionName(regionId),
        campaignCount,
      }));
  },

  conflictHotspots: async (_, { limit }) => {
    const campaigns = await prisma.sovereigntyCampaign.findMany({
      where: { end_time: null },
      select: { campaign_id: true, solar_system_id: true },
    });
    const systems = await systemInfo(campaigns.map((c) => c.solar_system_id));
    const regions = await resolveRegions(systems);

    const combatStats = await prisma.campaignCombatStats.findMany({
      where: { campaign_id: { in: campaigns.map((c) => c.campaign_id) } },
    });
    const combatByCampaign = new Map(combatStats.map((s) => [s.campaign_id, s]));

    const agg = new Map<number, { activeCampaigns: number; warKills: number; iskDestroyed: number }>();
    for (const c of campaigns) {
      const regionId = regions.regionIdForSystem(c.solar_system_id);
      if (regionId == null) continue;
      const cur = agg.get(regionId) ?? { activeCampaigns: 0, warKills: 0, iskDestroyed: 0 };
      cur.activeCampaigns += 1;
      const cs = combatByCampaign.get(c.campaign_id);
      cur.warKills += cs?.war_kills ?? 0;
      cur.iskDestroyed += cs?.isk_destroyed ?? 0;
      agg.set(regionId, cur);
    }

    return [...agg.entries()]
      .map(([regionId, r]) => ({
        regionId,
        regionName: regions.regionName(regionId),
        activeCampaigns: r.activeCampaigns,
        warKills: r.warKills,
        iskDestroyed: r.iskDestroyed,
        intensityScore: r.activeCampaigns * 3 + r.warKills,
      }))
      .sort((a, b) => b.intensityScore - a.intensityScore)
      .slice(0, limit ?? 20);
  },
};
