import { TypeResolvers } from '@generated-types';
import prisma from '@services/prisma';

/**
 * Type Field Resolvers
 * Handles nested fields and computed properties for Type
 * Uses DataLoaders to prevent N+1 queries
 */
export const typeFields: TypeResolvers = {
  group: async (parent, _, context) => {
    // Cast to any to access Prisma model fields
    const prismaType = parent as any;
    if (!prismaType.group_id) return null;
    const group = await context.loaders.itemGroup.load(prismaType.group_id);
    if (!group) return null;

    return {
      ...group,
      created_at: group.created_at.toISOString(),
      updated_at: group.updated_at.toISOString(),
    } as any;
  },

  dogmaAttributes: async (parent, args, context) => {
    const prismaType = parent as any;

    // LAZY LOADING: Eğer ids varsa, sadece o ID'leri çek (direct query)
    if (args.ids && args.ids.length > 0) {
      const attributes = await prisma.typeDogmaAttribute.findMany({
        where: {
          type_id: prismaType.id,
          attribute_id: { in: args.ids }
        },
        include: { attribute: true }
      });

      return attributes.map((attr) => ({
        type_id: attr.type_id,
        attribute_id: attr.attribute_id,
        value: attr.value,
        attribute: {
          id: attr.attribute.id,
          name: attr.attribute.name,
          display_name: attr.attribute.display_name,
          description: attr.attribute.description,
          unit_id: attr.attribute.unit_id,
          icon_id: attr.attribute.icon_id,
          default_value: attr.attribute.default_value,
          published: attr.attribute.published,
          stackable: attr.attribute.stackable,
          high_is_good: attr.attribute.high_is_good,
          created_at: attr.attribute.created_at.toISOString(),
          updated_at: attr.attribute.updated_at.toISOString(),
        },
      }));
    }

    // ids yoksa DataLoader kullan (N+1 prevention)
    const attributes = await context.loaders.typeDogmaAttributes.load(prismaType.id);

    return attributes.map((attr: any) => ({
      type_id: attr.type_id,
      attribute_id: attr.attribute_id,
      value: attr.value,
      attribute: {
        id: attr.attribute.id,
        name: attr.attribute.name,
        display_name: attr.attribute.display_name,
        description: attr.attribute.description,
        unit_id: attr.attribute.unit_id,
        icon_id: attr.attribute.icon_id,
        default_value: attr.attribute.default_value,
        published: attr.attribute.published,
        stackable: attr.attribute.stackable,
        high_is_good: attr.attribute.high_is_good,
        created_at: attr.attribute.created_at.toISOString(),
        updated_at: attr.attribute.updated_at.toISOString(),
      },
    }));
  },

  dogmaEffects: async (parent, args, context) => {
    const prismaType = parent as any;

    // LAZY LOADING: Eğer ids varsa, sadece o ID'leri çek (direct query)
    if (args.ids && args.ids.length > 0) {
      const effects = await prisma.typeDogmaEffect.findMany({
        where: {
          type_id: prismaType.id,
          effect_id: { in: args.ids }
        },
        include: { effect: true }
      });

      return effects.map((eff) => ({
        type_id: eff.type_id,
        effect_id: eff.effect_id,
        is_default: eff.is_default,
        effect: {
          id: eff.effect.id,
          name: eff.effect.name,
          display_name: eff.effect.display_name,
          description: eff.effect.description,
          effect_category: eff.effect.effect_category,
          pre_expression: eff.effect.pre_expression,
          post_expression: eff.effect.post_expression,
          icon_id: eff.effect.icon_id,
          published: eff.effect.published,
          is_offensive: eff.effect.is_offensive,
          is_assistance: eff.effect.is_assistance,
          disallow_auto_repeat: eff.effect.disallow_auto_repeat,
          created_at: eff.effect.created_at.toISOString(),
          updated_at: eff.effect.updated_at.toISOString(),
        },
      }));
    }

    // ids yoksa DataLoader kullan (N+1 prevention)
    const effects = await context.loaders.typeDogmaEffects.load(prismaType.id);

    return effects.map((eff: any) => ({
      type_id: eff.type_id,
      effect_id: eff.effect_id,
      is_default: eff.is_default,
      effect: {
        id: eff.effect.id,
        name: eff.effect.name,
        display_name: eff.effect.display_name,
        description: eff.effect.description,
        effect_category: eff.effect.effect_category,
        pre_expression: eff.effect.pre_expression,
        post_expression: eff.effect.post_expression,
        icon_id: eff.effect.icon_id,
        published: eff.effect.published,
        is_offensive: eff.effect.is_offensive,
        is_assistance: eff.effect.is_assistance,
        disallow_auto_repeat: eff.effect.disallow_auto_repeat,
        created_at: eff.effect.created_at.toISOString(),
        updated_at: eff.effect.updated_at.toISOString(),
      },
    }));
  },
};
