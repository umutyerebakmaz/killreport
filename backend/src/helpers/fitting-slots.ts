/**
 * Whether a killmail's victim is something with fitting slots at all.
 *
 * Only ships and Upwell structures are fitted. Deployables (cyno beacons,
 * mobile depots, tractor units), fighters, starbase modules and orbitals are
 * not, so their killmails draw no slots. This used to be a hand-kept list of
 * group ids, which had missed the Mobile Cynosural Beacon, the Mobile
 * Analysis Beacon, the Mobile Observatory, every fighter and every POS
 * module, and named the Mobile Micro Jump Unit by the wrong id; the category
 * covers each of them and any added later.
 *
 * The capsule (29) and the shuttle (31) are ships with no slots shown, as
 * before: the capsule draws its implants instead.
 */
const FITTED_CATEGORIES = new Set(['Ship', 'Structure']);
const UNFITTED_SHIP_GROUPS = new Set([29, 31]);

export function hasFittingSlots(
  categoryName: string | null | undefined,
  groupId: number | null | undefined,
): boolean {
  // A group or category not fetched from ESI yet: keep the slots, the old
  // behaviour, which is the safer miss for a real ship.
  if (!categoryName) return true;
  if (!FITTED_CATEGORIES.has(categoryName)) return false;
  return !(groupId != null && UNFITTED_SHIP_GROUPS.has(groupId));
}
