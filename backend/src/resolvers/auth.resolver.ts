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

    // Database'den user bilgilerini al
    const user = await prisma.user.findUnique({
      where: { id: context.user.characterId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: user.id.toString(),
      name: user.name,
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
      // Authorization code'u token ile değiştir
      const tokenData = await exchangeCodeForToken(code);

      // Token'ı doğrula ve character bilgilerini al
      const character = await verifyToken(tokenData.access_token);

      // User'ı database'de bul veya oluştur
      const user = await prisma.user.upsert({
        where: { id: character.characterId },
        update: {
          name: character.characterName,
        },
        create: {
          id: character.characterId,
          name: character.characterName,
          email: `${character.characterId}@eveonline.com`, // Eve'de email yok, placeholder
        },
      });

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        user: {
          id: user.id.toString(),
          name: user.name,
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
      // Refresh token ile yeni access token al
      const tokenData = await refreshAccessToken(refreshToken);

      // Yeni token'ı doğrula ve character bilgilerini al
      const character = await verifyToken(tokenData.access_token);

      // User'ı database'den al
      const user = await prisma.user.findUnique({
        where: { id: character.characterId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        user: {
          id: user.id.toString(),
          name: user.name,
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
