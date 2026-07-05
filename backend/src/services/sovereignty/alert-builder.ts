import type { PrismaClient } from '../../generated/prisma/client';

/**
 * Fully-hydrated sovereignty alert. Built ONCE at publish time (in the worker)
 * so the subscription resolver is a passthrough — no per-subscriber DB fan-out.
 */
export type SovereigntyAlertData = {
  type: 'campaign_started' | 'campaign_ended' | 'territory_change';
  message: string;
  solarSystemId: number;
  solarSystemName: string | null;
  regionName: string | null;
  allianceId: number | null;
  allianceName: string | null;
  allianceTicker: string | null;
  outcome: string | null;
  changeType: string | null;
  timestamp: string;
};

export type SovereigntyAlertEvent =
  | { type: 'campaign_started'; systemId: number; defenderId?: number | null }
  | { type: 'campaign_ended'; systemId: number; defenderId?: number | null; outcome?: string | null }
  | {
    type: 'territory_change';
    systemId: number;
    previousOwnerId?: number | null;
    newOwnerId?: number | null;
    changeType?: string | null;
  };

/**
 * Enriches a raw sov event with system/region/alliance names and a human-readable
 * message. Runs on whichever Prisma client the caller passes (the workers pass
 * the worker client). Called once per event before publishing.
 */
export async function buildSovereigntyAlert(
  client: PrismaClient,
  event: SovereigntyAlertEvent
): Promise<SovereigntyAlertData> {
  const allianceId =
    event.type === 'territory_change'
      ? event.newOwnerId ?? event.previousOwnerId ?? null
      : event.defenderId ?? null;

  const [system, alliance] = await Promise.all([
    client.solarSystem.findUnique({
      where: { id: event.systemId },
      select: { name: true, constellation_id: true },
    }),
    allianceId != null
      ? client.alliance.findUnique({ where: { id: allianceId }, select: { name: true, ticker: true } })
      : Promise.resolve(null),
  ]);

  let regionName: string | null = null;
  if (system?.constellation_id != null) {
    const constellation = await client.constellation.findUnique({
      where: { id: system.constellation_id },
      select: { region_id: true },
    });
    if (constellation?.region_id != null) {
      const region = await client.region.findUnique({
        where: { id: constellation.region_id },
        select: { name: true },
      });
      regionName = region?.name ?? null;
    }
  }

  const systemName = system?.name ?? `#${event.systemId}`;
  const loc = regionName ? `${systemName} (${regionName})` : systemName;

  let message: string;
  let outcome: string | null = null;
  let changeType: string | null = null;
  if (event.type === 'campaign_started') {
    message = `New sovereignty campaign in ${loc}`;
  } else if (event.type === 'campaign_ended') {
    outcome = event.outcome ?? null;
    message = `Campaign in ${loc} ended — ${outcome ?? 'unresolved'}`;
  } else {
    changeType = event.changeType ?? null;
    message = `${systemName} sovereignty ${changeType ?? 'changed'}${regionName ? ` (${regionName})` : ''}`;
  }

  return {
    type: event.type,
    message,
    solarSystemId: event.systemId,
    solarSystemName: system?.name ?? null,
    regionName,
    allianceId,
    allianceName: alliance?.name ?? null,
    allianceTicker: alliance?.ticker ?? null,
    outcome,
    changeType,
    timestamp: new Date().toISOString(),
  };
}
