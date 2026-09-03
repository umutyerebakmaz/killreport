export type SolarSystemTab =
  | 'overview'
  | 'adjacent'
  | 'orbital-bodies'
  | 'structures'
  | 'sovereignty'
  | 'killmails';

export const SOLAR_SYSTEM_TABS: SolarSystemTab[] = [
  'overview',
  'adjacent',
  'orbital-bodies',
  'structures',
  'sovereignty',
  'killmails',
];

export const TAB_LABELS: Record<SolarSystemTab, string> = {
  overview: 'Overview',
  adjacent: 'Adjacent',
  'orbital-bodies': 'Orbital Bodies',
  structures: 'Structures',
  sovereignty: 'Sovereignty',
  killmails: 'Killmails',
};

export function isSolarSystemTab(
  value: string | null,
): value is SolarSystemTab {
  return value !== null && (SOLAR_SYSTEM_TABS as string[]).includes(value);
}
