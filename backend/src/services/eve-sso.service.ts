import axios from 'axios';
import crypto from 'crypto';
import {
  EveTokenResponse,
  EveVerifyResponse,
  EveCharacterPublicInfo,
  EveKillmail,
} from '../types/eve.types';

/**
 * EVE Online SSO Service
 * Handles OAuth2 authentication flow and ESI API calls
 */
export class EveSsoService {
  private readonly CLIENT_ID = process.env.EVE_CLIENT_ID || '';
  private readonly CLIENT_SECRET = process.env.EVE_CLIENT_SECRET || '';
  private readonly SSO_BASE_URL = 'https://login.eveonline.com';
  private readonly ESI_BASE_URL = 'https://esi.evetech.net/latest';
  
  // Default scopes for killmail access
  private readonly SCOPES = [
    'esi-killmails.read_killmails.v1',
    'esi-killmails.read_corporation_killmails.v1',
    'publicData',
  ].join(' ');

  /**
   * Generate OAuth2 authorization URL for EVE SSO login
   */
  generateLoginUrl(redirectUri: string): { url: string; state: string } {
    const state = crypto.randomBytes(16).toString('hex');
    
    const params = new URLSearchParams({
      response_type: 'code',
      redirect_uri: redirectUri,
      client_id: this.CLIENT_ID,
      scope: this.SCOPES,
      state: state,
    });

    const url = `${this.SSO_BASE_URL}/v2/oauth/authorize?${params.toString()}`;
    
    return { url, state };
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<EveTokenResponse> {
    const auth = Buffer.from(`${this.CLIENT_ID}:${this.CLIENT_SECRET}`).toString('base64');
    
    const response = await axios.post<EveTokenResponse>(
      `${this.SSO_BASE_URL}/v2/oauth/token`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }),
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Host': 'login.eveonline.com',
        },
      }
    );

    return response.data;
  }

  /**
   * Verify access token and get character information
   */
  async verifyToken(accessToken: string): Promise<EveVerifyResponse> {
    const response = await axios.get<EveVerifyResponse>(
      `${this.SSO_BASE_URL}/oauth/verify`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    return response.data;
  }

  /**
   * Get character public information from ESI
   */
  async getCharacterPublicInfo(characterId: number): Promise<EveCharacterPublicInfo> {
    const response = await axios.get<EveCharacterPublicInfo>(
      `${this.ESI_BASE_URL}/characters/${characterId}/`,
      {
        headers: {
          'User-Agent': 'killreport-backend/0.1.0',
        },
      }
    );

    return response.data;
  }

  /**
   * Get character's recent killmails from ESI
   */
  async getCharacterKillmails(
    characterId: number,
    accessToken: string,
    page: number = 1
  ): Promise<Array<{ killmail_id: number; killmail_hash: string }>> {
    const response = await axios.get(
      `${this.ESI_BASE_URL}/characters/${characterId}/killmails/recent/`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'killreport-backend/0.1.0',
        },
        params: {
          page,
        },
      }
    );

    return response.data;
  }

  /**
   * Get killmail details from ESI
   */
  async getKillmailDetails(
    killmailId: number,
    killmailHash: string
  ): Promise<EveKillmail> {
    const response = await axios.get<EveKillmail>(
      `${this.ESI_BASE_URL}/killmails/${killmailId}/${killmailHash}/`,
      {
        headers: {
          'User-Agent': 'killreport-backend/0.1.0',
        },
      }
    );

    return response.data;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<EveTokenResponse> {
    const auth = Buffer.from(`${this.CLIENT_ID}:${this.CLIENT_SECRET}`).toString('base64');
    
    const response = await axios.post<EveTokenResponse>(
      `${this.SSO_BASE_URL}/v2/oauth/token`,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Host': 'login.eveonline.com',
        },
      }
    );

    return response.data;
  }
}

// Export singleton instance
export const eveSsoService = new EveSsoService();
