import { SubscriptionResolvers } from '@generated-types';
import prisma from '@services/prisma';
import { pubsub, SovereigntyAlertPayload } from '@services/pubsub';

/**
 * Sovereignty Alert Subscription
 *
 * Streams sov events published by the worker processes (campaign started/ended,
 * territory change) to every connected browser over SSE. The worker publishes
 * only ids + a type; this resolver hydrates system/region/alliance names and
 * composes a human-readable message (mirroring how newKillmail publishes an id
 * and hydrates the rest).
 */
async function hydrate(payload: SovereigntyAlertPayload) {
  const allianceId =
    payload.type === 'territory_change'
      ? payload.newOwnerId ?? payload.previousOwnerId ?? null
      : payload.defenderId ?? null;

  const [system, alliance] = await Promise.all([
    prisma.solarSystem.findUnique({
      where: { id: payload.systemId },
      select: { name: true, constellation_id: true },
    }),
    allianceId != null
      ? prisma.alliance.findUnique({ where: { id: allianceId }, select: { name: true, ticker: true } })
      : Promise.resolve(null),
  ]);

  let regionName: string | null = null;
  if (system?.constellation_id != null) {
    const c = await prisma.constellation.findUnique({
      where: { id: system.constellation_id },
      select: { region_id: true },
    });
    if (c?.region_id != null) {
      const r = await prisma.region.findUnique({ where: { id: c.region_id }, select: { name: true } });
      regionName = r?.name ?? null;
    }
  }

  const systemName = system?.name ?? `#${payload.systemId}`;
  const loc = regionName ? `${systemName} (${regionName})` : systemName;
  let message: string;
  if (payload.type === 'campaign_started') {
    message = `New sovereignty campaign in ${loc}`;
  } else if (payload.type === 'campaign_ended') {
    message = `Campaign in ${loc} ended — ${payload.outcome ?? 'unresolved'}`;
  } else {
    message = `${systemName} sovereignty ${payload.changeType ?? 'changed'}${regionName ? ` (${regionName})` : ''}`;
  }

  return {
    type: payload.type,
    message,
    solarSystemId: payload.systemId,
    solarSystemName: system?.name ?? null,
    regionName,
    allianceId,
    allianceName: alliance?.name ?? null,
    allianceTicker: alliance?.ticker ?? null,
    outcome: payload.outcome ?? null,
    changeType: payload.changeType ?? null,
    timestamp: new Date().toISOString(),
  };
}

export const sovereigntySubscriptions: SubscriptionResolvers = {
  sovereigntyAlert: {
    subscribe: () => pubsub.subscribe('SOVEREIGNTY_ALERT'),
    resolve: (payload: SovereigntyAlertPayload) => hydrate(payload),
  },
};
