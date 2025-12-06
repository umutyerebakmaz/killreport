import axios from 'axios';
import { esiRateLimiter } from '../rate-limiter';

const ESI_BASE_URL = 'https://esi.evetech.net';

/**
 * Type service for ESI API interactions
 */
export class TypeService {
  /**
   * Fetches all type IDs from all item groups
   * @returns Array of all type IDs in EVE Online
   */
  static async getTypeIds(): Promise<number[]> {
    return esiRateLimiter.execute(async () => {
      // First get all group IDs
      const groupsResponse = await axios.get(`${ESI_BASE_URL}/latest/universe/groups/`);
      const groupIds: number[] = groupsResponse.data;

      console.log(`📊 Found ${groupIds.length} item groups, fetching types...`);

      const allTypeIds: number[] = [];
      let processedGroups = 0;

      // Fetch types from each group
      for (const groupId of groupIds) {
        try {
          const groupResponse = await axios.get(`${ESI_BASE_URL}/latest/universe/groups/${groupId}/`);
          const groupData = groupResponse.data;

          if (groupData.types && Array.isArray(groupData.types)) {
            allTypeIds.push(...groupData.types);
          }

          processedGroups++;
          if (processedGroups % 100 === 0) {
            console.log(`  ✓ Processed ${processedGroups}/${groupIds.length} groups (${allTypeIds.length} types so far)`);
          }
        } catch (error) {
          console.error(`  ✗ Failed to fetch group ${groupId}:`, error);
        }
      }

      console.log(`✓ Total types found: ${allTypeIds.length}`);
      return allTypeIds;
    });
  }

  /**
   * Fetches type/item information (public endpoint)
   * @param typeId - Type ID
   * @returns Type information
   */
  static async getTypeInfo(typeId: number) {
    return esiRateLimiter.execute(async () => {
      const response = await axios.get(
        `${ESI_BASE_URL}/universe/types/${typeId}/`
      );
      return response.data;
    });
  }
}
