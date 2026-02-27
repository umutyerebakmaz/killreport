/**
 * Utility functions for handling killmail filter URL parameters
 */

export interface KillmailFilters {
    shipTypeId?: number;
    characterId?: number;
    victim?: boolean;
    attacker?: boolean;
    characterVictim?: boolean;
    characterAttacker?: boolean;
    regionId?: number;
    systemId?: number;
    minAttackers?: number;
    maxAttackers?: number;
    minValue?: number;
    maxValue?: number;
}

export interface ParsedUrlFilters extends KillmailFilters {
    page: number;
    shipTypeRole: "all" | "victim" | "attacker";
    characterRole: "all" | "victim" | "attacker";
}

/**
 * Parse killmail filters from URL search parameters
 */
export function parseKillmailFiltersFromUrl(
    searchParams: URLSearchParams
): ParsedUrlFilters {
    const page = Number(searchParams.get("page")) || 1;

    const shipTypeIdFromUrl = searchParams.get("shipTypeId")
        ? Number(searchParams.get("shipTypeId"))
        : undefined;

    const characterIdFromUrl = searchParams.get("characterId")
        ? Number(searchParams.get("characterId"))
        : undefined;

    const minAttackersFromUrl = searchParams.get("minAttackers")
        ? Number(searchParams.get("minAttackers"))
        : undefined;

    const maxAttackersFromUrl = searchParams.get("maxAttackers")
        ? Number(searchParams.get("maxAttackers"))
        : undefined;

    const minValueFromUrl = searchParams.get("minValue")
        ? Number(searchParams.get("minValue"))
        : undefined;

    const maxValueFromUrl = searchParams.get("maxValue")
        ? Number(searchParams.get("maxValue"))
        : undefined;

    const shipTypeRoleFromUrl =
        (searchParams.get("shipTypeRole") as "all" | "victim" | "attacker" | null) ?? "all";

    const characterRoleFromUrl =
        (searchParams.get("characterRole") as "all" | "victim" | "attacker" | null) ?? "all";

    // Build filters object
    const filters: KillmailFilters = {
        shipTypeId: shipTypeIdFromUrl,
        characterId: characterIdFromUrl,
        minAttackers: minAttackersFromUrl,
        maxAttackers: maxAttackersFromUrl,
        minValue: minValueFromUrl,
        maxValue: maxValueFromUrl,
        victim:
            shipTypeIdFromUrl && shipTypeRoleFromUrl === "victim"
                ? true
                : shipTypeIdFromUrl && shipTypeRoleFromUrl === "attacker"
                    ? false
                    : undefined,
        attacker:
            shipTypeIdFromUrl && shipTypeRoleFromUrl === "attacker"
                ? true
                : shipTypeIdFromUrl && shipTypeRoleFromUrl === "victim"
                    ? false
                    : undefined,
        characterVictim:
            characterIdFromUrl && characterRoleFromUrl === "victim"
                ? true
                : characterIdFromUrl && characterRoleFromUrl === "attacker"
                    ? false
                    : undefined,
        characterAttacker:
            characterIdFromUrl && characterRoleFromUrl === "attacker"
                ? true
                : characterIdFromUrl && characterRoleFromUrl === "victim"
                    ? false
                    : undefined,
    };

    return {
        page,
        shipTypeRole: shipTypeRoleFromUrl,
        characterRole: characterRoleFromUrl,
        ...filters,
    };
}

/**
 * Build URL search parameters from current page and filters
 */
export function buildKillmailFiltersUrl(
    currentPage: number,
    filters: KillmailFilters
): string {
    const params = new URLSearchParams();

    params.set("page", currentPage.toString());

    if (filters.shipTypeId) {
        params.set("shipTypeId", filters.shipTypeId.toString());
        if (filters.victim === true && filters.attacker === false) {
            params.set("shipTypeRole", "victim");
        } else if (filters.attacker === true && filters.victim === false) {
            params.set("shipTypeRole", "attacker");
        }
    }

    if (filters.characterId) {
        params.set("characterId", filters.characterId.toString());
        if (
            filters.characterVictim === true &&
            filters.characterAttacker === false
        ) {
            params.set("characterRole", "victim");
        } else if (
            filters.characterAttacker === true &&
            filters.characterVictim === false
        ) {
            params.set("characterRole", "attacker");
        }
    }

    if (filters.minAttackers) {
        params.set("minAttackers", filters.minAttackers.toString());
    }

    if (filters.maxAttackers) {
        params.set("maxAttackers", filters.maxAttackers.toString());
    }

    if (filters.minValue) {
        params.set("minValue", filters.minValue.toString());
    }

    if (filters.maxValue) {
        params.set("maxValue", filters.maxValue.toString());
    }

    return params.toString();
}
