import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// rate-limiter builds its singleton from config at import time, and the real
// config exits the process when EVE_CLIENT_ID is unset, as it is in CI.
vi.mock('@config/config', () => ({
  config: { esi: { maxRequestsPerSecond: 50, prefetch: 25 } },
}));
vi.mock('@services/esi-client', () => ({ esiClient: { get: vi.fn() } }));
const upsert = vi.hoisted(() => vi.fn());
vi.mock('@services/prisma-worker', () => ({
  default: { marketPrice: { upsert } },
}));
vi.mock('@services/logger', () => ({
  default: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { esiClient } from '@services/esi-client';
import {
  ESIMarketOrder,
  JITA_4_4,
  jitaPriceFromOrders,
  MarketPrice,
  MarketService,
} from './market.service';

const get = vi.mocked(esiClient.get);
const ELSEWHERE = 60008494; // Amarr VIII

function order(
  location_id: number,
  volume_remain: number,
  price: number,
  is_buy_order: boolean,
): ESIMarketOrder {
  return {
    order_id: 1,
    type_id: 34,
    location_id,
    volume_total: volume_remain,
    volume_remain,
    min_volume: 1,
    price,
    is_buy_order,
    duration: 90,
    issued: '2026-11-18T10:00:00Z',
    range: 'region',
  };
}
const sell = (l: number, v: number, p: number) => order(l, v, p, false);
const buy = (l: number, v: number, p: number) => order(l, v, p, true);

function expectPrice(
  got: MarketPrice | null,
  want: { buy: number; sell: number; average: number; volume: number },
) {
  expect(got).not.toBeNull();
  expect(got!.type_id).toBe(34);
  expect(got!.buy).toBeCloseTo(want.buy, 9);
  expect(got!.sell).toBeCloseTo(want.sell, 9);
  expect(got!.average).toBeCloseTo(want.average, 9);
  expect(got!.volume).toBeCloseTo(want.volume, 9);
}

function page(orders: ESIMarketOrder[], pages: number) {
  return { data: orders, headers: { 'x-pages': String(pages) } } as never;
}

describe('jitaPriceFromOrders', () => {
  it('ignores other stations', () => {
    expectPrice(
      jitaPriceFromOrders(34, [sell(JITA_4_4, 1, 5), sell(ELSEWHERE, 1, 4)]),
      { buy: 0, sell: 5, average: 2.5, volume: 1 },
    );
  });

  it('prices a buy-only market', () => {
    expectPrice(jitaPriceFromOrders(34, [buy(JITA_4_4, 1, 3)]), {
      buy: 3,
      sell: 0,
      average: 1.5,
      volume: 1,
    });
  });

  it('prices a sell-only market', () => {
    expectPrice(jitaPriceFromOrders(34, [sell(JITA_4_4, 1, 3)]), {
      buy: 0,
      sell: 3,
      average: 1.5,
      volume: 1,
    });
  });

  it('does not let a single cheap order set the price', () => {
    const price = jitaPriceFromOrders(34, [
      sell(JITA_4_4, 100, 10),
      sell(JITA_4_4, 1, 1),
      sell(JITA_4_4, 99, 11),
    ]);
    // Target 5 % of 200 = 10: 1 × 1 then 9 × 10.
    expect(price!.sell).toBeCloseTo(9.1, 9);
  });

  it('takes the dearest five percent of buy orders', () => {
    const price = jitaPriceFromOrders(34, [
      buy(JITA_4_4, 100, 10),
      buy(JITA_4_4, 99, 9),
      buy(JITA_4_4, 1, 100),
    ]);
    expect(price!.buy).toBeCloseTo(19, 9);
  });

  it('prices both sides', () => {
    expectPrice(
      jitaPriceFromOrders(34, [buy(JITA_4_4, 1, 4), sell(JITA_4_4, 1, 5)]),
      { buy: 4, sell: 5, average: 4.5, volume: 2 },
    );
  });

  it('is null without Jita orders', () => {
    expect(jitaPriceFromOrders(34, [sell(ELSEWHERE, 1, 4)])).toBeNull();
  });

  it('is null for no orders at all', () => {
    expect(jitaPriceFromOrders(34, [])).toBeNull();
  });
});

describe('MarketService.getJitaPrice', () => {
  beforeEach(() => get.mockReset());

  it('reads every page', async () => {
    get
      .mockResolvedValueOnce(page([sell(ELSEWHERE, 1, 1)], 2))
      .mockResolvedValueOnce(page([sell(JITA_4_4, 1, 5)], 2));

    const price = await MarketService.getJitaPrice(34);

    expect(price!.sell).toBe(5);
    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[0][1]).toEqual({ params: { type_id: 34, page: 1 } });
    expect(get.mock.calls[1][1]).toEqual({ params: { type_id: 34, page: 2 } });
  });

  it('reads one page when x-pages is missing', async () => {
    get.mockResolvedValueOnce({
      data: [sell(JITA_4_4, 1, 5)],
      headers: {},
    } as never);
    await MarketService.getJitaPrice(34);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('rethrows an ESI error', async () => {
    get.mockRejectedValueOnce(
      new AxiosError('failed', '500', undefined, undefined, {
        status: 500,
      } as never),
    );
    await expect(MarketService.getJitaPrice(34)).rejects.toThrow('failed');
  });
});

describe('MarketService.savePrice', () => {
  it('rethrows a database error', async () => {
    upsert.mockRejectedValueOnce(new Error('fk violation'));
    await expect(
      MarketService.savePrice({
        type_id: 34,
        buy: 1,
        sell: 2,
        average: 1.5,
        volume: 3,
      }),
    ).rejects.toThrow('fk violation');
  });
});
