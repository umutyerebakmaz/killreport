import SecurityBadge from "@/components/SecurityStatus/SecurityStatus";
import Tooltip from "@/components/Tooltip/Tooltip";
import Link from "next/link";

interface SolarSystemCardProps {
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
  };
}

export default function SolarSystemCard({ system }: SolarSystemCardProps) {
  return (
    <div className="p-4 transition-all border bg-neutral-900 border-white/5 hover:bg-neutral-800 hover:border-white/20">
      {/* Row 1: Security Status + System Name */}
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

      {/* Row 2: Constellation */}
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
          <span className="text-sm text-gray-500">Unknown Constellation</span>
        )}
      </div>

      {/* Row 3: Region */}
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
    </div>
  );
}
