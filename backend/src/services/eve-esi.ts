/**
 * Eve Online ESI API Service
 * ESI (Eve Swagger Interface) ile etkileşim için fonksiyonlar
 */

const ESI_BASE_URL = 'https://esi.evetech.net/latest';

export interface EsiKillmail {
  killmail_id: number;
  killmail_hash: string;
}

export interface KillmailDetail {
  killmail_id: number;
  killmail_time: string;
  solar_system_id: number;
  victim: {
    character_id?: number;
    corporation_id: number;
    alliance_id?: number;
    ship_type_id: number;
    damage_taken: number;
    position?: {
      x: number;
      y: number;
      z: number;
    };
  };
  attackers: Array<{
    character_id?: number;
    corporation_id?: number;
    alliance_id?: number;
    ship_type_id?: number;
    weapon_type_id?: number;
    damage_done: number;
    final_blow: boolean;
    security_status: number;
  }>;
}

/**
 * Fetches character's recent killmails
 * @param characterId - Character ID
 * @param token - Access token (Bearer token)
 * @returns Killmail list (ID and hash)
 */
export async function getCharacterKillmails(
  characterId: number,
  token: string
): Promise<EsiKillmail[]> {
  const url = `${ESI_BASE_URL}/characters/${characterId}/killmails/recent/?datasource=tranquility`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Failed to fetch character killmails: ${response.status} - ${error}`
    );
  }

  return response.json();
}

/**
 * Fetches corporation killmails (requires authorization)
 * Scope: esi-killmails.read_corporation_killmails.v1
 * @param corporationId - Corporation ID
 * @param token - Access token
 * @returns Killmail list
 */
export async function getCorporationKillmails(
  corporationId: number,
  token: string
): Promise<EsiKillmail[]> {
  const url = `${ESI_BASE_URL}/corporations/${corporationId}/killmails/recent/?datasource=tranquility`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Failed to fetch corporation killmails: ${response.status} - ${error}`
    );
  }

  return response.json();
}

/**
 * Fetches killmail details (public endpoint, no token required)
 * @param killmailId - Killmail ID
 * @param killmailHash - Killmail hash
 * @returns Killmail details
 */
export async function getKillmailDetail(
  killmailId: number,
  killmailHash: string
): Promise<KillmailDetail> {
  const url = `${ESI_BASE_URL}/killmails/${killmailId}/${killmailHash}/?datasource=tranquility`;

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Failed to fetch killmail detail: ${response.status} - ${error}`
    );
  }

  return response.json();
}

/**
 * Fetches character information (public endpoint)
 * @param characterId - Character ID
 * @returns Character information
 */
export async function getCharacterInfo(characterId: number) {
  const url = `${ESI_BASE_URL}/characters/${characterId}/?datasource=tranquility`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch character info: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetches corporation information (public endpoint)
 * @param corporationId - Corporation ID
 * @returns Corporation information
 */
export async function getCorporationInfo(corporationId: number) {
  const url = `${ESI_BASE_URL}/corporations/${corporationId}/?datasource=tranquility`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch corporation info: ${response.status}`);
  }

  return response.json();
}
