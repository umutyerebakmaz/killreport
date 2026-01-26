// Utility to check if a corporation is NPC (EVE convention: corpID < 2,000,000)
export function isNPCCorporation(id?: number | null): boolean {
  return !!id && id < 2000000;
}
