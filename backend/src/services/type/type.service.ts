import { esiClient } from '@services/esi-client';
import { EsiThrottledError } from '@services/rate-limiter';

/**
 * Type service for ESI API interactions
 */
export class TypeService {
  /**
   * Fetches all type IDs from all item groups
   * @returns Array of all type IDs in EVE Online
   */
  static async getTypeIds(): Promise<number[]> {
    // First get all group IDs
    const groupsResponse = await esiClient.get<number[]>(
      `/latest/universe/groups/`,
    );
    const groupIds: number[] = groupsResponse.data;

    console.log(`📊 found ${groupIds.length} item groups, fetching types...`);

    const allTypeIds: number[] = [];
    let processedGroups = 0;

    // Fetch types from each group
    for (const groupId of groupIds) {
      try {
        const groupResponse = await esiClient.get<{ types?: number[] }>(
          `/latest/universe/groups/${groupId}/`,
        );
        const groupData = groupResponse.data;

        if (groupData.types && Array.isArray(groupData.types)) {
          allTypeIds.push(...groupData.types);
        }

        processedGroups++;
        if (processedGroups % 100 === 0) {
          console.log(
            `  ✓ processed ${processedGroups}/${groupIds.length} groups (${allTypeIds.length} types so far)`,
          );
        }
      } catch (error) {
        if (error instanceof EsiThrottledError) throw error;
        console.error(`  ✗ failed to fetch group ${groupId}:`, error);
      }
    }

    console.log(`✓ total types found: ${allTypeIds.length}`);
    return allTypeIds;
  }

  /**
   * Fetches type/item information (public endpoint)
   * @param typeId - Type ID
   * @returns Type information
   */
  static async getTypeInfo(typeId: number) {
    const response = await esiClient.get<any>(`/universe/types/${typeId}/`);
    return response.data;
  }
}
