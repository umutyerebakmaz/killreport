/**
 * Type Dogma Worker
 * Fetches dogma attributes and effects for types from ESI and saves to database
 */

import '../config';
import logger from '../services/logger';
import prismaWorker from '../services/prisma-worker';
import { getRabbitMQChannel } from '../services/rabbitmq';
import { TypeService } from '../services/type';

const QUEUE_NAME = 'esi_type_dogma_queue';
const PREFETCH_COUNT = 10; // Process 10 types concurrently (ESI rate limit friendly)

interface EntityQueueMessage {
  entityId: number;
  queuedAt: string;
  source: string;
}

async function typeDogmaWorker() {
  logger.info('🔬 Type Dogma Worker Started');
  logger.info(`📦 Queue: ${QUEUE_NAME}`);
  logger.info(`⚡ Prefetch: ${PREFETCH_COUNT} concurrent\n`);

  try {
    const channel = await getRabbitMQChannel();

    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
      arguments: { 'x-max-priority': 10 },
    });

    channel.prefetch(PREFETCH_COUNT);

    logger.info('✅ Connected to RabbitMQ');
    logger.info('⏳ Waiting for types...\n');

    let totalProcessed = 0;
    let totalAdded = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let lastMessageTime = Date.now();

    // Check if queue is empty every 5 seconds
    const emptyCheckInterval = setInterval(async () => {
      const timeSinceLastMessage = Date.now() - lastMessageTime;
      if (timeSinceLastMessage > 5000 && totalProcessed > 0) {
        logger.info('\n' + '━'.repeat(60));
        logger.info('✅ Queue completed!');
        logger.info(
          `📊 Final: ${totalProcessed} processed (${totalAdded} synced, ${totalSkipped} skipped, ${totalErrors} errors)`
        );
        logger.info('━'.repeat(60) + '\n');
        logger.info('⏳ Waiting for new messages...\n');
      }
    }, 5000);

    channel.consume(
      QUEUE_NAME,
      async (msg) => {
        if (msg) lastMessageTime = Date.now();
        if (!msg) return;

        const message: EntityQueueMessage = JSON.parse(msg.content.toString());
        const typeId = message.entityId;

        try {
          // Check if type exists and get name
          const typeInfo = await prismaWorker.type.findUnique({
            where: { id: typeId },
            select: { id: true, name: true },
          });

          if (!typeInfo) {
            logger.warn(`⚠️  Type ${typeId} not found in database, skipping`);
            channel.ack(msg);
            totalSkipped++;
            totalProcessed++;
            return;
          }

          const typeName = typeInfo.name;

          // Check if dogma data already exists for this type
          const existingDogma = await prismaWorker.typeDogmaAttribute.findFirst({
            where: { type_id: typeId },
          });

          if (existingDogma) {
            // Already synced, skip
            channel.ack(msg);
            totalSkipped++;
            totalProcessed++;
            logger.info(`  - [${totalProcessed}] [${typeId}] ${typeName} (already synced)`);
            return;
          }

          // Fetch type details from ESI (includes dogma data)
          const typeData = await TypeService.getTypeInfo(typeId);

          // Process dogma attributes
          const dogmaAttributes = typeData.dogma_attributes || [];
          const dogmaEffects = typeData.dogma_effects || [];

          if (dogmaAttributes.length === 0 && dogmaEffects.length === 0) {
            // Type has no dogma data, skip
            channel.ack(msg);
            totalSkipped++;
            totalProcessed++;
            logger.info(`  - [${totalProcessed}] [${typeId}] ${typeName} (no dogma data)`);
            return;
          }

          // Save attributes to database - DELETE + INSERT for better performance
          let attributeCount = 0;
          if (dogmaAttributes.length > 0) {
            // Delete existing attributes for this type, then insert new ones
            await prismaWorker.typeDogmaAttribute.deleteMany({
              where: { type_id: typeId },
            });

            await prismaWorker.typeDogmaAttribute.createMany({
              data: dogmaAttributes.map((attr: any) => ({
                type_id: typeId,
                attribute_id: attr.attribute_id,
                value: attr.value,
              })),
              skipDuplicates: true,
            });
            attributeCount = dogmaAttributes.length;
          }

          // Save effects to database - DELETE + INSERT for better performance
          let effectCount = 0;
          if (dogmaEffects.length > 0) {
            // Delete existing effects for this type, then insert new ones
            await prismaWorker.typeDogmaEffect.deleteMany({
              where: { type_id: typeId },
            });

            await prismaWorker.typeDogmaEffect.createMany({
              data: dogmaEffects.map((eff: any) => ({
                type_id: typeId,
                effect_id: eff.effect_id,
                is_default: eff.is_default,
              })),
              skipDuplicates: true,
            });
            effectCount = dogmaEffects.length;
          }

          channel.ack(msg);
          totalAdded++;
          totalProcessed++;
          logger.info(
            `✓ [${totalProcessed}] [${typeId}] ${typeName}: ${attributeCount} attrs, ${effectCount} effects`
          );
        } catch (error: any) {
          logger.error(`❌ Error processing type ${typeId}:`, error);
          channel.nack(msg, false, false); // Don't requeue
          totalErrors++;
          totalProcessed++;
        }
      },
      { noAck: false }
    );
  } catch (error) {
    logger.error('❌ Fatal error in Type Dogma Worker:', error);
    process.exit(1);
  }
}

typeDogmaWorker().catch((error) => {
  logger.error('❌ Unhandled error:', error);
  process.exit(1);
});
