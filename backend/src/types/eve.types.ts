/**
 * EVE Online ESI API Response Types
 */

export interface EveTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
}

export interface EveVerifyResponse {
  CharacterID: number;
  CharacterName: string;
  ExpiresOn: string;
  Scopes: string;
  TokenType: string;
  CharacterOwnerHash: string;
  IntellectualProperty: string;
}

export interface EveCharacterPublicInfo {
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

export interface EveKillmail {
  killmail_id: number;
  killmail_time: string;
  solar_system_id: number;
  moon_id?: number;
  war_id?: number;
  victim: {
    character_id?: number;
    corporation_id: number;
    alliance_id?: number;
    faction_id?: number;
    damage_taken: number;
    ship_type_id: number;
    position?: {
      x: number;
      y: number;
      z: number;
    };
    items?: Array<{
      item_type_id: number;
      quantity_destroyed?: number;
      quantity_dropped?: number;
      singleton: number;
      flag: number;
    }>;
  };
  attackers: Array<{
    character_id?: number;
    corporation_id: number;
    alliance_id?: number;
    faction_id?: number;
    damage_done: number;
    final_blow: boolean;
    security_status: number;
    ship_type_id: number;
    weapon_type_id?: number;
  }>;
}
