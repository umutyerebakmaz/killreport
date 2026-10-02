import { ShipTierFilter } from '@/generated/graphql';

/**
 * Utility functions for handling killmail filter URL parameters
 */

const SHIP_TIERS = Object.values(ShipTierFilter);

export interface KillmailFilters {
  shipTypeId?: number;
  shipGroupIds?: number[];
  shipTier?: ShipTierFilter;
  characterId?: number;
  victim?: boolean;
  attacker?: boolean;
  characterVictim?: boolean;
  characterAttacker?: boolean;
  regionId?: number;
  constellationId?: number;
  systemId?: number;
  securitySpace?: string;
  minAttackers?: number;
  maxAttackers?: number;
  minValue?: number;
  maxValue?: number;
  warRelated?: boolean;
}

export interface ParsedUrlFilters extends KillmailFilters {
  page: number;
  shipTypeRole: 'all' | 'victim' | 'attacker';
  characterRole: 'all' | 'victim' | 'attacker';
  securitySpaceRole:
    'all' | 'highsec' | 'lowsec' | 'nullsec' | 'wormhole' | 'abyssal';
}

/**
 * Parse killmail filters from URL search parameters
 */
export function parseKillmailFiltersFromUrl(
  searchParams: URLSearchParams,
): ParsedUrlFilters {
  const page = Number(searchParams.get('page')) || 1;

  const shipTypeIdFromUrl = searchParams.get('shipTypeId')
    ? Number(searchParams.get('shipTypeId'))
    : undefined;

  const shipGroupIdsFromUrl = searchParams.get('shipGroupIds')
    ? searchParams.get('shipGroupIds')!.split(',').map(Number)
    : undefined;

  // Lower case in the URL (?shipTier=faction), the enum's upper case in the
  // filter; anything else is ignored rather than sent to the API.
  const shipTierParam = searchParams.get('shipTier')?.toUpperCase();
  const shipTierFromUrl = SHIP_TIERS.find((tier) => tier === shipTierParam);

  const characterIdFromUrl = searchParams.get('characterId')
    ? Number(searchParams.get('characterId'))
    : undefined;

  const minAttackersFromUrl = searchParams.get('minAttackers')
    ? Number(searchParams.get('minAttackers'))
    : undefined;

  const maxAttackersFromUrl = searchParams.get('maxAttackers')
    ? Number(searchParams.get('maxAttackers'))
    : undefined;

  const minValueFromUrl = searchParams.get('minValue')
    ? Number(searchParams.get('minValue'))
    : undefined;

  const maxValueFromUrl = searchParams.get('maxValue')
    ? Number(searchParams.get('maxValue'))
    : undefined;

  const systemIdFromUrl = searchParams.get('systemId')
    ? Number(searchParams.get('systemId'))
    : undefined;

  const constellationIdFromUrl = searchParams.get('constellationId')
    ? Number(searchParams.get('constellationId'))
    : undefined;

  const regionIdFromUrl = searchParams.get('regionId')
    ? Number(searchParams.get('regionId'))
    : undefined;

  const shipTypeRoleFromUrl =
    (searchParams.get('shipTypeRole') as
      'all' | 'victim' | 'attacker' | null) ?? 'all';

  const characterRoleFromUrl =
    (searchParams.get('characterRole') as
      'all' | 'victim' | 'attacker' | null) ?? 'all';

  const securitySpaceRoleFromUrl =
    (searchParams.get('securitySpace') as
      | 'all'
      | 'highsec'
      | 'lowsec'
      | 'nullsec'
      | 'wormhole'
      | 'abyssal'
      | null) ?? 'all';

  const warRelatedFromUrl =
    searchParams.get('warRelated') === 'true' ? true : undefined;

  // The ship role applies to any ship filter: a ship, ship groups or a tier.
  const hasShipFilter = Boolean(
    shipTypeIdFromUrl ||
    (shipGroupIdsFromUrl && shipGroupIdsFromUrl.length > 0) ||
    shipTierFromUrl,
  );

  // Build filters object
  const filters: KillmailFilters = {
    warRelated: warRelatedFromUrl,
    shipTypeId: shipTypeIdFromUrl,
    shipGroupIds: shipGroupIdsFromUrl,
    shipTier: shipTierFromUrl,
    characterId: characterIdFromUrl,
    systemId: systemIdFromUrl,
    constellationId: constellationIdFromUrl,
    regionId: regionIdFromUrl,
    securitySpace:
      securitySpaceRoleFromUrl !== 'all' ? securitySpaceRoleFromUrl : undefined,
    minAttackers: minAttackersFromUrl,
    maxAttackers: maxAttackersFromUrl,
    minValue: minValueFromUrl,
    maxValue: maxValueFromUrl,
    victim:
      hasShipFilter && shipTypeRoleFromUrl === 'victim'
        ? true
        : hasShipFilter && shipTypeRoleFromUrl === 'attacker'
          ? false
          : undefined,
    attacker:
      hasShipFilter && shipTypeRoleFromUrl === 'attacker'
        ? true
        : hasShipFilter && shipTypeRoleFromUrl === 'victim'
          ? false
          : undefined,
    characterVictim:
      characterIdFromUrl && characterRoleFromUrl === 'victim'
        ? true
        : characterIdFromUrl && characterRoleFromUrl === 'attacker'
          ? false
          : undefined,
    characterAttacker:
      characterIdFromUrl && characterRoleFromUrl === 'attacker'
        ? true
        : characterIdFromUrl && characterRoleFromUrl === 'victim'
          ? false
          : undefined,
  };

  return {
    page,
    shipTypeRole: shipTypeRoleFromUrl,
    characterRole: characterRoleFromUrl,
    securitySpaceRole: securitySpaceRoleFromUrl,
    ...filters,
  };
}

/**
 * Every filter the URL carries, without the page and the role fields the form
 * keeps for itself. The page used to copy the filters out field by field, and
 * a new filter (the ship tier) was left out of that copy: it sat in the URL and
 * never reached the query.
 */
export function killmailFiltersOf(parsed: ParsedUrlFilters): KillmailFilters {
  const filters: KillmailFilters & Partial<ParsedUrlFilters> = { ...parsed };
  delete filters.page;
  delete filters.shipTypeRole;
  delete filters.characterRole;
  delete filters.securitySpaceRole;
  return filters;
}

/** Whether any filter is set: an empty list, false or undefined is none. */
export function hasActiveKillmailFilters(filters: KillmailFilters): boolean {
  return Object.values(filters).some((value) =>
    Array.isArray(value)
      ? value.length > 0
      : value !== undefined && value !== false,
  );
}

/**
 * Build URL search parameters from current page and filters
 */
export function buildKillmailFiltersUrl(
  currentPage: number,
  filters: KillmailFilters,
): string {
  const params = new URLSearchParams();

  params.set('page', currentPage.toString());

  if (filters.shipTypeId) {
    params.set('shipTypeId', filters.shipTypeId.toString());
  }

  if (filters.shipGroupIds && filters.shipGroupIds.length > 0) {
    params.set('shipGroupIds', filters.shipGroupIds.join(','));
  }

  if (filters.shipTier) {
    params.set('shipTier', filters.shipTier.toLowerCase());
  }

  // One victim / attacker role for whichever ship filters are set.
  if (
    filters.shipTypeId ||
    (filters.shipGroupIds && filters.shipGroupIds.length > 0) ||
    filters.shipTier
  ) {
    if (filters.victim === true && filters.attacker === false) {
      params.set('shipTypeRole', 'victim');
    } else if (filters.attacker === true && filters.victim === false) {
      params.set('shipTypeRole', 'attacker');
    }
  }

  if (filters.characterId) {
    params.set('characterId', filters.characterId.toString());
    if (
      filters.characterVictim === true &&
      filters.characterAttacker === false
    ) {
      params.set('characterRole', 'victim');
    } else if (
      filters.characterAttacker === true &&
      filters.characterVictim === false
    ) {
      params.set('characterRole', 'attacker');
    }
  }

  if (filters.minAttackers) {
    params.set('minAttackers', filters.minAttackers.toString());
  }

  if (filters.maxAttackers) {
    params.set('maxAttackers', filters.maxAttackers.toString());
  }

  if (filters.minValue) {
    params.set('minValue', filters.minValue.toString());
  }

  if (filters.maxValue) {
    params.set('maxValue', filters.maxValue.toString());
  }

  if (filters.systemId) {
    params.set('systemId', filters.systemId.toString());
  }

  if (filters.constellationId) {
    params.set('constellationId', filters.constellationId.toString());
  }

  if (filters.regionId) {
    params.set('regionId', filters.regionId.toString());
  }

  if (filters.securitySpace && filters.securitySpace !== 'all') {
    params.set('securitySpace', filters.securitySpace);
  }

  if (filters.warRelated) {
    params.set('warRelated', 'true');
  }

  return params.toString();
}
