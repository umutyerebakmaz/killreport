import './config';
import { pool } from './services/database';
import { esiService } from './services/esi';
import { QueueType, rabbitmqService } from './services/rabbitmq-enhanced';

/**
 * ESI Sync Orchestrator
 * Bu script tüm alliance, corporation ve character'ları sync etmek için kullanılır
 */

interface SyncOptions {
  alliances?: boolean;
  corporations?: boolean;
  characters?: boolean;
  batchSize?: number;
}

class SyncOrchestrator {
  private batchSize: number = 100;

  constructor(batchSize?: number) {
    if (batchSize) {
      this.batchSize = batchSize;
    }
  }

  /**
   * Tüm alliance'ları ESI'den çeker ve queue'ya ekler
   */
  async syncAllAlliances(): Promise<void> {
    console.log('📡 Fetching all alliance IDs from ESI...');

    try {
      const allianceIds = await esiService.getAllAllianceIds();
      console.log(`✓ Found ${allianceIds.length} alliances`);

      console.log(`📤 Publishing alliances to queue in batches of ${this.batchSize}...`);

      // Batch halinde queue'ya ekle
      for (let i = 0; i < allianceIds.length; i += this.batchSize) {
        const batch = allianceIds.slice(i, i + this.batchSize);
        await rabbitmqService.publishBatch(QueueType.ALLIANCE, batch);
        console.log(`  ✓ Published batch ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(allianceIds.length / this.batchSize)}`);
      }

      console.log(`✓ All ${allianceIds.length} alliances queued for processing\n`);
    } catch (error) {
      console.error('✗ Failed to sync alliances:', error);
      throw error;
    }
  }

  /**
   * Database'deki tüm corporation ID'lerini queue'ya ekler
   */
  async syncAllCorporations(): Promise<void> {
    console.log('📡 Fetching corporation IDs from database...');

    try {
      // Alliance tablosundan unique corporation ID'leri çek
      const result = await pool.query(`
        SELECT DISTINCT creator_corporation_id as id FROM "Alliance"
        UNION
        SELECT DISTINCT executor_corporation_id as id FROM "Alliance"
      `);

      const corporationIds = result.rows.map((row: any) => row.id);
      console.log(`✓ Found ${corporationIds.length} unique corporations`);

      console.log(`📤 Publishing corporations to queue in batches of ${this.batchSize}...`);

      for (let i = 0; i < corporationIds.length; i += this.batchSize) {
        const batch = corporationIds.slice(i, i + this.batchSize);
        await rabbitmqService.publishBatch(QueueType.CORPORATION, batch);
        console.log(`  ✓ Published batch ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(corporationIds.length / this.batchSize)}`);
      }

      console.log(`✓ All ${corporationIds.length} corporations queued for processing\n`);
    } catch (error) {
      console.error('✗ Failed to sync corporations:', error);
      throw error;
    }
  }

  /**
   * Database'deki tüm character ID'lerini queue'ya ekler
   */
  async syncAllCharacters(): Promise<void> {
    console.log('📡 Fetching character IDs from database...');

    try {
      // Alliance ve Corporation tablolarından unique character ID'leri çek
      const result = await pool.query(`
        SELECT DISTINCT creator_id as id FROM "Alliance"
        UNION
        SELECT DISTINCT ceo_id as id FROM "Corporation"
      `);

      const characterIds = result.rows.map((row: any) => row.id);
      console.log(`✓ Found ${characterIds.length} unique characters`);

      console.log(`📤 Publishing characters to queue in batches of ${this.batchSize}...`);

      for (let i = 0; i < characterIds.length; i += this.batchSize) {
        const batch = characterIds.slice(i, i + this.batchSize);
        await rabbitmqService.publishBatch(QueueType.CHARACTER, batch);
        console.log(`  ✓ Published batch ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(characterIds.length / this.batchSize)}`);
      }

      console.log(`✓ All ${characterIds.length} characters queued for processing\n`);
    } catch (error) {
      console.error('✗ Failed to sync characters:', error);
      throw error;
    }
  }

  /**
   * Tek bir entity'yi queue'ya ekler
   */
  async queueEntity(type: 'alliance' | 'corporation' | 'character', id: number): Promise<void> {
    const queueMap = {
      alliance: QueueType.ALLIANCE,
      corporation: QueueType.CORPORATION,
      character: QueueType.CHARACTER,
    };

    await rabbitmqService.publish(queueMap[type], id);
    console.log(`✓ Queued ${type} ${id}`);
  }

  /**
   * Queue durumlarını gösterir
   */
  async showQueueStatus(): Promise<void> {
    console.log('\n📊 Queue Status:');
    console.log('================================');

    for (const queueType of Object.values(QueueType)) {
      const count = await rabbitmqService.getQueueMessageCount(queueType);
      console.log(`${queueType}: ${count} messages pending`);
    }

    const rateLimitStatus = esiService.getRateLimitStatus();
    console.log('\n🚦 Rate Limit Status:');
    console.log('================================');
    console.log(`Error Limit Remaining: ${rateLimitStatus.errorLimitRemaining}/100`);
    console.log(`Requests in Queue: ${rateLimitStatus.queueLength}`);
    console.log('================================\n');
  }

  /**
   * Tüm queue'ları temizler
   */
  async purgeAllQueues(): Promise<void> {
    console.log('⚠️  Purging all queues...');
    await rabbitmqService.purgeAllQueues();
    console.log('✓ All queues purged\n');
  }
}

// CLI kullanımı
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const orchestrator = new SyncOrchestrator(100);

  try {
    await rabbitmqService.connect();

    switch (command) {
      case 'sync-alliances':
        await orchestrator.syncAllAlliances();
        break;

      case 'sync-corporations':
        await orchestrator.syncAllCorporations();
        break;

      case 'sync-characters':
        await orchestrator.syncAllCharacters();
        break;

      case 'sync-all':
        await orchestrator.syncAllAlliances();
        await orchestrator.syncAllCorporations();
        await orchestrator.syncAllCharacters();
        break;

      case 'status':
        await orchestrator.showQueueStatus();
        break;

      case 'purge':
        await orchestrator.purgeAllQueues();
        break;

      case 'queue':
        const [_, entityType, entityId] = args;
        if (!entityType || !entityId) {
          console.error('Usage: npm run orchestrator queue <alliance|corporation|character> <id>');
          process.exit(1);
        }
        await orchestrator.queueEntity(entityType as any, parseInt(entityId));
        break;

      default:
        console.log('ESI Sync Orchestrator');
        console.log('=====================\n');
        console.log('Usage:');
        console.log('  npm run orchestrator sync-alliances     - Sync all alliances');
        console.log('  npm run orchestrator sync-corporations  - Sync all corporations');
        console.log('  npm run orchestrator sync-characters    - Sync all characters');
        console.log('  npm run orchestrator sync-all           - Sync everything');
        console.log('  npm run orchestrator status             - Show queue status');
        console.log('  npm run orchestrator purge              - Purge all queues');
        console.log('  npm run orchestrator queue <type> <id>  - Queue single entity\n');
        process.exit(0);
    }

    await orchestrator.showQueueStatus();
    await rabbitmqService.close();
    await pool.end();

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    await rabbitmqService.close();
    await pool.end();
    process.exit(1);
  }
}

main();
