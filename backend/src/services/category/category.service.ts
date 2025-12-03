import axios from 'axios';
import { esiRateLimiter } from '../rate-limiter';

const ESI_BASE_URL = 'https://esi.evetech.net/latest';

/**
 * Category service for ESI API interactions
 */
export class CategoryService {
    /**
     * Fetches all category IDs from ESI
     * @returns Array of category IDs
     */
    static async getAllCategoryIds(): Promise<number[]> {
        return esiRateLimiter.execute(async () => {
            const response = await axios.get(`${ESI_BASE_URL}/universe/categories/`);
            return response.data;
        });
    }

    /**
     * Fetches category information (public endpoint)
     * @param categoryId - Category ID
     * @returns Category information
     */
    static async getCategoryInfo(categoryId: number) {
        return esiRateLimiter.execute(async () => {
            const response = await axios.get(
                `${ESI_BASE_URL}/universe/categories/${categoryId}/`
            );
            return response.data;
        });
    }
}
