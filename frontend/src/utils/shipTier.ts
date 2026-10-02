/**
 * EVE Online ship tier, from the type's meta group.
 *
 * The meta group comes from CCP's Static Data Export (types.meta_group_id,
 * filled by `yarn sde:meta-groups` in the backend) and is read first: ESI's
 * own metaGroupID dogma attribute is missing on many types, recent faction
 * hulls such as Phoenix Navy Issue among them, so those came out untiered.
 *
 * A type the import has not reached yet falls back to the dogma attributes:
 * Attribute ID 422  = techLevel     (1=T1, 2=T2, 3=T3)
 * Attribute ID 1692 = metaGroupID   (1=T1, 2=T2, 3=Storyline, 4=Faction/Navy/Fleet, 5=Officer, 6=Deadspace)
 */

export type ShipTier = 'T2' | 'T3' | 'faction' | 'officer' | null;

interface DogmaAttr {
  attribute_id: number;
  value: number;
}

interface TieredType {
  metaGroupId?: number | null;
  dogmaAttributes?: DogmaAttr[] | null;
}

/** Meta groups with a badge; every other group (Tech I, Abyssal, …) has none. */
const BY_META_GROUP: Record<number, ShipTier> = {
  2: 'T2',
  14: 'T3',
  3: 'faction', // Storyline
  4: 'faction', // Faction / Navy / Fleet
  5: 'officer',
  6: 'officer', // Deadspace
};

export function getShipTier(type: TieredType | null | undefined): ShipTier {
  if (!type) return null;

  if (type.metaGroupId != null) {
    return BY_META_GROUP[type.metaGroupId] ?? null;
  }

  const dogmaAttributes = type.dogmaAttributes;
  if (!dogmaAttributes || dogmaAttributes.length === 0) return null;

  const techLevel =
    dogmaAttributes.find((a) => a.attribute_id === 422)?.value ?? 1;
  const metaGroupId =
    dogmaAttributes.find((a) => a.attribute_id === 1692)?.value ?? 1;

  if (techLevel === 3) return 'T3';
  if (techLevel === 2) return 'T2';
  if (metaGroupId === 5 || metaGroupId === 6) return 'officer'; // Officer / Deadspace
  if (metaGroupId === 3 || metaGroupId === 4) return 'faction'; // Storyline / Faction / Navy / Fleet

  return null;
}
