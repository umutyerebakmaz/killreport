/**
 * Tracker Service
 *
 * A logged-in user's shortcut list of characters, corporations and alliances.
 * Per-user data, so it is never cached.
 */

import type { TrackedEntityType } from '@generated/prisma/client';
import prisma from '@services/prisma';

export const TRACKER_LIMIT = 200;

export type TrackerRef = {
  type: TrackedEntityType;
  id: number;
  automatic: boolean;
};

export class TrackerError extends Error {
  constructor(
    public code: 'USER_NOT_FOUND' | 'SELF' | 'NOT_FOUND' | 'LIMIT',
    message: string,
  ) {
    super(message);
    this.name = 'TrackerError';
  }
}

async function findUser(characterId: number) {
  return prisma.user.findUnique({ where: { character_id: characterId } });
}

async function entityExists(
  type: TrackedEntityType,
  id: number,
): Promise<boolean> {
  switch (type) {
    case 'CHARACTER':
      return !!(await prisma.character.findUnique({ where: { id } }));
    case 'CORPORATION':
      return !!(await prisma.corporation.findUnique({ where: { id } }));
    case 'ALLIANCE':
      return !!(await prisma.alliance.findUnique({ where: { id } }));
  }
}

/**
 * Automatic refs (own corporation, own alliance) plus manual ones.
 * Each (type, id) appears once; the automatic one wins.
 */
export async function getTrackerRefs(
  characterId: number,
): Promise<TrackerRef[]> {
  const user = await findUser(characterId);
  const [character, manual] = await Promise.all([
    prisma.character.findUnique({ where: { id: characterId } }),
    user
      ? prisma.trackedEntity.findMany({
          where: { user_id: user.id },
          orderBy: { created_at: 'asc' },
        })
      : Promise.resolve([]),
  ]);

  const refs = new Map<string, TrackerRef>();
  const put = (ref: TrackerRef) => {
    const key = `${ref.type}:${ref.id}`;
    if (!refs.has(key) || ref.automatic) refs.set(key, ref);
  };

  if (character) {
    put({ type: 'CORPORATION', id: character.corporation_id, automatic: true });
    if (character.alliance_id != null) {
      put({ type: 'ALLIANCE', id: character.alliance_id, automatic: true });
    }
  }
  for (const m of manual) {
    put({ type: m.entity_type, id: m.entity_id, automatic: false });
  }
  return [...refs.values()];
}

export async function trackEntity(
  characterId: number,
  type: TrackedEntityType,
  id: number,
): Promise<void> {
  const user = await findUser(characterId);
  if (!user) throw new TrackerError('USER_NOT_FOUND', 'User not found');
  if (type === 'CHARACTER' && id === characterId) {
    throw new TrackerError('SELF', 'You cannot track your own character');
  }
  if (!(await entityExists(type, id))) {
    throw new TrackerError('NOT_FOUND', `${type} ${id} not found`);
  }

  const existing = await prisma.trackedEntity.findUnique({
    where: {
      user_id_entity_type_entity_id: {
        user_id: user.id,
        entity_type: type,
        entity_id: id,
      },
    },
  });
  if (existing) return;

  const count = await prisma.trackedEntity.count({
    where: { user_id: user.id },
  });
  if (count >= TRACKER_LIMIT) {
    throw new TrackerError(
      'LIMIT',
      `Tracker is limited to ${TRACKER_LIMIT} entries`,
    );
  }

  await prisma.trackedEntity.create({
    data: { user_id: user.id, entity_type: type, entity_id: id },
  });
}

export async function untrackEntity(
  characterId: number,
  type: TrackedEntityType,
  id: number,
): Promise<void> {
  const user = await findUser(characterId);
  if (!user) return;
  await prisma.trackedEntity.deleteMany({
    where: { user_id: user.id, entity_type: type, entity_id: id },
  });
}
