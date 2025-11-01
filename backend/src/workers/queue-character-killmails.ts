import '../config';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'killmail_sync_queue';

/**
 * Queue specific character IDs for killmail sync
 * Usage: yarn queue:character <characterId1> <characterId2> ...
 *
 * This allows you to sync killmails for ANY character from zKillboard,
 * not just logged-in users. No authentication required.
 *
 * Examples:
 *   yarn queue:character 95465499                    # Single character
 *   yarn queue:character 95465499 123456 789012     # Multiple characters
 */
async function queueSpecificCharacters() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('❌ Usage: yarn queue:character <characterId1> <characterId2> ...');
    console.log('\n📝 Examples:');
    console.log('  yarn queue:character 95465499');
    console.log('  yarn queue:character 95465499 123456789 987654321');
    console.log('\n💡 Then start the worker:');
    console.log('  yarn worker:killmails\n');
    process.exit(1);
  }

  console.log('📡 Queueing specific characters for killmail sync...\n');

  try {
    const channel = await getRabbitMQChannel();
    let successCount = 0;
    let errorCount = 0;

    for (const arg of args) {
      const characterId = parseInt(arg);

      if (isNaN(characterId)) {
        console.log(`⚠️  Skipping invalid ID: ${arg}`);
        errorCount++;
        continue;
      }

      const message = {
        userId: null, // No user ID for external characters
        characterId: characterId,
        characterName: `Character_${characterId}`, // Will be resolved from ESI later
        queuedAt: new Date().toISOString(),
      };

      channel.sendToQueue(
        QUEUE_NAME,
        Buffer.from(JSON.stringify(message)),
        { persistent: true }
      );

      console.log(`  ✓ Queued character ID: ${characterId}`);
      successCount++;
    }

    console.log(`\n✅ Successfully queued ${successCount} character(s)`);
    if (errorCount > 0) {
      console.log(`⚠️  Skipped ${errorCount} invalid ID(s)`);
    }
    console.log(`\n💡 Now run the worker to process them:`);
    console.log(`   yarn worker:killmails\n`);

    await channel.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to queue characters:', error);
    process.exit(1);
  }
}

queueSpecificCharacters();
