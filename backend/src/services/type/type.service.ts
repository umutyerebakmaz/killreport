import axios from 'axios';
import { esiRateLimiter } from '../rate-limiter';

const ESI_BASE_URL = 'https://esi.evetech.net/latest';

/**
 * Type service for ESI API interactions
 */
export class TypeService {
    /**
     * Fetches type/item information (public endpoint)
     * @param typeId - Type ID
     * @returns Type information
     */
    static async getTypeInfo(typeId: number) {
        return esiRateLimiter.execute(async () => {
            const response = await axios.get(
                `${ESI_BASE_URL}/universe/types/${typeId}/?datasource=tranquility`
            );
            return response.data;
        });
    }
}
