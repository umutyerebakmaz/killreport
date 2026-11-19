import { esiClient } from '@services/esi-client';
import prismaWorker from '@services/prisma-worker';

const THE_FORGE_REGION_ID = 10000002; // Jita's region
/** Jita IV - Moon 4 - Caldari Navy Assembly Plant. Only its orders count. */
export const JITA_4_4 = 60003760;
/**
 * A side's price is the volume-weighted mean of its best orders up to this
 * share of the side's total volume.
 */
const BEST_SHARE = 0.05;

export interface MarketPrice {
  type_id: number;
  buy: number; // Dearest 5 % of Jita buy orders (instant sell price)
  sell: number; // Cheapest 5 % of Jita sell orders (instant buy price)
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
 * The volume-weighted mean price of `orders`, best first, up to BEST_SHARE of
 * their total volume; the last order counts only for what is still missing.
 * 0 for no orders.
 */
function bestSharePrice(orders: ESIMarketOrder[]): number {
  const total = orders.reduce((sum, o) => sum + o.volume_remain, 0);
  if (total <= 0) return 0;
  const target = total * BEST_SHARE;
  let taken = 0;
  let value = 0;
  for (const order of orders) {
    const take = Math.min(order.volume_remain, target - taken);
    taken += take;
    value += take * order.price;
    if (taken >= target) break;
  }
  return value / taken;
}

/**
 * The Jita 4-4 price, or null when Jita 4-4 has no orders for the type, so
 * the stored price stays as it was. `sell` is the volume-weighted mean of the
 * cheapest sell orders that make up 5 % of Jita's sell volume, `buy` the same
 * over the dearest buy orders, so a single small order far off the market
 * cannot set the price. A side with no orders is 0. The Rust counterpart is
 * `jita_price` in `backend-rs/workers/worker-prices/src/market.rs`.
 */
export function jitaPriceFromOrders(
  typeId: number,
  orders: ESIMarketOrder[],
): MarketPrice | null {
  const jita = orders.filter((o) => o.location_id === JITA_4_4);
  if (jita.length === 0) return null;

  const sells = jita
    .filter((o) => !o.is_buy_order)
    .sort((a, b) => a.price - b.price);
  const buys = jita
    .filter((o) => o.is_buy_order)
    .sort((a, b) => b.price - a.price);
  const buy = bestSharePrice(buys);
  const sell = bestSharePrice(sells);

  return {
    type_id: typeId,
    buy,
    sell,
    average: (buy + sell) / 2,
    volume: jita.reduce((sum, o) => sum + o.volume_remain, 0),
  };
}

/**
 * Market service for ESI API interactions
 */
export class MarketService {
  /**
   * Every page of the type's orders in The Forge, priced at Jita 4-4. Null
   * when Jita 4-4 has no orders. Errors are not caught: the worker's shared
   * failure path decides what a 404, a throttle or a 5xx means.
   */
  static async getJitaPrice(typeId: number): Promise<MarketPrice | null> {
    const path = `/latest/markets/${THE_FORGE_REGION_ID}/orders/`;
    const first = await esiClient.get<ESIMarketOrder[]>(path, {
      params: { type_id: typeId, page: 1 },
    });
    const orders = [...first.data];
    const pages = Number(first.headers['x-pages']) || 1;
    for (let page = 2; page <= pages; page++) {
      const next = await esiClient.get<ESIMarketOrder[]>(path, {
        params: { type_id: typeId, page },
      });
      orders.push(...next.data);
    }
    return jitaPriceFromOrders(typeId, orders);
  }

  /**
   * Saves price to database. Errors are not caught, so a failed save is not
   * counted as saved.
   */
  static async savePrice(price: MarketPrice): Promise<void> {
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
  }
}
