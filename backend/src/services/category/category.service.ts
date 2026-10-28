import { esiClient } from '@services/esi-client';

/**
 * Category service for ESI API interactions
 */
export class CategoryService {
  /**
   * Fetches all category IDs from ESI
   * @returns Array of category IDs
   */
  static async getAllCategoryIds(): Promise<number[]> {
    const response = await esiClient.get<number[]>(
      `/latest/universe/categories/`,
    );
    return response.data;
  }

  /**
   * Fetches category information (public endpoint)
   * @param categoryId - Category ID
   * @returns Category information
   */
  static async getCategoryInfo(categoryId: number) {
    const response = await esiClient.get<any>(
      `/latest/universe/categories/${categoryId}/`,
    );
    return response.data;
  }
}
