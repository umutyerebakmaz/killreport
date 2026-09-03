/**
 * EVE inventory group ids, for scoping killmails by what the victim was flying.
 * Reference: https://www.fuzzwork.co.uk/dump/latest/invGroups.csv
 *
 * The frontend keeps its own copy in utils/shipGroups.ts for the filter UI. This
 * one is the server's, because scope is decided server-side.
 */

/** Citadels, engineering complexes, refineries and the two starbase groups. */
export const STRUCTURE_GROUP_IDS: number[] = [
  365, // Control Tower
  404, // Starbase Structure
  1657, // Citadel
  1404, // Engineering Complex
  1406, // Refinery
];

/** Pods. Cheap and numerous; they drown out a value ranking. */
export const CAPSULE_GROUP_IDS: number[] = [
  29, // Capsule
];

/** Carriers through titans, plus the capital industrial hull. */
export const CAPITAL_GROUP_IDS: number[] = [
  547, // Carrier
  485, // Dreadnought
  659, // Supercarrier
  30, // Titan
  1538, // Force Auxiliary
  883, // Capital Industrial Ship
];

/** What the SHIPS and SOLO scopes leave out. */
export const NON_SHIP_GROUP_IDS: number[] = [
  ...STRUCTURE_GROUP_IDS,
  ...CAPSULE_GROUP_IDS,
];
