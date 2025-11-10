/**
 * Killmail Entity Scanner
 * Scans killmails and queues missing entity IDs to specialized queues
 */

import '../config';
import prisma from '../services/prisma';
import { getRabbitMQChannel } from '../services/rabbitmq';

const CHARACTER_QUEUE = 'esi_character_info_queue';
const CORPORATION_QUEUE = 'esi_corporation_info_queue';
const ALLIANCE_QUEUE = 'esi_alliance_info_queue';
const TYPE_QUEUE = 'esi_type_info_queue';

const BATCH_SIZE = 100;

interface EntityQueueMessage {
  entityId: number;
  queuedAt: string;
  source: 'killmail_scan';
}

/**
 * Check if entity is NPC character
 */
function isNPCCharacter(id: number): boolean {
  return id < 1000000 || (id >= 3000000 && id < 4000000);
}

/**
 * Check if entity is NPC corporation
 */
function isNPCCorporation(id: number): boolean {
  return id < 2000000;
}

async function scanAndQueueEntities() {
  console.log('🔍 Killmail Entity Scanner Started\n');
  console.log('━'.repeat(70));

  try {
    const channel = await getRabbitMQChannel();

    // Create all queues
    const queues = [CHARACTER_QUEUE, CORPORATION_QUEUE, ALLIANCE_QUEUE, TYPE_QUEUE];
    for (const queue of queues) {
      await channel.assertQueue(queue, {
        durable: true,
        arguments: { 'x-max-priority': 10 },
      });
    }

    console.log('✅ Connected to RabbitMQ');
    console.log('📦 Queues ready:\n');
    queues.forEach(q => console.log(`   - ${q}`));
    console.log('\n' + '━'.repeat(70));

    // Get total killmail count
    const totalKillmails = await prisma.killmail.count();
    console.log(`\n📊 Total killmails: ${totalKillmails}\n`);

    // Collect all unique IDs
    const characterIds = new Set<number>();
    const corporationIds = new Set<number>();
    const allianceIds = new Set<number>();
    const typeIds = new Set<number>();

    let offset = 0;
    console.log('🔍 Scanning killmails...\n');

    while (offset < totalKillmails) {
      const killmails = await prisma.killmail.findMany({
        skip: offset,
        take: BATCH_SIZE,
        include: {
          victim: true,
          attackers: {
            select: {
              character_id: true,
              corporation_id: true,
              alliance_id: true,
              ship_type_id: true,
              weapon_type_id: true,
            },
          },
          items: {
            select: {
              item_type_id: true,
            },
          },
        },
      });

      // Collect IDs from this batch
      for (const km of killmails) {
        // Victim
        if (km.victim?.character_id) characterIds.add(km.victim.character_id);
        if (km.victim?.corporation_id) corporationIds.add(km.victim.corporation_id);
        if (km.victim?.alliance_id) allianceIds.add(km.victim.alliance_id);
        if (km.victim?.ship_type_id) typeIds.add(km.victim.ship_type_id);

        // Attackers
        for (const attacker of km.attackers) {
          if (attacker.character_id) characterIds.add(attacker.character_id);
          if (attacker.corporation_id) corporationIds.add(attacker.corporation_id);
          if (attacker.alliance_id) allianceIds.add(attacker.alliance_id);
          if (attacker.ship_type_id) typeIds.add(attacker.ship_type_id);
          if (attacker.weapon_type_id) typeIds.add(attacker.weapon_type_id);
        }

        // Items
        for (const item of km.items) {
          typeIds.add(item.item_type_id);
        }
      }

      offset += BATCH_SIZE;
      const progress = Math.min(offset, totalKillmails);
      const percentage = ((progress / totalKillmails) * 100).toFixed(1);
      console.log(`   📖 Scanned ${progress}/${totalKillmails} (${percentage}%)`);
    }

    console.log('\n' + '━'.repeat(70));
    console.log('📊 Unique IDs found:');
    console.log(`   Characters: ${characterIds.size}`);
    console.log(`   Corporations: ${corporationIds.size}`);
    console.log(`   Alliances: ${allianceIds.size}`);
    console.log(`   Types: ${typeIds.size}`);
    console.log('━'.repeat(70) + '\n');

    // Filter NPCs
    console.log('🤖 Filtering NPCs...\n');
    const beforeCharFilter = characterIds.size;
    const beforeCorpFilter = corporationIds.size;

    const playerCharacterIds = Array.from(characterIds).filter(id => !isNPCCharacter(id));
    const playerCorporationIds = Array.from(corporationIds).filter(id => !isNPCCorporation(id));

    console.log(`   Filtered ${beforeCharFilter - playerCharacterIds.length} NPC characters`);
    console.log(`   Filtered ${beforeCorpFilter - playerCorporationIds.length} NPC corporations\n`);

    // Filter already existing entities
    console.log('🔎 Checking database for existing entities...\n');

    const [existingChars, existingCorps, existingAlliances, existingTypes] = await Promise.all([
      prisma.character.findMany({ select: { id: true } }),
      prisma.corporation.findMany({ select: { id: true } }),
      prisma.alliance.findMany({ select: { id: true } }),
      prisma.type.findMany({ select: { id: true } }),
    ]);

    const existingCharIds = new Set(existingChars.map(c => c.id));
    const existingCorpIds = new Set(existingCorps.map(c => c.id));
    const existingAllianceIds = new Set(existingAlliances.map(a => a.id));
    const existingTypeIds = new Set(existingTypes.map(t => t.id));

    const missingCharIds = playerCharacterIds.filter(id => !existingCharIds.has(id));
    const missingCorpIds = playerCorporationIds.filter(id => !existingCorpIds.has(id));
    const missingAllianceIds = Array.from(allianceIds).filter(id => !existingAllianceIds.has(id));
    const missingTypeIds = Array.from(typeIds).filter(id => !existingTypeIds.has(id));

    console.log('📋 Missing entities (need info fetch):');
    console.log(`   Characters: ${missingCharIds.length}`);
    console.log(`   Corporations: ${missingCorpIds.length}`);
    console.log(`   Alliances: ${missingAllianceIds.length}`);
    console.log(`   Types: ${missingTypeIds.length}\n`);

    console.log('━'.repeat(70));
    console.log('📤 Queuing entities...\n');

    // Queue characters
    for (const id of missingCharIds) {
      const message: EntityQueueMessage = {
        entityId: id,
        queuedAt: new Date().toISOString(),
        source: 'killmail_scan',
      };
      channel.sendToQueue(CHARACTER_QUEUE, Buffer.from(JSON.stringify(message)), {
        persistent: true,
        priority: 5,
      });
    }
    console.log(`   ✅ Queued ${missingCharIds.length} characters`);

    // Queue corporations
    for (const id of missingCorpIds) {
      const message: EntityQueueMessage = {
        entityId: id,
        queuedAt: new Date().toISOString(),
        source: 'killmail_scan',
      };
      channel.sendToQueue(CORPORATION_QUEUE, Buffer.from(JSON.stringify(message)), {
        persistent: true,
        priority: 5,
      });
    }
    console.log(`   ✅ Queued ${missingCorpIds.length} corporations`);

    // Queue alliances
    for (const id of missingAllianceIds) {
      const message: EntityQueueMessage = {
        entityId: id,
        queuedAt: new Date().toISOString(),
        source: 'killmail_scan',
      };
      channel.sendToQueue(ALLIANCE_QUEUE, Buffer.from(JSON.stringify(message)), {
        persistent: true,
        priority: 5,
      });
    }
    console.log(`   ✅ Queued ${missingAllianceIds.length} alliances`);

    // Queue types
    for (const id of missingTypeIds) {
      const message: EntityQueueMessage = {
        entityId: id,
        queuedAt: new Date().toISOString(),
        source: 'killmail_scan',
      };
      channel.sendToQueue(TYPE_QUEUE, Buffer.from(JSON.stringify(message)), {
        persistent: true,
        priority: 5,
      });
    }
    console.log(`   ✅ Queued ${missingTypeIds.length} types\n`);

    console.log('━'.repeat(70));
    console.log('✅ Scanning complete!\n');
    console.log('🚀 Start specialized workers:');
    console.log('   yarn worker:info:characters');
    console.log('   yarn worker:info:corporations');
    console.log('   yarn worker:info:alliances');
    console.log('   yarn worker:info:types\n');

    await prisma.$disconnect();
  } catch (error) {
    console.error('💥 Scanner failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Run
scanAndQueueEntities();
