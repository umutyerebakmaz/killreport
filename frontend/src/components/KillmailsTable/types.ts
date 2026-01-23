// Common types for KillmailsTable components
// Import generated types from GraphQL
import type { CharacterKillmailsQuery, KillmailsQuery } from '@/generated/graphql';

// Extract the Killmail type from the GraphQL query result
export type Killmail =
    | NonNullable<KillmailsQuery['killmails']['edges'][number]['node']>
    | NonNullable<CharacterKillmailsQuery['killmails']['edges'][number]['node']>;

export interface KillmailsTableProps {
    /** Killmails array - component will group by date automatically */
    killmails: Killmail[];
    /** Set of animating killmail IDs (for real-time updates) */
    animatingKillmails?: Set<string>;
    /** Loading state */
    loading?: boolean;
    /** Character ID for victim/attacker highlighting */
    characterId?: number;
    /** Corporation ID for victim/attacker highlighting */
    corporationId?: number;
    /** Alliance ID for victim/attacker highlighting */
    allianceId?: number;
    /** Map of date -> total count for that date (to show correct totals) */
    dateCountsMap?: Map<string, number>;
}

export interface KillmailRowProps {
    /** Killmail data */
    killmail: Killmail;
    /** Whether the row should be animated */
    isAnimating?: boolean;
    /** Character ID for victim/attacker highlighting */
    characterId?: number;
    /** Corporation ID for victim/attacker highlighting */
    corporationId?: number;
    /** Alliance ID for victim/attacker highlighting */
    allianceId?: number;
}
