import { esiClient } from '@services/esi-client';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { EsiThrottledError } from '@services/rate-limiter';

const THE_FORGE_REGION_ID = 10000002; // Jita's region

export interface MarketPrice {
  type_id: number;
  buy: number; // Highest buy order (instant sell price)
  sell: number; // Lowest sell order (instant buy price)
  average: number;
  volume: number;
}

export interface ESIMarketOrder {
  order_id: number;
  type_id: number;
  location_id: number;
  volume_total: number;
  volume_remain: number;
  min_volume: number;
  price: number;
  is_buy_order: boolean;
  duration: number;
  issued: string;
  range: string;
}

/**
 * Market service for ESI API interactions
 */
export class MarketService {
  /**
   * Fetches Jita price from ESI market orders
   * @param typeId - Type ID
   * @returns Price data from ESI
   */
  static async getJitaPrice(typeId: number): Promise<MarketPrice | null> {
    try {
      const response = await esiClient.get<ESIMarketOrder[]>(
        `/latest/markets/${THE_FORGE_REGION_ID}/orders/`,
        { params: { type_id: typeId } },
      );

      const orders = response.data;
      const buyOrders = orders
        .filter((o) => o.is_buy_order)
        .map((o) => o.price);
      const sellOrders = orders
        .filter((o) => !o.is_buy_order)
        .map((o) => o.price);

      const highestBuy = buyOrders.length > 0 ? Math.max(...buyOrders) : 0;
      const lowestSell = sellOrders.length > 0 ? Math.min(...sellOrders) : 0;
      const totalVolume = orders.reduce((sum, o) => sum + o.volume_remain, 0);

      return {
        type_id: typeId,
        buy: highestBuy,
        sell: lowestSell,
        average: (highestBuy + lowestSell) / 2,
        volume: totalVolume,
      };
    } catch (error) {
      if (error instanceof EsiThrottledError) throw error;
      logger.error(`failed to fetch ESI price for type ${typeId}:`, error);
      return null;
    }
  }

  /**
   * Saves price to database
   * @param price - Price data from ESI
   */
  static async savePrice(price: MarketPrice): Promise<void> {
    try {
      await prismaWorker.marketPrice.upsert({
        where: { type_id: price.type_id },
        create: {
          type_id: price.type_id,
          buy: price.buy,
          sell: price.sell,
          average: price.average,
          volume: price.volume,
        },
        update: {
          buy: price.buy,
          sell: price.sell,
          average: price.average,
          volume: price.volume,
          updated_at: new Date(),
        },
      });
    } catch (error) {
      logger.error(`failed to save price for type ${price.type_id}:`, error);
    }
  }
}
