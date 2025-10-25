import { esiRateLimiter } from './esi-rate-limiter';

const ESI_BASE_URL = 'https://esi.evetech.net/latest';

export interface AllianceData {
  creator_corporation_id: number;
  creator_id: number;
  date_founded: string;
  executor_corporation_id: number;
  faction_id?: number;
  name: string;
  ticker: string;
}

export interface CorporationData {
  alliance_id?: number;
  ceo_id: number;
  creator_id: number;
  date_founded?: string;
  description?: string;
  faction_id?: number;
  home_station_id?: number;
  member_count: number;
  name: string;
  shares?: number;
  tax_rate: number;
  ticker: string;
  url?: string;
}

export interface CharacterData {
  alliance_id?: number;
  birthday: string;
  bloodline_id: number;
  corporation_id: number;
  description?: string;
  faction_id?: number;
  gender: string;
  name: string;
  race_id: number;
  security_status?: number;
  title?: string;
}

export interface KillmailData {
  killmail_id: number;
  killmail_time: string;
  solar_system_id: number;
  victim: {
    alliance_id?: number;
    character_id?: number;
    corporation_id: number;
    damage_taken: number;
    position?: {
      x: number;
      y: number;
      z: number;
    };
    ship_type_id: number;
  };
  attackers: Array<{
    alliance_id?: number;
    character_id?: number;
    corporation_id?: number;
    damage_done: number;
    final_blow: boolean;
    security_status: number;
    ship_type_id?: number;
    weapon_type_id?: number;
  }>;
}

class ESIService {
  /**
   * Alliance bilgilerini ESI'den çeker
   */
  async getAlliance(allianceId: number): Promise<AllianceData> {
    try {
      const response = await esiRateLimiter.request<AllianceData>({
        method: 'GET',
        url: `${ESI_BASE_URL}/alliances/${allianceId}/`,
        headers: {
          'User-Agent': 'KillReport App - contact: your@email.com',
        },
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error(`Alliance ${allianceId} not found`);
      }
      throw error;
    }
  }

  /**
   * Tüm alliance ID'lerini çeker
   */
  async getAllAllianceIds(): Promise<number[]> {
    try {
      const response = await esiRateLimiter.request<number[]>({
        method: 'GET',
        url: `${ESI_BASE_URL}/alliances/`,
        headers: {
          'User-Agent': 'KillReport App - contact: your@email.com',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch alliance IDs:', error);
      throw error;
    }
  }

  /**
   * Corporation bilgilerini ESI'den çeker
   */
  async getCorporation(corporationId: number): Promise<CorporationData> {
    try {
      const response = await esiRateLimiter.request<CorporationData>({
        method: 'GET',
        url: `${ESI_BASE_URL}/corporations/${corporationId}/`,
        headers: {
          'User-Agent': 'KillReport App - contact: your@email.com',
        },
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error(`Corporation ${corporationId} not found`);
      }
      throw error;
    }
  }

  /**
   * Character bilgilerini ESI'den çeker
   */
  async getCharacter(characterId: number): Promise<CharacterData> {
    try {
      const response = await esiRateLimiter.request<CharacterData>({
        method: 'GET',
        url: `${ESI_BASE_URL}/characters/${characterId}/`,
        headers: {
          'User-Agent': 'killreport.com - contact: umutyerebakmaz@gmail.com',
        },
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error(`Character ${characterId} not found`);
      }
      throw error;
    }
  }

  /**
   * Killmail bilgilerini ESI'den çeker
   */
  async getKillmail(killmailId: number, killmailHash: string): Promise<KillmailData> {
    try {
      const response = await esiRateLimiter.request<KillmailData>({
        method: 'GET',
        url: `${ESI_BASE_URL}/killmails/${killmailId}/${killmailHash}/`,
        headers: {
          'User-Agent': 'KillReport App - contact: your@email.com',
        },
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error(`Killmail ${killmailId} not found`);
      }
      throw error;
    }
  }

  /**
   * Rate limiter durumunu döndürür
   */
  getRateLimitStatus() {
    return esiRateLimiter.getStatus();
  }
}

// Singleton instance
export const esiService = new ESIService();
