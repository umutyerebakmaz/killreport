/**
 * Discord Webhook Management Service
 *
 * Lets a logged-in user connect, list and remove Discord webhooks. Per-user
 * data, so it is never cached. The webhook URL is a secret: it is stored but
 * never appears in a view, an error message or a log line.
 */

import type { TrackedEntityType } from '@generated/prisma/client';
import prisma from '@services/prisma';
import { getWebhookName, postWebhook } from './discord-client';
import { normalizeWebhookUrl, WEBHOOK_LIMIT } from './discord-webhook.helpers';

export class DiscordWebhookError extends Error {
  constructor(
    public code:
      | 'USER_NOT_FOUND'
      | 'INVALID_URL'
      | 'NOT_FOUND'
      | 'WEBHOOK_NOT_FOUND'
      | 'LIMIT'
      | 'TEST_FAILED',
    message: string,
  ) {
    super(message);
    this.name = 'DiscordWebhookError';
  }
}

export type DiscordWebhookView = {
  entityType: TrackedEntityType;
  entityId: number;
  name: string | null;
  disabled: boolean;
  createdAt: string;
};

type WebhookRow = {
  entity_type: TrackedEntityType;
  entity_id: number;
  name: string | null;
  disabled_at: Date | null;
  created_at: Date;
};

function toView(row: WebhookRow): DiscordWebhookView {
  return {
    entityType: row.entity_type,
    entityId: row.entity_id,
    name: row.name,
    disabled: row.disabled_at !== null,
    createdAt: row.created_at.toISOString(),
  };
}

async function findUser(characterId: number) {
  return prisma.user.findUnique({ where: { character_id: characterId } });
}

/** The entity's display name, or null when it does not exist. */
async function findEntityName(
  type: TrackedEntityType,
  id: number,
): Promise<string | null> {
  switch (type) {
    case 'CHARACTER':
      return (
        (await prisma.character.findUnique({ where: { id } }))?.name ?? null
      );
    case 'CORPORATION':
      return (
        (await prisma.corporation.findUnique({ where: { id } }))?.name ?? null
      );
    case 'ALLIANCE':
      return (
        (await prisma.alliance.findUnique({ where: { id } }))?.name ?? null
      );
  }
}

export async function listWebhooks(
  characterId: number,
): Promise<DiscordWebhookView[]> {
  const user = await findUser(characterId);
  if (!user) return [];
  const rows = await prisma.discordWebhook.findMany({
    where: { user_id: user.id },
    orderBy: { created_at: 'asc' },
  });
  return rows.map(toView);
}

export async function setWebhook(
  characterId: number,
  type: TrackedEntityType,
  id: number,
  rawUrl: string,
): Promise<DiscordWebhookView> {
  const url = normalizeWebhookUrl(rawUrl);
  if (!url) {
    throw new DiscordWebhookError('INVALID_URL', 'Not a Discord webhook URL');
  }
  const user = await findUser(characterId);
  if (!user) throw new DiscordWebhookError('USER_NOT_FOUND', 'User not found');

  const entityName = await findEntityName(type, id);
  if (entityName === null) {
    throw new DiscordWebhookError('NOT_FOUND', `${type} ${id} not found`);
  }

  const key = {
    user_id_entity_type_entity_id: {
      user_id: user.id,
      entity_type: type,
      entity_id: id,
    },
  };
  const existing = await prisma.discordWebhook.findUnique({ where: key });
  if (!existing) {
    const count = await prisma.discordWebhook.count({
      where: { user_id: user.id },
    });
    if (count >= WEBHOOK_LIMIT) {
      throw new DiscordWebhookError(
        'LIMIT',
        `Discord webhooks are limited to ${WEBHOOK_LIMIT}`,
      );
    }
  }

  const lookup = await getWebhookName(url);
  if (!lookup.found) {
    throw new DiscordWebhookError('WEBHOOK_NOT_FOUND', 'Webhook not found');
  }

  const result = await postWebhook(url, {
    content: `KillReport will post ${entityName} kills and losses to this channel.`,
  });
  if (result.outcome !== 'ok') {
    throw new DiscordWebhookError(
      'TEST_FAILED',
      'Discord did not accept the test message',
    );
  }

  const now = new Date();
  const row = await prisma.discordWebhook.upsert({
    where: key,
    create: {
      user_id: user.id,
      entity_type: type,
      entity_id: id,
      url,
      name: lookup.name,
      active_since: now,
    },
    update: {
      url,
      name: lookup.name,
      disabled_at: null,
      active_since: now,
    },
  });
  return toView(row);
}

export async function removeWebhook(
  characterId: number,
  type: TrackedEntityType,
  id: number,
): Promise<void> {
  const user = await findUser(characterId);
  if (!user) return;
  await prisma.discordWebhook.deleteMany({
    where: { user_id: user.id, entity_type: type, entity_id: id },
  });
}
