import logger from '../services/logger';
import prisma from '../services/prisma';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'esi_item_group_info_queue';

/**
 * Scans types table and queues missing item groups
 * This ensures all types have their group information available
 */
async function queueMissingGroups() {
    logger.info('Scanning for missing item groups...');

    try {
        // Get all unique group_ids from types table
        const typesWithGroups = await prisma.type.findMany({
            select: { group_id: true },
            distinct: ['group_id'],
        });

        const uniqueGroupIds = typesWithGroups.map((t) => t.group_id);
        logger.info(`Found ${uniqueGroupIds.length} unique group IDs in types table`);

        // Get existing item groups
        const existingGroups = await prisma.itemGroup.findMany({
            select: { id: true },
        });

        const existingGroupIds = new Set(existingGroups.map((g) => g.id));
        logger.info(`Found ${existingGroupIds.size} existing item groups in database`);

        // Find missing group IDs
        const missingGroupIds = uniqueGroupIds.filter((id) => !existingGroupIds.has(id));

        logger.info(`Missing Groups: ${missingGroupIds.length}`);

        if (missingGroupIds.length === 0) {
            logger.info('All item groups are already in database!');
            process.exit(0);
        }

        logger.debug('Missing group IDs: ' + missingGroupIds.sort((a, b) => a - b).join(', '));

        // Queue missing groups
        const channel = await getRabbitMQChannel();

        await channel.assertQueue(QUEUE_NAME, {
            durable: true,
            arguments: { 'x-max-priority': 10 },
        });

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

        logger.info(`Queued ${queuedCount} missing item groups`);
        logger.info('Next Steps:');
        logger.info('  1. Start the item group worker: yarn worker:info:item-groups');
        logger.info('  2. Worker will fetch missing groups from ESI and save to database');

        await channel.close();
        process.exit(0);
    } catch (error) {
        logger.error('Error', { error });
        process.exit(1);
    }
}

// Run
queueMissingGroups();
