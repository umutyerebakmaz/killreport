/**
 * Facts about an EVE item type: whether it is a blueprint, and what to call
 * it. The image URL that used to live here is `utils/eveImageUrl.ts` now,
 * which is why this file no longer has "ImageUrl" in its name.
 */

// Check if item is a blueprint
export const isBlueprint = (itemType: any): boolean => {
  const categoryName = itemType?.group?.category?.name;
  const isCategory = categoryName?.toLowerCase() === 'blueprint';

  // Fallback: check if name contains "Blueprint" when category is not available
  if (!isCategory && itemType?.name) {
    return itemType.name.toLowerCase().includes('blueprint');
  }

  return isCategory;
};

// Get item name with "Copy" suffix for BPCs
export const getItemName = (itemType: any, singleton: number = 1): string => {
  const name = itemType?.name || '';
  const blueprint = isBlueprint(itemType);
  const isCopy = blueprint && singleton === 2;
  return isCopy ? `${name} Copy` : name;
};
