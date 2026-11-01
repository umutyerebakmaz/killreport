import { config } from '@config/config';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import redis from '@services/redis';
import { postWebhook } from './discord-client';
import {
  buildKillmailEmbed,
  MAX_KILLMAIL_AGE_MS,
  planDeliveries,
  webhookUrlHash,
  type Delivery,
  type KillmailParties,
  type Party,
} from './discord-webhook.helpers';

const SENT_TTL_SECONDS = 86400;

export class DiscordDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscordDeliveryError';
  }
}

const sentKey = (killmailId: number, url: string): string =>
  `discord:sent:${killmailId}:${webhookUrlHash(url)}`;

const ids = (values: (number | null | undefined)[]): number[] => [
  ...new Set(values.filter((v): v is number => typeof v === 'number')),
];

const nameMap = (rows: { id: number; name: string }[]) =>
  new Map(rows.map((r) => [r.id, r.name]));

export async function deliverKillmail(
  killmailId: number,
  now: Date = new Date(),
): Promise<void> {
  const killmail = await prismaWorker.killmail.findUnique({
    where: { killmail_id: killmailId },
    select: {
      killmail_time: true,
      total_value: true,
      attacker_count: true,
      solar_system_id: true,
    },
  });
  if (!killmail) {
    logger.warn(`discord delivery: killmail ${killmailId} not found`);
    return;
  }
  if (now.getTime() - killmail.killmail_time.getTime() > MAX_KILLMAIL_AGE_MS) {
    return;
  }

  const [victim, attackers] = await Promise.all([
    prismaWorker.victim.findUnique({ where: { killmail_id: killmailId } }),
    prismaWorker.attacker.findMany({ where: { killmail_id: killmailId } }),
  ]);
  if (!victim) {
    logger.warn(`discord delivery: killmail ${killmailId} has no victim`);
    return;
  }

  const toParty = (p: {
    character_id: number | null;
    corporation_id: number | null;
    alliance_id: number | null;
  }): Party => ({
    characterId: p.character_id,
    corporationId: p.corporation_id,
    allianceId: p.alliance_id,
  });
  const parties: KillmailParties = {
    victim: toParty(victim),
    attackers: attackers.map(toParty),
  };

  const all = [parties.victim, ...parties.attackers];
  const characterIds = ids(all.map((p) => p.characterId));
  const corporationIds = ids(all.map((p) => p.corporationId));
  const allianceIds = ids(all.map((p) => p.allianceId));

  const webhookRows = await prismaWorker.discordWebhook.findMany({
    where: {
      disabled_at: null,
      OR: [
        { entity_type: 'CHARACTER', entity_id: { in: characterIds } },
        { entity_type: 'CORPORATION', entity_id: { in: corporationIds } },
        { entity_type: 'ALLIANCE', entity_id: { in: allianceIds } },
      ],
    },
  });
  const deliveries = planDeliveries(
    parties,
    webhookRows.map((r) => ({
      id: r.id,
      url: r.url,
      entityType: r.entity_type,
      entityId: r.entity_id,
      activeSince: r.active_since,
    })),
    killmail.killmail_time,
    now,
  );
  if (deliveries.length === 0) return;

  const finalBlow = attackers.find((a) => a.final_blow) ?? null;
  const [types, characters, corporations, alliances, systems] =
    await Promise.all([
      prismaWorker.type.findMany({
        where: {
          id: {
            in: ids([victim.ship_type_id, finalBlow?.ship_type_id]),
          },
        },
        select: { id: true, name: true },
      }),
      prismaWorker.character.findMany({
        where: { id: { in: characterIds } },
        select: { id: true, name: true },
      }),
      prismaWorker.corporation.findMany({
        where: { id: { in: corporationIds } },
        select: { id: true, name: true },
      }),
      prismaWorker.alliance.findMany({
        where: { id: { in: allianceIds } },
        select: { id: true, name: true },
      }),
      prismaWorker.solarSystem.findMany({
        where: { id: killmail.solar_system_id },
        select: {
          id: true,
          name: true,
          security_status: true,
          constellation_id: true,
        },
      }),
    ]);
  const system = systems[0] ?? null;
  const constellations = system?.constellation_id
    ? await prismaWorker.constellation.findMany({
        where: { id: system.constellation_id },
        select: { id: true, region_id: true },
      })
    : [];
  const regionId = constellations[0]?.region_id ?? null;
  const regions = regionId
    ? await prismaWorker.region.findMany({
        where: { id: regionId },
        select: { id: true, name: true },
      })
    : [];

  const typeNames = nameMap(types);
  const characterNames = nameMap(characters);
  const corporationNames = nameMap(corporations);
  const allianceNames = nameMap(alliances);
  const lookup = (map: Map<number, string>, id: number | null | undefined) =>
    id == null ? null : (map.get(id) ?? null);

  const entityName = (e: Delivery['entities'][number]): string =>
    (e.type === 'CHARACTER'
      ? characterNames.get(e.id)
      : e.type === 'CORPORATION'
        ? corporationNames.get(e.id)
        : allianceNames.get(e.id)) ?? 'Unknown';

  let pending = 0;
  for (const delivery of deliveries) {
    const key = sentKey(killmailId, delivery.url);
    if (await redis.get(key)) continue;

    const payload = buildKillmailEmbed({
      kind: delivery.kind,
      killmailId,
      killmailTime: killmail.killmail_time,
      frontendUrl: config.eveSso.frontendUrl,
      shipTypeId: victim.ship_type_id,
      shipName: lookup(typeNames, victim.ship_type_id),
      victimName: lookup(characterNames, victim.character_id),
      victimCorpName: lookup(corporationNames, victim.corporation_id),
      victimAllianceName: lookup(allianceNames, victim.alliance_id),
      finalBlowName: lookup(characterNames, finalBlow?.character_id),
      finalBlowShipName: lookup(typeNames, finalBlow?.ship_type_id),
      totalValue: killmail.total_value,
      attackerCount: killmail.attacker_count ?? attackers.length,
      systemName: system?.name ?? null,
      securityStatus: system?.security_status ?? null,
      regionName: regions[0]?.name ?? null,
      footerEntityNames: delivery.entities.map(entityName),
    });

    const result = await postWebhook(delivery.url, payload);
    switch (result.outcome) {
      case 'ok':
        await redis.set(key, '1', 'EX', SENT_TTL_SECONDS, 'NX');
        break;
      case 'disable':
        await prismaWorker.discordWebhook.updateMany({
          where: { url: delivery.url },
          data: { disabled_at: now },
        });
        logger.warn(
          `discord webhook(s) ${delivery.webhookIds.join(',')} disabled (status ${result.status})`,
        );
        break;
      case 'drop':
        logger.error(
          `discord delivery dropped: killmail ${killmailId}, webhook(s) ${delivery.webhookIds.join(',')}, status ${result.status}, body ${result.body ?? ''}`,
        );
        await redis.set(key, '1', 'EX', SENT_TTL_SECONDS, 'NX');
        break;
      case 'transient':
        pending += 1;
        logger.warn(
          `discord delivery transient failure: killmail ${killmailId}, webhook(s) ${delivery.webhookIds.join(',')}, status ${result.status}`,
        );
        break;
    }
  }

  if (pending > 0) {
    throw new DiscordDeliveryError(
      `discord delivery incomplete for killmail ${killmailId}: ${pending} webhook(s) pending`,
    );
  }
}
