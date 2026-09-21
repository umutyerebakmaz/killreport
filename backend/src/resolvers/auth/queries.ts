import { QueryResolvers } from '@generated-types';
import prisma from '@services/prisma';
import { listSessions, resolveSession } from '@services/session-store';
import { GraphQLError } from 'graphql';

/**
 * Auth Query Resolvers
 * Handles authentication-related queries
 */
export const authQueries: QueryResolvers = {
  me: async (_parent, _args, context: any) => {
    if (!context.user) {
      throw new Error('Not authenticated');
    }

    // Get user info from database
    const user = await prisma.user.findUnique({
      where: { character_id: context.user.characterId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: user.character_id.toString(),
      name: user.character_name,
      email: user.email || '',
      createdAt: user.created_at.toISOString(),
    };
  },

  mySessions: async (_parent, _args, context: any) => {
    const session = await resolveSession(context.sessionToken);
    if (!session) {
      throw new GraphQLError('Not authenticated', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const rows = await listSessions(session.userId);

    return rows.map((row) => ({
      id: row.id,
      createdAt: row.created_at.toISOString(),
      lastSeenAt: row.last_seen_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
      userAgent: row.user_agent,
      ip: row.ip,
      current: row.id === session.id,
    }));
  },
};
