import axios from 'axios';
import { esiRateLimiter } from '../rate-limiter';

const ESI_BASE_URL = 'https://esi.evetech.net';


export class ItemGroupService {

    static async getItemGroupIds(): Promise<number[]> {
        return esiRateLimiter.execute(async () => {
            const response = await axios.get(`${ESI_BASE_URL}/latest/universe/groups/`);
            return response.data;
        });
    }

    static async getItemGroupInfo(itemGroupId: number) {
        return esiRateLimiter.execute(async () => {
            const response = await axios.get(`${ESI_BASE_URL}/latest/universe/groups/${itemGroupId}/`);
            return response.data;
        });

    }
}
