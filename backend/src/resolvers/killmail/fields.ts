import {
  AttackerResolvers,
  FittingModuleResolvers,
  KillmailItemResolvers,
  KillmailResolvers,
  VictimResolvers,
} from '@generated-types';
import { organizeFitting } from '@services/fitting-helper';

/**
 * Killmail Field Resolvers
 * Handles nested fields and computed properties for Killmail type
 * Uses DataLoaders to prevent N+1 queries
 */

export const killmailFields: KillmailResolvers = {
  solarSystem: async (parent: any, _, context) => {
    if (!parent.solarSystemId) return null;
    return context.loaders.solarSystem.load(parent.solarSystemId);
  },

  victim: async (parent: any, _, context) => {
    // parent is the killmail, we need to load victim by killmail_id
    const killmailId = typeof parent.id === 'string' ? parseInt(parent.id) : parent.id;
    const victim = await context.loaders.victim.load(killmailId);
    if (!victim) {
      console.error(`⚠️ Victim not found for killmail ${killmailId} - data inconsistency!`);
      return null;
    }

    return {
      characterId: victim.character_id ?? null,
      corporationId: victim.corporation_id ?? 0,
      allianceId: victim.alliance_id ?? null,
      factionId: victim.faction_id ?? null,
      shipTypeId: victim.ship_type_id ?? 0,
      damageTaken: victim.damage_taken ?? 0,
      position: victim.position_x ? {
        x: victim.position_x,
        y: victim.position_y!,
        z: victim.position_z!,
      } : null,
    } as any;
  },

  attackers: async (parent: any, _, context) => {
    const killmailId = typeof parent.id === 'string' ? parseInt(parent.id) : parent.id;
    const attackers = await context.loaders.attackers.load(killmailId);

    return attackers.map((attacker: any) => ({
      characterId: attacker.character_id ?? null,
      corporationId: attacker.corporation_id ?? null,
      allianceId: attacker.alliance_id ?? null,
      factionId: attacker.faction_id ?? null,
      shipTypeId: attacker.ship_type_id ?? null,
      weaponTypeId: attacker.weapon_type_id ?? null,
      damageDone: attacker.damage_done,
      finalBlow: attacker.final_blow,
      securityStatus: attacker.security_status,
    }));
  },

  totalValue: async (parent: any, _, context) => {
    const killmailId = typeof parent.id === 'string' ? parseInt(parent.id) : parent.id;

    // Victim'dan ship type'ı al
    const victim = await context.loaders.victim.load(killmailId);

    // Killmail'in tüm itemlarını al
    const items = await context.loaders.items.load(killmailId);

    // Ship type_id'yi de ekle
    const allTypeIds = victim?.ship_type_id
      ? [...new Set([...items.map((item: any) => item.item_type_id), victim.ship_type_id])] as number[]
      : [...new Set(items.map((item: any) => item.item_type_id))] as number[];

    // ✅ Market fiyatlarını DataLoader ile batch olarak çek (N+1 query önlenir)
    const marketPrices = await Promise.all(
      allTypeIds.map(typeId => context.loaders.marketPrice.load(typeId))
    );

    // type_id -> price mapping oluştur
    const priceMap = new Map(
      allTypeIds.map((typeId, index) => [typeId, marketPrices[index]?.sell || 0])
    );

    // Her item için miktar * fiyat hesapla ve topla
    let totalValue = 0;

    // Ship'i ekle (her zaman destroyed)
    if (victim?.ship_type_id) {
      const shipPrice = priceMap.get(victim.ship_type_id) || 0;
      totalValue += shipPrice;
    }

    // Item'ları ekle
    for (const item of items) {
      const price = priceMap.get(item.item_type_id) || 0;
      const quantity = (item.quantity_dropped || 0) + (item.quantity_destroyed || 0);
      totalValue += price * quantity;
    }

    return totalValue;
  },

  destroyedValue: async (parent: any, _, context) => {
    const killmailId = typeof parent.id === 'string' ? parseInt(parent.id) : parent.id;

    // Victim'dan ship type'ı al
    const victim = await context.loaders.victim.load(killmailId);

    const items = await context.loaders.items.load(killmailId);

    // Ship type_id'yi de ekle
    const allTypeIds = victim?.ship_type_id
      ? [...new Set([...items.map((item: any) => item.item_type_id), victim.ship_type_id])] as number[]
      : [...new Set(items.map((item: any) => item.item_type_id))] as number[];

    // ✅ DataLoader ile batch fetch
    const marketPrices = await Promise.all(
      allTypeIds.map(typeId => context.loaders.marketPrice.load(typeId))
    );

    const priceMap = new Map(
      allTypeIds.map((typeId, index) => [typeId, marketPrices[index]?.sell || 0])
    );

    let destroyedValue = 0;

    // Ship'i ekle (her zaman destroyed)
    if (victim?.ship_type_id) {
      const shipPrice = priceMap.get(victim.ship_type_id) || 0;
      destroyedValue += shipPrice;
    }

    // Item'ları ekle
    for (const item of items) {
      const price = priceMap.get(item.item_type_id) || 0;
      const quantity = item.quantity_destroyed || 0;
      destroyedValue += price * quantity;
    }

    return destroyedValue;
  },

  droppedValue: async (parent: any, _, context) => {
    const killmailId = typeof parent.id === 'string' ? parseInt(parent.id) : parent.id;

    const items = await context.loaders.items.load(killmailId);
    const typeIds = [...new Set(items.map((item: any) => item.item_type_id))] as number[];

    // ✅ DataLoader ile batch fetch
    const marketPrices = await Promise.all(
      typeIds.map(typeId => context.loaders.marketPrice.load(typeId))
    );

    const priceMap = new Map(
      typeIds.map((typeId, index) => [typeId, marketPrices[index]?.sell || 0])
    );

    let droppedValue = 0;
    for (const item of items) {
      const price = priceMap.get(item.item_type_id) || 0;
      const quantity = item.quantity_dropped || 0;
      droppedValue += price * quantity;
    }

    return droppedValue;
  },

  items: async (parent: any, _, context) => {
    const killmailId = parent.killmail_id || (typeof parent.id === 'string' ? parseInt(parent.id, 10) : parent.id);
    const items = await context.loaders.items.load(killmailId);

    return items.map((item: any) => ({
      itemTypeId: item.item_type_id,
      flag: item.flag,
      quantityDropped: item.quantity_dropped ?? null,
      quantityDestroyed: item.quantity_destroyed ?? null,
      singleton: item.singleton,
      killmailId: killmailId, // charge resolver için gerekli
    }));
  },

  fitting: async (parent: any, _, context) => {
    const killmailId = parent.killmail_id || (typeof parent.id === 'string' ? parseInt(parent.id, 10) : parent.id);
    const rawItems = await context.loaders.items.load(killmailId);

    // Get ship type ID from victim to fetch slot counts
    const victim = await context.loaders.victim.load(killmailId);
    let slotCounts = undefined;

    if (victim?.ship_type_id) {
      const dogmaAttributes = await context.loaders.typeDogmaAttributes.load(
        victim.ship_type_id
      );

      if (dogmaAttributes && dogmaAttributes.length > 0) {
        // Extract slot counts from dogma attributes
        // Attribute IDs: hiSlots=14, medSlots=13, lowSlots=12, rigSlots=1137
        const hiSlotsAttr = dogmaAttributes.find((attr: any) => attr.attribute_id === 14);
        const medSlotsAttr = dogmaAttributes.find((attr: any) => attr.attribute_id === 13);
        const lowSlotsAttr = dogmaAttributes.find((attr: any) => attr.attribute_id === 12);
        const rigSlotsAttr = dogmaAttributes.find((attr: any) => attr.attribute_id === 1137);

        let hiSlots = hiSlotsAttr?.value ?? 0;
        let medSlots = medSlotsAttr?.value ?? 0;
        let lowSlots = lowSlotsAttr?.value ?? 0;
        const rigSlots = rigSlotsAttr?.value ?? 3;

        // FIX: Strategic Cruisers (T3) and some special ships have slot counts = 0
        // because they vary by subsystem/configuration.
        // Calculate actual slot counts from fitted items for accuracy.
        if (hiSlots === 0 || medSlots === 0 || lowSlots === 0) {
          // Find max flag number in each category to determine actual slot count
          const highFlags = rawItems.filter((i: any) => i.flag >= 27 && i.flag <= 34);
          const midFlags = rawItems.filter((i: any) => i.flag >= 19 && i.flag <= 26);
          const lowFlags = rawItems.filter((i: any) => i.flag >= 11 && i.flag <= 18);

          if (hiSlots === 0 && highFlags.length > 0) {
            // Calculate slot count from highest flag: (flag - baseFlag + 1)
            const maxFlag = Math.max(...highFlags.map((i: any) => i.flag));
            hiSlots = maxFlag - 27 + 1; // HiSlot0 = 27
          }
          if (medSlots === 0 && midFlags.length > 0) {
            const maxFlag = Math.max(...midFlags.map((i: any) => i.flag));
            medSlots = maxFlag - 19 + 1; // MedSlot0 = 19
          }
          if (lowSlots === 0 && lowFlags.length > 0) {
            const maxFlag = Math.max(...lowFlags.map((i: any) => i.flag));
            lowSlots = maxFlag - 11 + 1; // LoSlot0 = 11
          }

          // Fallback to defaults if still 0 (empty slots)
          hiSlots = hiSlots || 8;
          medSlots = medSlots || 8;
          lowSlots = lowSlots || 8;
        }

        slotCounts = {
          hiSlots,
          medSlots,
          lowSlots,
          rigSlots,
        };
      }
    }

    // Organize items into fitting structure with actual slot counts
    const fitting = organizeFitting(rawItems, slotCounts);

    // Convert to GraphQL-friendly format with nested Type resolution
    return {
      highSlots: {
        totalSlots: slotCounts?.hiSlots ?? 8,
        slots: fitting.highSlots.map((slot) => ({
          slotIndex: slot.slotIndex,
          module: slot.module
            ? {
              itemTypeId: slot.module.itemTypeId,
              flag: slot.module.flag,
              quantityDropped: slot.module.quantityDropped,
              quantityDestroyed: slot.module.quantityDestroyed,
              singleton: slot.module.singleton,
              charge: slot.module.charge
                ? {
                  itemTypeId: slot.module.charge.itemTypeId,
                  flag: slot.module.charge.flag,
                  quantityDropped: slot.module.charge.quantityDropped,
                  quantityDestroyed: slot.module.charge.quantityDestroyed,
                  singleton: slot.module.charge.singleton,
                  charge: null,
                }
                : null,
            }
            : null,
        })),
      },
      midSlots: {
        totalSlots: slotCounts?.medSlots ?? 8,
        slots: fitting.midSlots.map((slot) => ({
          slotIndex: slot.slotIndex,
          module: slot.module
            ? {
              itemTypeId: slot.module.itemTypeId,
              flag: slot.module.flag,
              quantityDropped: slot.module.quantityDropped,
              quantityDestroyed: slot.module.quantityDestroyed,
              singleton: slot.module.singleton,
              charge: slot.module.charge
                ? {
                  itemTypeId: slot.module.charge.itemTypeId,
                  flag: slot.module.charge.flag,
                  quantityDropped: slot.module.charge.quantityDropped,
                  quantityDestroyed: slot.module.charge.quantityDestroyed,
                  singleton: slot.module.charge.singleton,
                  charge: null,
                }
                : null,
            }
            : null,
        })),
      },
      lowSlots: {
        totalSlots: slotCounts?.lowSlots ?? 8,
        slots: fitting.lowSlots.map((slot) => ({
          slotIndex: slot.slotIndex,
          module: slot.module
            ? {
              itemTypeId: slot.module.itemTypeId,
              flag: slot.module.flag,
              quantityDropped: slot.module.quantityDropped,
              quantityDestroyed: slot.module.quantityDestroyed,
              singleton: slot.module.singleton,
              charge: slot.module.charge
                ? {
                  itemTypeId: slot.module.charge.itemTypeId,
                  flag: slot.module.charge.flag,
                  quantityDropped: slot.module.charge.quantityDropped,
                  quantityDestroyed: slot.module.charge.quantityDestroyed,
                  singleton: slot.module.charge.singleton,
                  charge: null,
                }
                : null,
            }
            : null,
        })),
      },
      rigs: {
        totalSlots: slotCounts?.rigSlots ?? 3,
        slots: fitting.rigSlots.map((slot) => ({
          slotIndex: slot.slotIndex,
          module: slot.module
            ? {
              itemTypeId: slot.module.itemTypeId,
              flag: slot.module.flag,
              quantityDropped: slot.module.quantityDropped,
              quantityDestroyed: slot.module.quantityDestroyed,
              singleton: slot.module.singleton,
              charge: null, // Rigs never have charges
            }
            : null,
        })),
      },
      subsystems: fitting.subsystems.map((module) => ({
        itemTypeId: module.itemTypeId,
        flag: module.flag,
        quantityDropped: module.quantityDropped,
        quantityDestroyed: module.quantityDestroyed,
        singleton: module.singleton,
        charge: null,
      })),
      implants: fitting.implants.map((module) => ({
        itemTypeId: module.itemTypeId,
        flag: module.flag,
        quantityDropped: module.quantityDropped,
        quantityDestroyed: module.quantityDestroyed,
        singleton: module.singleton,
        charge: null,
      })),
      cargo: fitting.cargo.map((module) => ({
        itemTypeId: module.itemTypeId,
        flag: module.flag,
        quantityDropped: module.quantityDropped,
        quantityDestroyed: module.quantityDestroyed,
        singleton: module.singleton,
        charge: null,
      })),
      droneBay: fitting.droneBay.map((module) => ({
        itemTypeId: module.itemTypeId,
        flag: module.flag,
        quantityDropped: module.quantityDropped,
        quantityDestroyed: module.quantityDestroyed,
        singleton: module.singleton,
        charge: null,
      })),
      fighterBay: fitting.fighterBay.map((module) => ({
        itemTypeId: module.itemTypeId,
        flag: module.flag,
        quantityDropped: module.quantityDropped,
        quantityDestroyed: module.quantityDestroyed,
        singleton: module.singleton,
        charge: null,
      })),
    } as any; // itemType will be resolved by FittingModule field resolver
  },
};

/**
 * Victim Field Resolvers
 * Handles nested fields for Victim type
 * Uses DataLoaders to prevent N+1 queries
 */
export const victimFields: VictimResolvers = {
  character: async (parent: any, _, context) => {
    if (!parent.characterId) return null;
    return context.loaders.character.load(parent.characterId);
  },
  corporation: async (parent: any, _, context) => {
    if (!parent.corporationId) return null;
    return context.loaders.corporation.load(parent.corporationId);
  },

  alliance: async (parent: any, _, context) => {
    if (!parent.allianceId) return null;
    return context.loaders.alliance.load(parent.allianceId);
  },

  shipType: async (parent: any, _, context) => {
    if (!parent.shipTypeId) return null;
    const type = await context.loaders.type.load(parent.shipTypeId);
    if (!type) return null;
    return {
      ...type,
      created_at: type.created_at.toISOString(),
      updated_at: type.updated_at.toISOString(),
    } as any;
  },
};

/**
 * Attacker Field Resolvers
 * Handles nested fields for Attacker type
 * Uses DataLoaders to prevent N+1 queries
 */
export const attackerFields: AttackerResolvers = {
  character: async (parent: any, _, context) => {
    if (!parent.characterId) return null;
    return context.loaders.character.load(parent.characterId);
  },
  corporation: async (parent: any, _, context) => {
    if (!parent.corporationId) return null;
    return context.loaders.corporation.load(parent.corporationId);
  },
  alliance: async (parent: any, _, context) => {
    if (!parent.allianceId) return null;
    return context.loaders.alliance.load(parent.allianceId);
  },
  shipType: async (parent: any, _, context) => {
    if (!parent.shipTypeId) return null;
    const type = await context.loaders.type.load(parent.shipTypeId);
    if (!type) return null;
    return {
      ...type,
      created_at: type.created_at.toISOString(),
      updated_at: type.updated_at.toISOString(),
    } as any;
  },
  weaponType: async (parent: any, _, context) => {
    if (!parent.weaponTypeId) return null;
    const type = await context.loaders.type.load(parent.weaponTypeId);
    if (!type) return null;
    return {
      ...type,
      created_at: type.created_at.toISOString(),
      updated_at: type.updated_at.toISOString(),
    } as any;
  },
};

/**
 * KillmailItem Field Resolvers
 * Handles nested fields for KillmailItem type
 * Uses DataLoaders to prevent N+1 queries
 */
export const killmailItemFields: KillmailItemResolvers = {
  itemType: async (parent: any, _, context) => {
    if (!parent.itemTypeId) return null;
    const type = await context.loaders.type.load(parent.itemTypeId);
    if (!type) return null;
    return {
      ...type,
      created_at: type.created_at.toISOString(),
      updated_at: type.updated_at.toISOString(),
    } as any;
  },
  charge: async (parent: any, _, context): Promise<any> => {
    // Parent item bilgilerini al
    const killmailId = parent.killmailId;
    const flag = parent.flag;
    const itemTypeId = parent.itemTypeId;

    if (!killmailId || flag === null || flag === undefined) {
      return null;
    }

    // Aynı killmail_id ve flag'e sahip tüm itemları çek
    const allItemsInSlot = await context.loaders.items.load(killmailId);
    const itemsWithSameFlag = allItemsInSlot.filter((item: any) => item.flag === flag);

    // Eğer bu slotta tek item varsa charge yok
    if (itemsWithSameFlag.length <= 1) {
      return null;
    }

    // İki item var - group_id'ye göre hangisi modül hangisi charge belirle
    const { isCharge } = await import('../../utils/item-classifier.js');

    // Önce tüm itemların type bilgilerini çek
    const itemsWithTypes = await Promise.all(
      itemsWithSameFlag.map(async (item: any) => {
        const type = await context.loaders.type.load(item.item_type_id);
        return { ...item, type };
      })
    );

    // Current item'ı bul
    const currentItem = itemsWithTypes.find((item: any) =>
      item.item_type_id === itemTypeId
    );

    if (!currentItem || !currentItem.type) {
      return null;
    }

    // Eğer current item bir charge ise, charge'ı yok (charge'ın charge'ı olmaz)
    if (isCharge(currentItem.type.group_id)) {
      return null;
    }

    // Current item bir modül - diğer itemlar arasında charge ara
    const chargeItem = itemsWithTypes.find((item: any) =>
      item.item_type_id !== itemTypeId &&
      item.type &&
      isCharge(item.type.group_id)
    );

    if (!chargeItem) {
      return null;
    }

    // Charge item'ı GraphQL formatında döndür
    return {
      itemTypeId: chargeItem.item_type_id,
      flag: chargeItem.flag,
      quantityDropped: chargeItem.quantity_dropped ?? null,
      quantityDestroyed: chargeItem.quantity_destroyed ?? null,
      singleton: chargeItem.singleton,
      killmailId: chargeItem.killmail_id,
    };
  },
};

/**
 * FittingModule Field Resolvers
 * Handles nested fields for FittingModule type (used in Fitting)
 */
export const fittingModuleFields: FittingModuleResolvers = {
  itemType: async (parent: any, _, context) => {
    if (!parent.itemTypeId) return null;
    const type = await context.loaders.type.load(parent.itemTypeId);
    if (!type) return null;
    return {
      ...type,
      created_at: type.created_at.toISOString(),
      updated_at: type.updated_at.toISOString(),
    } as any;
  },
  charge: async (parent: any) => {
    // Charge already resolved in fitting helper
    return parent.charge || null;
  },
};

