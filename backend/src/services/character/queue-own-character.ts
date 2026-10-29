import logger from '@services/logger';
import prisma from '@services/prisma';
import { getRabbitMQChannel } from '@services/rabbitmq';

/**
 * Queue the logged-in user's own character for ESI enrichment when it is not
 * in the characters table yet. Never throws: login must not fail because of it.
 */
export async function queueOwnCharacterIfMissing(
  characterId: number,
): Promise<void> {
  try {
    const existing = await prisma.character.findUnique({
      where: { id: characterId },
      select: { id: true },
    });
    if (existing) return;

    const channel = await getRabbitMQChannel();
    const message = {
      entityId: characterId,
      queuedAt: new Date().toISOString(),
      source: 'login',
    };
    channel.sendToQueue(
      'esi_character_info_queue',
      Buffer.from(JSON.stringify(message)),
      { persistent: true },
    );
    logger.info(`character ${characterId} queued for enrichment on login`);
  } catch (error) {
    logger.error(`failed to queue character ${characterId} on login`, {
      error,
    });
  }
}
