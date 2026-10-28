import { esiClient } from '@services/esi-client';

export class ItemGroupService {
  static async getItemGroupIds(): Promise<number[]> {
    const response = await esiClient.get<number[]>(`/latest/universe/groups/`);
    return response.data;
  }

  static async getItemGroupInfo(itemGroupId: number) {
    const response = await esiClient.get<any>(
      `/latest/universe/groups/${itemGroupId}/`,
    );
    return response.data;
  }
}
