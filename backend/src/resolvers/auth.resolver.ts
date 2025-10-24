import { QueryResolvers, MutationResolvers } from '../generated-types';
import { eveSsoService } from '../services/eve-sso.service';

/**
 * Auth Query Resolvers
 */
export const authQueries: QueryResolvers = {
  /**
   * Generate EVE Online SSO login URL
   */
  eveLoginUrl: async (_, { redirectUri }) => {
    const { url, state } = eveSsoService.generateLoginUrl(redirectUri);
    return {
      url,
      state,
    };
  },
};

/**
 * Auth Mutation Resolvers
 */
export const authMutations: MutationResolvers = {
  /**
   * Handle EVE Online SSO callback and authenticate user
   */
  eveCallback: async (_, { code, state, redirectUri }) => {
    try {
      // Exchange authorization code for access token
      const tokenResponse = await eveSsoService.exchangeCodeForToken(code, redirectUri);

      // Verify the token and get character info
      const verifyResponse = await eveSsoService.verifyToken(tokenResponse.access_token);

      // Get additional character public information
      const characterInfo = await eveSsoService.getCharacterPublicInfo(
        verifyResponse.CharacterID
      );

      // Return authentication response
      return {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresIn: tokenResponse.expires_in,
        character: {
          characterId: verifyResponse.CharacterID.toString(),
          characterName: verifyResponse.CharacterName,
          characterOwnerHash: verifyResponse.CharacterOwnerHash,
          corporationId: characterInfo.corporation_id?.toString() || null,
          allianceId: characterInfo.alliance_id?.toString() || null,
        },
      };
    } catch (error) {
      console.error('EVE SSO callback error:', error);
      throw new Error(`EVE SSO authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
};
