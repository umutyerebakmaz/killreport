/**
 * EVE Online ship tier detection via dogma attributes
 *
 * Attribute ID 422  = techLevel     (1=T1, 2=T2, 3=T3)
 * Attribute ID 1692 = metaGroupID   (1=T1, 2=T2, 3=Storyline, 4=Faction/Navy/Fleet, 5=Officer, 6=Deadspace)
 */

export type ShipTier = "T2" | "T3" | "faction" | "officer" | null;

interface DogmaAttr {
  attribute_id: number;
  value: number;
}

export function getShipTier(
  dogmaAttributes: DogmaAttr[] | null | undefined,
): ShipTier {
  if (!dogmaAttributes || dogmaAttributes.length === 0) return null;

  const techLevel =
    dogmaAttributes.find((a) => a.attribute_id === 422)?.value ?? 1;
  const metaGroupId =
    dogmaAttributes.find((a) => a.attribute_id === 1692)?.value ?? 1;

  if (techLevel === 3) return "T3";
  if (techLevel === 2) return "T2";
  if (metaGroupId === 5 || metaGroupId === 6) return "officer"; // Officer / Deadspace
  if (metaGroupId === 3 || metaGroupId === 4) return "faction"; // Storyline / Faction / Navy / Fleet

  return null;
}
