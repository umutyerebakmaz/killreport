import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { ensureAllQueuesExist, getRabbitMQChannel } from '@services/rabbitmq';

const QUEUE_NAME = 'esi_item_group_info_queue';

/**
 * Scans types table and queues missing item groups
 * This ensures all types have their group information available
 */
async function queueMissingGroups() {
  logger.info('scanning for missing item groups...');

  try {
    // Get all unique group_ids from types table
    const typesWithGroups = await prismaWorker.type.findMany({
      select: { group_id: true },
      distinct: ['group_id'],
    });

    const uniqueGroupIds = typesWithGroups.map(
      (t: { group_id: number }) => t.group_id,
    );
    logger.info(
      `found ${uniqueGroupIds.length} unique group IDs in types table`,
    );

    // Get existing item groups
    const existingGroups = await prismaWorker.itemGroup.findMany({
      select: { id: true },
    });

    const existingGroupIds = new Set(
      existingGroups.map((g: { id: number }) => g.id),
    );
    logger.info(
      `found ${existingGroupIds.size} existing item groups in database`,
    );

    // Find missing group IDs
    const missingGroupIds = uniqueGroupIds.filter(
      (id: number) => !existingGroupIds.has(id),
    );

    logger.info(`missing groups: ${missingGroupIds.length}`);

    if (missingGroupIds.length === 0) {
      logger.info('all item groups are already in database!');
      process.exit(0);
    }

    logger.debug(
      'missing group IDs: ' +
        missingGroupIds.sort((a: number, b: number) => a - b).join(', '),
    );

    // Queue missing groups
    await ensureAllQueuesExist();
    const channel = await getRabbitMQChannel();

    let queuedCount = 0;
    for (const groupId of missingGroupIds) {
      const message = {
        entityId: groupId,
        queuedAt: new Date().toISOString(),
        source: 'queueMissingGroups',
      };

      channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
        persistent: true,
        priority: 5, // Medium priority
      });

      queuedCount++;
    }

    logger.info(`queued ${queuedCount} missing item groups`);
    logger.info('next steps:');
    logger.info(
      '  1. start the item group worker: yarn worker:info:item-groups',
    );
    logger.info(
      '  2. worker will fetch missing groups from ESI and save to database',
    );

    await channel.close();
    process.exit(0);
  } catch (error) {
    logger.error('error', { error });
    process.exit(1);
  }
}

// Run
queueMissingGroups();
