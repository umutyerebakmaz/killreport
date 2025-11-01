import { randomUUID } from 'crypto';
import { MutationResolvers, QueryResolvers } from '../generated-types';
import {
  exchangeCodeForToken,
  getAuthUrl,
  refreshAccessToken,
  verifyToken,
} from '../services/eve-sso';
import prisma from '../services/prisma';

// Query Resolvers
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
};

// Mutation Resolvers
export const authMutations: MutationResolvers = {
  login: async () => {
    const state = randomUUID();
    const url = await getAuthUrl(state);

    return {
      url,
      state,
    } as any;
  },

  authenticateWithCode: async (_parent: any, { code, state }: any) => {
    try {
      // Exchange authorization code for token
      const tokenData = await exchangeCodeForToken(code);

      // Verify token and get character info
      const character = await verifyToken(tokenData.access_token);

      // Calculate token expiry time
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

      // Find or create user in database
      const user = await prisma.user.upsert({
        where: { character_id: character.characterId },
        update: {
          character_name: character.characterName,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: expiresAt,
        },
        create: {
          character_id: character.characterId,
          character_name: character.characterName,
          character_owner_hash: character.characterOwnerHash,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: expiresAt,
        },
      });

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        user: {
          id: user.character_id.toString(),
          name: user.character_name,
          email: user.email || '',
          createdAt: user.created_at.toISOString(),
        },
      } as any;
    } catch (error) {
      console.error('Authentication error:', error);
      throw new Error('Authentication failed');
    }
  },

  refreshToken: async (_parent: any, { refreshToken }: any) => {
    try {
      // Get new access token with refresh token
      const tokenData = await refreshAccessToken(refreshToken);

      // Verify new token and get character info
      const character = await verifyToken(tokenData.access_token);

      // Calculate token expiry time
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

      // Update user in database
      const user = await prisma.user.update({
        where: { character_id: character.characterId },
        data: {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: expiresAt,
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        user: {
          id: user.character_id.toString(),
          name: user.character_name,
          email: user.email || '',
          createdAt: user.created_at.toISOString(),
        },
      } as any;
    } catch (error) {
      console.error('Token refresh error:', error);
      throw new Error('Token refresh failed');
    }
  },
};
