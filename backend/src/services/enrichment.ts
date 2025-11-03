/**
 * Killmail Enrichment Service
 * Yeni killmail eklendiğinde içindeki bilinmeyen character, corporation ve item bilgilerini
 * ESI'dan çeker ve veritabanına kaydeder.
 */

import {
  getAllianceInfo,
  getCharacterInfo,
  getCorporationInfo,
  getTypeInfo,
} from './eve-esi';
import prisma from './prisma';

interface EnrichmentResult {
  charactersAdded: number;
  corporationsAdded: number;
  alliancesAdded: number;
  typesAdded: number;
  errors: string[];
}

/**
 * Killmail'deki tüm bilinmeyen varlıkları ESI'dan çekip veritabanına kaydeder
 */
export async function enrichKillmail(killmailId: number): Promise<EnrichmentResult> {
  const result: EnrichmentResult = {
    charactersAdded: 0,
    corporationsAdded: 0,
    alliancesAdded: 0,
    typesAdded: 0,
    errors: [],
  };

  try {
    // Killmail'i tüm ilişkileriyle çek
    const killmail = await prisma.killmail.findUnique({
      where: { killmail_id: killmailId },
      include: {
        victim: true,
        attackers: true,
        items: true,
      },
    });

    if (!killmail) {
      result.errors.push(`Killmail ${killmailId} not found`);
      return result;
    }

    // Tüm unique ID'leri topla
    const characterIds = new Set<number>();
    const corporationIds = new Set<number>();
    const allianceIds = new Set<number>();
    const typeIds = new Set<number>();

    // Victim'dan ID'leri topla
    if (killmail.victim) {
      if (killmail.victim.character_id) characterIds.add(killmail.victim.character_id);
      if (killmail.victim.corporation_id) corporationIds.add(killmail.victim.corporation_id);
      if (killmail.victim.alliance_id) allianceIds.add(killmail.victim.alliance_id);
      if (killmail.victim.ship_type_id) typeIds.add(killmail.victim.ship_type_id);
    }

    // Attacker'lardan ID'leri topla
    for (const attacker of killmail.attackers) {
      if (attacker.character_id) characterIds.add(attacker.character_id);
      if (attacker.corporation_id) corporationIds.add(attacker.corporation_id);
      if (attacker.alliance_id) allianceIds.add(attacker.alliance_id);
      if (attacker.ship_type_id) typeIds.add(attacker.ship_type_id);
      if (attacker.weapon_type_id) typeIds.add(attacker.weapon_type_id);
    }

    // Item'lardan ID'leri topla
    for (const item of killmail.items) {
      if (item.item_type_id) typeIds.add(item.item_type_id);
    }

    // Veritabanında olmayan ID'leri filtrele
    const missingCharacterIds = await filterMissingCharacters(Array.from(characterIds));
    const missingCorporationIds = await filterMissingCorporations(Array.from(corporationIds));
    const missingAllianceIds = await filterMissingAlliances(Array.from(allianceIds));
    const missingTypeIds = await filterMissingTypes(Array.from(typeIds));

    // Eksik character'ları çek ve kaydet
    for (const characterId of missingCharacterIds) {
      try {
        const charInfo = await getCharacterInfo(characterId);
        await prisma.character.create({
          data: {
            id: characterId,
            name: charInfo.name,
            corporation_id: charInfo.corporation_id,
            alliance_id: charInfo.alliance_id,
            birthday: new Date(charInfo.birthday),
            bloodline_id: charInfo.bloodline_id,
            race_id: charInfo.race_id,
            gender: charInfo.gender,
            security_status: charInfo.security_status,
            description: charInfo.description,
            title: charInfo.title,
            faction_id: charInfo.faction_id,
          },
        });
        result.charactersAdded++;

        // Rate limiting: ESI 150 req/sec
        await sleep(10);
      } catch (error: any) {
        result.errors.push(`Character ${characterId}: ${error.message}`);
      }
    }

    // Eksik corporation'ları çek ve kaydet
    for (const corporationId of missingCorporationIds) {
      try {
        const corpInfo = await getCorporationInfo(corporationId);
        await prisma.corporation.create({
          data: {
            id: corporationId,
            name: corpInfo.name,
            ticker: corpInfo.ticker,
            member_count: corpInfo.member_count,
            ceo_id: corpInfo.ceo_id,
            creator_id: corpInfo.creator_id,
            date_founded: corpInfo.date_founded ? new Date(corpInfo.date_founded) : null,
            description: corpInfo.description,
            alliance_id: corpInfo.alliance_id,
            faction_id: corpInfo.faction_id,
            home_station_id: corpInfo.home_station_id,
            shares: corpInfo.shares,
            tax_rate: corpInfo.tax_rate,
            url: corpInfo.url,
          },
        });
        result.corporationsAdded++;

        await sleep(10);
      } catch (error: any) {
        result.errors.push(`Corporation ${corporationId}: ${error.message}`);
      }
    }

    // Eksik alliance'ları çek ve kaydet
    for (const allianceId of missingAllianceIds) {
      try {
        const allianceInfo = await getAllianceInfo(allianceId);
        await prisma.alliance.create({
          data: {
            id: allianceId,
            name: allianceInfo.name,
            ticker: allianceInfo.ticker,
            date_founded: new Date(allianceInfo.date_founded),
            creator_corporation_id: allianceInfo.creator_corporation_id,
            creator_id: allianceInfo.creator_id,
            executor_corporation_id: allianceInfo.executor_corporation_id,
            faction_id: allianceInfo.faction_id,
          },
        });
        result.alliancesAdded++;

        await sleep(10);
      } catch (error: any) {
        result.errors.push(`Alliance ${allianceId}: ${error.message}`);
      }
    }

    // Eksik type'ları çek ve kaydet
    for (const typeId of missingTypeIds) {
      try {
        const typeInfo = await getTypeInfo(typeId);
        await prisma.type.create({
          data: {
            id: typeId,
            name: typeInfo.name,
            description: typeInfo.description,
            group_id: typeInfo.group_id,
            published: typeInfo.published,
            volume: typeInfo.volume,
            capacity: typeInfo.capacity,
            mass: typeInfo.mass,
            icon_id: typeInfo.icon_id,
          },
        });
        result.typesAdded++;

        await sleep(10);
      } catch (error: any) {
        result.errors.push(`Type ${typeId}: ${error.message}`);
      }
    }

    return result;
  } catch (error: any) {
    result.errors.push(`Enrichment failed: ${error.message}`);
    return result;
  }
}

/**
 * Veritabanında olmayan character ID'lerini filtreler
 */
async function filterMissingCharacters(characterIds: number[]): Promise<number[]> {
  if (characterIds.length === 0) return [];

  const existing = await prisma.character.findMany({
    where: { id: { in: characterIds } },
    select: { id: true },
  });

  const existingIds = new Set(existing.map(c => c.id));
  return characterIds.filter(id => !existingIds.has(id));
}

/**
 * Veritabanında olmayan corporation ID'lerini filtreler
 */
async function filterMissingCorporations(corporationIds: number[]): Promise<number[]> {
  if (corporationIds.length === 0) return [];

  const existing = await prisma.corporation.findMany({
    where: { id: { in: corporationIds } },
    select: { id: true },
  });

  const existingIds = new Set(existing.map(c => c.id));
  return corporationIds.filter(id => !existingIds.has(id));
}

/**
 * Veritabanında olmayan alliance ID'lerini filtreler
 */
async function filterMissingAlliances(allianceIds: number[]): Promise<number[]> {
  if (allianceIds.length === 0) return [];

  const existing = await prisma.alliance.findMany({
    where: { id: { in: allianceIds } },
    select: { id: true },
  });

  const existingIds = new Set(existing.map(a => a.id));
  return allianceIds.filter(id => !existingIds.has(id));
}

/**
 * Veritabanında olmayan type ID'lerini filtreler
 */
async function filterMissingTypes(typeIds: number[]): Promise<number[]> {
  if (typeIds.length === 0) return [];

  const existing = await prisma.type.findMany({
    where: { id: { in: typeIds } },
    select: { id: true },
  });

  const existingIds = new Set(existing.map(t => t.id));
  return typeIds.filter(id => !existingIds.has(id));
}

/**
 * Basit sleep fonksiyonu (rate limiting için)
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
