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

        let typeId: number | undefined;

        try {
          const message: EntityQueueMessage = JSON.parse(msg.content.toString());
          typeId = message.entityId;
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
            if (totalProcessed % 100 === 0) {
              logger.info(`  📊 Progress: ${totalProcessed} processed (${totalAdded} synced, ${totalSkipped} skipped)`);
            }
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
            if (totalProcessed % 100 === 0) {
              logger.info(`  📊 Progress: ${totalProcessed} processed (${totalAdded} synced, ${totalSkipped} skipped)`);
            }
            return;
          }

          // Use transaction for atomicity - both succeed or both fail
          const { insertedAttributeCount, insertedEffectCount } = await prismaWorker.$transaction(async (tx: any) => {
            // Delete existing data first
            await tx.typeDogmaAttribute.deleteMany({
              where: { type_id: typeId },
            });
            await tx.typeDogmaEffect.deleteMany({
              where: { type_id: typeId },
            });

            // Insert new attributes
            let insertedAttributeCount = 0;
            if (dogmaAttributes.length > 0) {
              // Filter only attributes that exist in dogma_attributes table
              const existingAttributes = await tx.dogmaAttribute.findMany({
                where: {
                  id: { in: dogmaAttributes.map((a: any) => a.attribute_id) },
                },
                select: { id: true },
              });
              const validAttributeIds = new Set(existingAttributes.map((a: any) => a.id));

              const validAttributes = dogmaAttributes.filter((attr: any) =>
                validAttributeIds.has(attr.attribute_id)
              );

              // Log missing attributes
              const missingAttributes = dogmaAttributes.filter((attr: any) =>
                !validAttributeIds.has(attr.attribute_id)
              );
              if (missingAttributes.length > 0) {
                logger.warn(`⚠️  [${typeId}] ${typeName}: ${missingAttributes.length} missing attributes: ${missingAttributes.map((a: any) => a.attribute_id).join(', ')}`);
              }

              if (validAttributes.length > 0) {
                await tx.typeDogmaAttribute.createMany({
                  data: validAttributes.map((attr: any) => ({
                    type_id: typeId,
                    attribute_id: attr.attribute_id,
                    value: attr.value,
                  })),
                  skipDuplicates: true,
                });
                insertedAttributeCount = validAttributes.length;
              }
            }

            // Insert new effects
            let insertedEffectCount = 0;
            if (dogmaEffects.length > 0) {
              // Filter only effects that exist in dogma_effects table
              const existingEffects = await tx.dogmaEffect.findMany({
                where: {
                  id: { in: dogmaEffects.map((e: any) => e.effect_id) },
                },
                select: { id: true },
              });
              const validEffectIds = new Set(existingEffects.map((e: any) => e.id));

              const validEffects = dogmaEffects.filter((eff: any) =>
                validEffectIds.has(eff.effect_id)
              );

              // Log missing effects
              const missingEffects = dogmaEffects.filter((eff: any) =>
                !validEffectIds.has(eff.effect_id)
              );
              if (missingEffects.length > 0) {
                logger.warn(`⚠️  [${typeId}] ${typeName}: ${missingEffects.length} missing effects: ${missingEffects.map((e: any) => e.effect_id).join(', ')}`);
              }

              if (validEffects.length > 0) {
                await tx.typeDogmaEffect.createMany({
                  data: validEffects.map((eff: any) => ({
                    type_id: typeId,
                    effect_id: eff.effect_id,
                    is_default: eff.is_default,
                  })),
                  skipDuplicates: true,
                });
                insertedEffectCount = validEffects.length;
              }
            }
            return { insertedAttributeCount, insertedEffectCount };
          });

          channel.ack(msg);
          totalAdded++;
          totalProcessed++;
          logger.info(
            `✓ [${totalProcessed}] [${typeId}] ${typeName}: ${insertedAttributeCount}/${dogmaAttributes.length} attrs, ${insertedEffectCount}/${dogmaEffects.length} effects`
          );
        } catch (error: any) {
          logger.error(`❌ Error processing type ${typeId || 'unknown'}:`, error.message || error);
          channel.nack(msg, false, false); // Don't requeue
          totalErrors++;
          totalProcessed++;
        }
      },
      { noAck: false }
    );

    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('\n🛑 Shutting down gracefully...');
      clearInterval(emptyCheckInterval);
      await channel.close();
      await prismaWorker.$disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('\n🛑 Shutting down gracefully...');
      clearInterval(emptyCheckInterval);
      await channel.close();
      await prismaWorker.$disconnect();
      process.exit(0);
    });
  } catch (error) {
    logger.error('❌ Fatal error in Type Dogma Worker:', error);
    process.exit(1);
  }
}

typeDogmaWorker().catch((error) => {
  logger.error('❌ Unhandled error:', error);
  process.exit(1);
});
