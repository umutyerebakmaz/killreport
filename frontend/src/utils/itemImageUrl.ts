/**
 * Utility functions for handling EVE Online item images and names
 * Includes special handling for blueprints (BPO vs BPC)
 */

// Check if item is a blueprint
export const isBlueprint = (itemType: any): boolean => {
  const categoryName = itemType?.group?.category?.name;
  return categoryName?.toLowerCase() === "blueprint";
};

// Get item name with "Copy" suffix for BPCs
export const getItemName = (itemType: any, singleton: number = 1): string => {
  const name = itemType?.name || "";
  const blueprint = isBlueprint(itemType);
  const isCopy = blueprint && singleton === 2;
  return isCopy ? `${name} Copy` : name;
};

// Get item image URL with blueprint support (BPO vs BPC)
export const getItemImageUrl = (
  itemType: any,
  singleton: number = 1,
  size: number = 64,
): string => {
  const typeId = itemType?.id;
  if (!typeId) return "";

  const blueprint = isBlueprint(itemType);

  // Debug - Type 25949 için
  if (typeId === 25949) {
    console.log("🔍 Type 25949 Debug:", {
      typeId,
      singleton,
      blueprint,
      categoryName: itemType?.group?.category?.name,
      groupName: itemType?.group?.name,
      itemTypeName: itemType?.name,
    });
  }

  if (!blueprint) {
    return `https://images.evetech.net/types/${typeId}/icon?size=${size}`;
  }

  // Blueprint: singleton=1 is BPO (Original), singleton=2 is BPC (Copy)
  const isCopy = singleton === 2;
  const url = `https://images.evetech.net/types/${typeId}/${isCopy ? "bpc" : "bp"}?size=${size}`;

  if (typeId === 25949) {
    console.log("🎯 Generated URL:", url);
  }

  return url;
}
