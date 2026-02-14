import { KillmailFilter } from "@generated-types";

/**
 * Build Prisma WHERE clause for killmail filtering
 * Each filter has its own OR conditions, combined with AND
 */
export function filters(filter: KillmailFilter): any {
  const where: any = {};
  const andConditions: any[] = [];
  const shipTypeId = filter.shipTypeId;
  const regionId = filter.regionId;
  const systemId = filter.systemId;
  const characterId = filter.characterId;
  const corporationId = filter.corporationId;
  const allianceId = filter.allianceId;

  // Ship type filter: victim OR attacker (own OR group)
  if (shipTypeId) {
    andConditions.push({
      OR: [
        {
          victim: {
            ship_type_id: shipTypeId,
          },
        },
        {
          attackers: {
            some: {
              ship_type_id: shipTypeId,
            },
          },
        },
      ]
    });
  }

  // Character filter: victim OR attacker (own OR group)
  if (characterId) {
    andConditions.push({
      OR: [
        {
          victim: {
            character_id: characterId
          }
        },
        {
          attackers: {
            some: { character_id: characterId }
          }
        },
      ]
    });
  }

  // Corporation filter: victim OR attacker (own OR group)
  if (corporationId) {
    andConditions.push({
      OR: [
        {
          victim: {
            corporation_id: corporationId
          }
        },
        {
          attackers: {
            some: {
              corporation_id: corporationId
            }
          }
        },
      ]
    });
  }

  // Alliance filter: victim OR attacker (own OR group)
  if (allianceId) {
    andConditions.push({
      OR: [
        {
          victim: {
            alliance_id: allianceId
          }
        },
        {
          attackers: {
            some: {
              alliance_id: allianceId
            }
          }
        },
      ]
    });
  }

  // Location filters (also added to AND conditions)
  if (regionId) {
    andConditions.push({
      solar_system: {
        constellation: {
          region_id: regionId,
        },
      },
    });
  }

  if (systemId) {
    andConditions.push({
      solar_system_id: systemId,
    });
  }

  // Combine all filters with AND
  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  return where;
}
