import SecurityBadge from '@/components/SecurityStatus/SecurityStatus';
import SolarSystemMap from '@/components/SolarSystemMap/SolarSystemMap';
import Tooltip from '@/components/Tooltip/Tooltip';
import { formatTimeAgo } from '@/utils/date';
import Link from 'next/link';

interface SolarSystemCardProps {
  /**
   * Whether to print the system's constellation and region under its name.
   *
   * A system list needs them to place the system. A constellation or region
   * detail page does not: the page IS the placement, so repeating it on every
   * card is noise. The flag is explicit rather than inferred from the fields
   * being absent, because absent and unknown are different things — the list
   * page genuinely shows "Unknown Constellation" where the data is missing.
   */
  showLineage?: boolean;
  system: {
    id: number;
    name: string;
    securityStatus?: number | null;
    constellation?: {
      id: number;
      name: string;
      region?: {
        id: number;
        name: string;
      } | null;
    } | null;
    latestKills?: {
      ship_kills: number;
      pod_kills: number;
      npc_kills: number;
      timestamp: string;
    } | null;
  };
}

export default function SolarSystemCard({
  system,
  showLineage = true,
}: SolarSystemCardProps) {
  // Format kill stats as single line, hiding zero values
  const formatKillStats = (kills: {
    ship_kills: number;
    pod_kills: number;
    npc_kills: number;
  }) => {
    const parts = [];
    if (kills.ship_kills > 0) parts.push(`${kills.ship_kills} ships`);
    if (kills.pod_kills > 0) parts.push(`${kills.pod_kills} pods`);
    if (kills.npc_kills > 0) parts.push(`${kills.npc_kills} NPC`);

    if (parts.length === 0) return 'No activity';
    return `${parts.join(', ')} killed`;
  };

  return (
    <div className="p-4 transition-all border bg-surface border-white/5 hover:bg-surface-inset hover:border-white/20">
      <div className="flex items-start gap-3">
        <SolarSystemMap
          systemId={system.id}
          systemName={system.name}
          size={64}
          className="shrink-0"
        />

        <div className="min-w-0">
          {/* Security Status + System Name */}
          <div className="flex items-center gap-3">
            <SecurityBadge securityStatus={system.securityStatus ?? 0} />
            <Tooltip content="Show solar system detail">
              <Link
                href={`/solar-systems/${system.id}?tab=killmails`}
                prefetch={false}
                className="font-medium text-orange-400 transition-colors hover:text-orange-500"
              >
                {system.name}
              </Link>
            </Tooltip>
          </div>

          {/* Constellation */}
          {showLineage && (
            <div>
              {system.constellation ? (
                <Tooltip content="Show constellation detail">
                  <Link
                    href={`/constellations/${system.constellation.id}?tab=killmails`}
                    prefetch={false}
                    className="text-base text-purple-500 transition-colors hover:text-purple-400"
                  >
                    {system.constellation.name}
                  </Link>
                </Tooltip>
              ) : (
                <span className="text-sm text-gray-500">
                  Unknown Constellation
                </span>
              )}
            </div>
          )}

          {/* Region */}
          {showLineage && (
            <div>
              {system.constellation?.region ? (
                <Tooltip content="Show region detail">
                  <Link
                    href={`/regions/${system.constellation.region.id}?tab=killmails`}
                    prefetch={false}
                    className="text-base text-blue-400 transition-colors hover:text-blue-300"
                  >
                    {system.constellation.region.name}
                  </Link>
                </Tooltip>
              ) : (
                <span className="text-sm text-gray-500">Unknown Region</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Kill statistics and timestamp at the bottom */}
      {system.latestKills && (
        <div className="pt-3 mt-3 border-t border-white/10">
          <div className="flex items-center justify-between text-sm">
            <Tooltip content="Kill statistics in last hour">
              <span className="text-gray-400">
                {formatKillStats(system.latestKills)}
              </span>
            </Tooltip>
            <Tooltip content="Last update time">
              <span className="text-xs text-gray-500">
                {formatTimeAgo(system.latestKills.timestamp)}
              </span>
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  );
}
