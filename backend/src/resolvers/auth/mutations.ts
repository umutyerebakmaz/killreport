import { config } from '@config/config';
import { MutationResolvers } from '@generated-types';
import { createAuthState, sanitizeReturnTo } from '@services/auth-state-store';
import { getAuthUrl } from '@services/eve-sso';
import prisma from '@services/prisma';
import {
  clearSessionCookie,
  serializeSessionCookie,
} from '@services/session-cookie';
import {
  resolveSession,
  revokeSessionById,
  revokeSessionByToken,
} from '@services/session-store';
import { loadUserCredentials } from '@services/user-credentials';
import { GraphQLError } from 'graphql';

/**
 * Auth Mutation Resolvers
 * Handles authentication operations (login, session renewal, logout)
 */
export const authMutations: MutationResolvers = {
  login: async (_parent, args) => {
    // The state is minted by the store, not here, so that every value handed
    // to EVE is one the callback can later recognise. It doubles as the memory
    // of where the user was when they pressed LOGIN.
    const state = await createAuthState(sanitizeReturnTo(args.returnTo));
    const url = await getAuthUrl(state);

    return {
      url,
      state,
    } as any;
  },

  refreshSession: async (_parent, _args, context: any) => {
    const session = await resolveSession(context.sessionToken);
    if (!session) {
      throw new GraphQLError('Not authenticated', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const credentials = await loadUserCredentials(session.userId, prisma);
    if (!credentials.ok) {
      throw new GraphQLError('Not authenticated', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // The value does not change; only its lifetime, so the browser's copy
    // slides in step with the row.
    context.setCookies.push(
      serializeSessionCookie(context.sessionToken, {
        secure: config.app.isProduction,
      }),
    );

    const { user, accessToken } = credentials;

    return {
      accessToken,
      expiresIn: Math.max(
        0,
        Math.floor((credentials.expiresAt.getTime() - Date.now()) / 1000),
      ),
      user: {
        id: user.character_id.toString(),
        name: user.character_name,
        email: user.email || '',
        createdAt: user.created_at.toISOString(),
      },
    } as any;
  },

  logout: async (_parent, _args, context: any) => {
    if (context.sessionToken) {
      await revokeSessionByToken(context.sessionToken);
    }

    context.setCookies.push(
      clearSessionCookie({ secure: config.app.isProduction }),
    );

    return true;
  },

  revokeSession: async (_parent, { id }: { id: string }, context: any) => {
    const session = await resolveSession(context.sessionToken);
    if (!session) {
      throw new GraphQLError('Not authenticated', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    return revokeSessionById(id, session.userId);
  },
};
