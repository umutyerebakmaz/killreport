import {
    AttackerResolvers,
    FittingModuleResolvers,
    KillmailItemResolvers,
    KillmailResolvers,
    VictimResolvers,
} from '@generated-types';
import { organizeFitting } from '@helpers/fitting-helper';

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

    finalBlow: async (parent: any, _, context) => {
        const killmailId = typeof parent.id === 'string' ? parseInt(parent.id) : parent.id;

        // Use optimized finalBlow DataLoader - only fetches final_blow: true attackers
        const finalBlowAttacker = await context.loaders.finalBlow.load(killmailId);

        if (!finalBlowAttacker) {
            return null;
        }

        // Return in the same format as attackers field resolver
        return {
            characterId: finalBlowAttacker.character_id ?? null,
            corporationId: finalBlowAttacker.corporation_id ?? null,
            allianceId: finalBlowAttacker.alliance_id ?? null,
            factionId: finalBlowAttacker.faction_id ?? null,
            shipTypeId: finalBlowAttacker.ship_type_id ?? null,
            weaponTypeId: finalBlowAttacker.weapon_type_id ?? null,
            damageDone: finalBlowAttacker.damage_done,
            finalBlow: finalBlowAttacker.final_blow,
            securityStatus: finalBlowAttacker.security_status,
        };
    },

    attackerCount: async (parent: any, _, context) => {
        const killmailId = typeof parent.id === 'string' ? parseInt(parent.id) : parent.id;

        // Use optimized attackerCount DataLoader - batch loads counts for multiple killmails
        const count = await context.loaders.attackerCount.load(killmailId);

        return count;
    },

    solo: async (parent: any, _, context) => {
        const killmailId = typeof parent.id === 'string' ? parseInt(parent.id) : parent.id;

        // Use attackerCount DataLoader to check if solo
        const count = await context.loaders.attackerCount.load(killmailId);

        return count === 1;
    },

    npc: async (parent: any, _, context) => {
        const killmailId = typeof parent.id === 'string' ? parseInt(parent.id) : parent.id;

        // Load all attackers for this killmail
        const attackers = await context.loaders.attackers.load(killmailId);

        // Check if all attackers are from NPC corporations
        // NPC corporations have IDs < 2,000,000 AND attackers typically don't have character_id
        if (attackers.length === 0) return false;

        const allNpc = attackers.every((attacker: any) => {
            const corpId = attacker.corporation_id;
            const hasCharacter = attacker.character_id !== null && attacker.character_id !== undefined;

            // NPC if: has corporation AND corporation_id < 2,000,000 AND no character
            return corpId && corpId < 2000000 && !hasCharacter;
        });

        return allNpc;
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
        let isCapsule = false;

        if (victim?.ship_type_id) {
            // Get ship type group ID to check if it should have fitting slots
            const shipType = await context.loaders.type.load(victim.ship_type_id);
            const groupId = shipType?.group_id;

            // Check if this is a Capsule (group_id = 29)
            isCapsule = groupId === 29;

            // Group IDs that should not show fitting slots
            // 29: Capsule (Pod) - only has implants
            // 31: Shuttle
            // 361: Mobile Warp Disruptor
            // 1025: Orbital Infrastructure (Customs Office)
            // 1246: Mobile Tractor Unit
            // 1247: Mobile Depot
            // 1249: Mobile Cynosural Inhibitor
            // 1250: Mobile Jump Disruptor
            // 1272: Mobile Micro Jump Unit
            const noFittingGroupIds = [29, 31, 361, 1025, 1246, 1247, 1249, 1250, 1272];
            const shouldHaveFitting = groupId ? !noFittingGroupIds.includes(groupId) : true;

            // If ship shouldn't have fitting (including Capsules), return empty fitting with 0 slots
            if (!shouldHaveFitting) {
                slotCounts = {
                    hiSlots: 0,
                    medSlots: 0,
                    lowSlots: 0,
                    rigSlots: 0,
                    serviceSlots: 0,
                };
            } else {
                const dogmaAttributes = await context.loaders.typeDogmaAttributes.load(
                    victim.ship_type_id
                );

                if (dogmaAttributes && dogmaAttributes.length > 0) {
                    // Extract slot counts from dogma attributes
                    // Attribute IDs: hiSlots=14, medSlots=13, lowSlots=12, rigSlots=1137, serviceSlots=2056
                    const hiSlotsAttr = dogmaAttributes.find((attr: any) => attr.attribute_id === 14);
                    const medSlotsAttr = dogmaAttributes.find((attr: any) => attr.attribute_id === 13);
                    const lowSlotsAttr = dogmaAttributes.find((attr: any) => attr.attribute_id === 12);
                    const rigSlotsAttr = dogmaAttributes.find((attr: any) => attr.attribute_id === 1137);
                    const serviceSlotsAttr = dogmaAttributes.find((attr: any) => attr.attribute_id === 2056);

                    let hiSlots = hiSlotsAttr?.value ?? 0;
                    let medSlots = medSlotsAttr?.value ?? 0;
                    let lowSlots = lowSlotsAttr?.value ?? 0;
                    const rigSlots = rigSlotsAttr?.value ?? 3;

                    // FIX: Strategic Cruisers (T3) and some special ships have slot counts = 0
                    // because they vary by subsystem/configuration.
                    // For T3Cs, subsystems modify slot counts through dogma effects.
                    // We need to calculate from subsystems' attribute modifiers.
                    if (hiSlots === 0 || medSlots === 0 || lowSlots === 0) {
                        // Get fitted subsystems
                        const subsystemItems = rawItems.filter((i: any) => i.flag >= 125 && i.flag <= 128);

                        if (subsystemItems.length > 0) {
                            // Strategic Cruiser with subsystems - calculate from subsystem attributes
                            let subsystemHiBonus = 0;
                            let subsystemMedBonus = 0;
                            let subsystemLowBonus = 0;

                            for (const subsystem of subsystemItems) {
                                const subsystemDogma = await context.loaders.typeDogmaAttributes.load(
                                    subsystem.item_type_id
                                );

                                if (subsystemDogma) {
                                    // Subsystems use modifiers - attribute 14/13/12 with value indicating bonus
                                    const hiBonus = subsystemDogma.find((attr: any) => attr.attribute_id === 14);
                                    const medBonus = subsystemDogma.find((attr: any) => attr.attribute_id === 13);
                                    const lowBonus = subsystemDogma.find((attr: any) => attr.attribute_id === 12);

                                    if (hiBonus) subsystemHiBonus += hiBonus.value;
                                    if (medBonus) subsystemMedBonus += medBonus.value;
                                    if (lowBonus) subsystemLowBonus += lowBonus.value;
                                }
                            }

                            // T3C base has some slots, subsystems add more
                            if (hiSlots === 0) hiSlots = Math.round(subsystemHiBonus);
                            if (medSlots === 0) medSlots = Math.round(subsystemMedBonus);
                            if (lowSlots === 0) lowSlots = Math.round(subsystemLowBonus);
                        }

                        // Fallback: Calculate from fitted items if subsystem calculation didn't work
                        if (hiSlots === 0 || medSlots === 0 || lowSlots === 0) {
                            const highFlags = rawItems.filter((i: any) => i.flag >= 27 && i.flag <= 34);
                            const midFlags = rawItems.filter((i: any) => i.flag >= 19 && i.flag <= 26);
                            const lowFlags = rawItems.filter((i: any) => i.flag >= 11 && i.flag <= 18);

                            if (hiSlots === 0 && highFlags.length > 0) {
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

                            // Final fallback to defaults if still 0
                            hiSlots = hiSlots || 8;
                            medSlots = medSlots || 8;
                            lowSlots = lowSlots || 8;
                        }
                    }

                    slotCounts = {
                        hiSlots,
                        medSlots,
                        lowSlots,
                        rigSlots,
                        serviceSlots: serviceSlotsAttr?.value ?? undefined,
                    };
                }
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
            subsystems: {
                totalSlots: fitting.subsystemSlots.length,
                slots: fitting.subsystemSlots.map((slot) => ({
                    slotIndex: slot.slotIndex,
                    module: slot.module
                        ? {
                            itemTypeId: slot.module.itemTypeId,
                            flag: slot.module.flag,
                            quantityDropped: slot.module.quantityDropped,
                            quantityDestroyed: slot.module.quantityDestroyed,
                            singleton: slot.module.singleton,
                            charge: null, // Subsystems never have charges
                        }
                        : null,
                })),
            },
            serviceSlots: {
                totalSlots: fitting.serviceSlots.length,
                slots: fitting.serviceSlots.map((slot) => ({
                    slotIndex: slot.slotIndex,
                    module: slot.module
                        ? {
                            itemTypeId: slot.module.itemTypeId,
                            flag: slot.module.flag,
                            quantityDropped: slot.module.quantityDropped,
                            quantityDestroyed: slot.module.quantityDestroyed,
                            singleton: slot.module.singleton,
                            charge: null, // Service modules never have charges
                        }
                        : null,
                })),
            },
            implants: isCapsule
                ? await (async () => {
                    // For Capsules (Pods), create 10 implant slots like high/mid/low slots
                    console.log('🔍 Capsule detected! Creating 10 implant slots...');
                    console.log('Total raw items:', rawItems.length);

                    // Create 10 empty slots
                    const implantSlots: any[] = Array.from({ length: 10 }, (_, i) => ({
                        slotIndex: i,
                        module: null,
                    }));

                    await Promise.all(
                        rawItems.map(async (item: any) => {
                            // Get dogma attributes for this item type
                            const dogmaAttrs = await context.loaders.typeDogmaAttributes.load(item.item_type_id);

                            // Find implantness attribute (ID: 331)
                            const implantness = dogmaAttrs?.find((attr: any) => attr.attribute_id === 331);

                            if (implantness) {
                                const slotNumber = Math.round(implantness.value); // Slot number (1-10)
                                const slotIndex = slotNumber - 1; // Array index (0-9)

                                console.log(`💎 Found implant: type_id=${item.item_type_id}, implantness=${implantness.value}, slot=${slotNumber}, index=${slotIndex}`);

                                if (slotIndex >= 0 && slotIndex < 10) {
                                    implantSlots[slotIndex].module = {
                                        itemTypeId: item.item_type_id,
                                        flag: item.flag,
                                        quantityDropped: item.quantity_dropped,
                                        quantityDestroyed: item.quantity_destroyed,
                                        singleton: item.singleton,
                                        charge: null,
                                    };
                                }
                            }
                        })
                    );

                    const filledCount = implantSlots.filter(slot => slot.module !== null).length;
                    console.log(`✅ Total implants found: ${filledCount} / 10`);
                    console.log('📊 Implant slots:', implantSlots.map((s, i) => s.module ? `Slot ${i + 1}: filled` : `Slot ${i + 1}: empty`).join(', '));

                    return {
                        totalSlots: 10,
                        slots: implantSlots,
                    };
                })()
                : {
                    totalSlots: 0,
                    slots: [],
                },
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
            structureFuel: fitting.structureFuel.map((module) => ({
                itemTypeId: module.itemTypeId,
                flag: module.flag,
                quantityDropped: module.quantityDropped,
                quantityDestroyed: module.quantityDestroyed,
                singleton: module.singleton,
                charge: null,
            })),
            coreRoom: fitting.coreRoom.map((module) => ({
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

