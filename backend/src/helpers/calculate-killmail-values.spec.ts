import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  marketPrice: { findMany: vi.fn() },
  type: { findMany: vi.fn() },
  itemGroup: { findMany: vi.fn() },
  category: { findMany: vi.fn() },
}));

vi.mock('@services/prisma-worker', () => ({ default: prismaMock }));

import {
  calculateKillmailValues,
  calculateKillmailValuesBatch,
} from './calculate-killmail-values';

const CAPSULE = 670;
const CAPSULE_GROUP = 29;
const RIFTER = 587;
const AMMO = 178;
const BPC = 999;

function seedDatabase() {
  prismaMock.marketPrice.findMany.mockResolvedValue([
    { type_id: RIFTER, sell: 500000 },
    { type_id: AMMO, sell: 10 },
    { type_id: BPC, sell: 1000000 },
  ]);
  prismaMock.type.findMany.mockResolvedValue([
    { id: CAPSULE, group_id: CAPSULE_GROUP },
    { id: RIFTER, group_id: 25 },
    { id: AMMO, group_id: 83 },
    { id: BPC, group_id: 700 },
  ]);
  prismaMock.itemGroup.findMany.mockResolvedValue([
    { id: CAPSULE_GROUP, category_id: 6 },
    { id: 25, category_id: 6 },
    { id: 83, category_id: 8 },
    { id: 700, category_id: 9 },
  ]);
  prismaMock.category.findMany.mockResolvedValue([
    { id: 6, name: 'Ship' },
    { id: 8, name: 'Charge' },
    { id: 9, name: 'Blueprint' },
  ]);
}

beforeEach(() => {
  seedDatabase();
});

describe('calculateKillmailValues', () => {
  it('uses the ship sell price as destroyed value when there are no items', async () => {
    const result = await calculateKillmailValues({
      victim: { ship_type_id: RIFTER },
    });

    expect(result).toEqual({
      totalValue: 500000,
      destroyedValue: 500000,
      droppedValue: 0,
    });
  });

  it('splits item value between destroyed and dropped', async () => {
    const result = await calculateKillmailValues({
      victim: { ship_type_id: RIFTER },
      items: [
        { item_type_id: AMMO, quantity_destroyed: 100, quantity_dropped: 50 },
      ],
    });

    expect(result.destroyedValue).toBe(500000 + 100 * 10);
    expect(result.droppedValue).toBe(50 * 10);
    expect(result.totalValue).toBe(500000 + 150 * 10);
  });

  it('values a capsule at a fixed 10 ISK by group, regardless of market price', async () => {
    prismaMock.marketPrice.findMany.mockResolvedValue([
      { type_id: CAPSULE, sell: 123456 },
    ]);

    const result = await calculateKillmailValues({
      victim: { ship_type_id: CAPSULE },
    });

    expect(result.totalValue).toBe(10);
  });

  it('values blueprint copies at 0.01 ISK but originals at market price', async () => {
    const copy = await calculateKillmailValues({
      victim: { ship_type_id: RIFTER },
      items: [{ item_type_id: BPC, quantity_dropped: 1, singleton: 2 }],
    });
    const original = await calculateKillmailValues({
      victim: { ship_type_id: RIFTER },
      items: [{ item_type_id: BPC, quantity_dropped: 1, singleton: 1 }],
    });

    expect(copy.droppedValue).toBe(0.01);
    expect(original.droppedValue).toBe(1000000);
  });

  it('treats unknown types as worthless', async () => {
    const result = await calculateKillmailValues({
      victim: { ship_type_id: 424242 },
      items: [{ item_type_id: 434343, quantity_destroyed: 5 }],
    });

    expect(result).toEqual({
      totalValue: 0,
      destroyedValue: 0,
      droppedValue: 0,
    });
  });

  it('treats a null sell price as worthless', async () => {
    prismaMock.marketPrice.findMany.mockResolvedValue([
      { type_id: RIFTER, sell: null },
      { type_id: AMMO, sell: 10 },
    ]);

    const result = await calculateKillmailValues({
      victim: { ship_type_id: RIFTER },
      items: [{ item_type_id: AMMO, quantity_destroyed: 2 }],
    });

    expect(result.totalValue).toBe(20);
  });

  it('prices a type whose group has no category as a non-blueprint', async () => {
    prismaMock.itemGroup.findMany.mockResolvedValue([]);
    prismaMock.category.findMany.mockResolvedValue([]);

    const result = await calculateKillmailValues({
      victim: { ship_type_id: RIFTER },
      items: [{ item_type_id: BPC, quantity_destroyed: 1, singleton: 2 }],
    });

    expect(result.totalValue).toBe(1500000);
  });

  it('prices a type whose category has no name as a non-blueprint', async () => {
    prismaMock.category.findMany.mockResolvedValue([
      { id: 6, name: 'Ship' },
      { id: 8, name: 'Charge' },
      { id: 9, name: null },
    ]);

    const result = await calculateKillmailValues({
      victim: { ship_type_id: RIFTER },
      items: [{ item_type_id: BPC, quantity_destroyed: 1, singleton: 2 }],
    });

    expect(result.totalValue).toBe(1500000);
  });

  it('queries prices once with the unique set of type ids', async () => {
    await calculateKillmailValues({
      victim: { ship_type_id: RIFTER },
      items: [
        { item_type_id: AMMO, quantity_destroyed: 1 },
        { item_type_id: AMMO, quantity_dropped: 1 },
      ],
    });

    expect(prismaMock.marketPrice.findMany).toHaveBeenCalledTimes(1);
    const call = prismaMock.marketPrice.findMany.mock.calls[0][0];
    expect(call.where.type_id.in).toEqual([RIFTER, AMMO]);
  });
});

describe('calculateKillmailValuesBatch', () => {
  it('returns one result per killmail in input order', async () => {
    const results = await calculateKillmailValuesBatch([
      { victim: { ship_type_id: RIFTER } },
      { victim: { ship_type_id: CAPSULE } },
      {
        victim: { ship_type_id: RIFTER },
        items: [{ item_type_id: AMMO, quantity_dropped: 2 }],
      },
    ]);

    expect(results).toHaveLength(3);
    expect(results[0].totalValue).toBe(500000);
    expect(results[1].totalValue).toBe(10);
    expect(results[2].droppedValue).toBe(20);
  });

  it('fetches prices with a single query for the whole batch', async () => {
    await calculateKillmailValuesBatch([
      { victim: { ship_type_id: RIFTER }, items: [{ item_type_id: AMMO }] },
      { victim: { ship_type_id: CAPSULE }, items: [{ item_type_id: AMMO }] },
    ]);

    expect(prismaMock.marketPrice.findMany).toHaveBeenCalledTimes(1);
    const call = prismaMock.marketPrice.findMany.mock.calls[0][0];
    expect(call.where.type_id.in).toEqual([RIFTER, AMMO, CAPSULE]);
  });

  it('matches the single-killmail calculation', async () => {
    const input = {
      victim: { ship_type_id: RIFTER },
      items: [
        { item_type_id: AMMO, quantity_destroyed: 3, quantity_dropped: 7 },
      ],
    };

    const [batch] = await calculateKillmailValuesBatch([input]);
    const single = await calculateKillmailValues(input);

    expect(batch).toEqual(single);
  });

  // The batch path re-implements the pricing rules rather than looping the
  // single-killmail function, so each rule is worth asserting on both.
  it('values a capsule by group here too, not by its market price', async () => {
    const [result] = await calculateKillmailValuesBatch([
      { victim: { ship_type_id: CAPSULE } },
    ]);

    expect(result.totalValue).toBe(10);
    expect(result.destroyedValue).toBe(10);
  });

  it('values a blueprint copy at 0.01 ISK and an original at market price', async () => {
    const [copy, original] = await calculateKillmailValuesBatch([
      {
        victim: { ship_type_id: RIFTER },
        items: [{ item_type_id: BPC, quantity_destroyed: 1, singleton: 2 }],
      },
      {
        victim: { ship_type_id: RIFTER },
        items: [{ item_type_id: BPC, quantity_destroyed: 1, singleton: 1 }],
      },
    ]);

    expect(copy.totalValue).toBe(500000.01);
    expect(original.totalValue).toBe(1500000);
  });

  it('treats an unpriced type as worthless rather than failing', async () => {
    const [result] = await calculateKillmailValuesBatch([
      {
        victim: { ship_type_id: 4444 },
        items: [{ item_type_id: 5555, quantity_destroyed: 10 }],
      },
    ]);

    expect(result.totalValue).toBe(0);
  });

  it('counts an item with neither quantity as zero on both sides', async () => {
    const [result] = await calculateKillmailValuesBatch([
      { victim: { ship_type_id: RIFTER }, items: [{ item_type_id: AMMO }] },
    ]);

    expect(result.destroyedValue).toBe(500000);
    expect(result.droppedValue).toBe(0);
  });

  it('prices a type whose group has no category as a non-blueprint', async () => {
    prismaMock.itemGroup.findMany.mockResolvedValue([]);
    prismaMock.category.findMany.mockResolvedValue([]);

    const [result] = await calculateKillmailValuesBatch([
      {
        victim: { ship_type_id: RIFTER },
        items: [{ item_type_id: BPC, quantity_destroyed: 1, singleton: 2 }],
      },
    ]);

    expect(result.totalValue).toBe(1500000);
  });

  it('treats a null sell price as worthless here too', async () => {
    prismaMock.marketPrice.findMany.mockResolvedValue([
      { type_id: RIFTER, sell: null },
      { type_id: AMMO, sell: 10 },
    ]);

    const [result] = await calculateKillmailValuesBatch([
      {
        victim: { ship_type_id: RIFTER },
        items: [{ item_type_id: AMMO, quantity_destroyed: 2 }],
      },
    ]);

    expect(result.totalValue).toBe(20);
  });

  it('returns an empty list for an empty batch', async () => {
    await expect(calculateKillmailValuesBatch([])).resolves.toEqual([]);
  });
});
