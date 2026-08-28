"use client";

import { Loader } from "@/components/Loader/Loader";
import SecurityBadge from "@/components/SecurityStatus/SecurityStatus";
import { useSolarSystemAdjacentQuery } from "@/generated/graphql";
import Link from "next/link";

interface AdjacentSystemsTabProps {
  systemId: number;
}

export default function AdjacentSystemsTab({
  systemId,
}: AdjacentSystemsTabProps) {
  const { data, loading, error } = useSolarSystemAdjacentQuery({
    variables: { id: systemId },
  });

  if (loading) return <Loader size="md" text="Loading adjacent systems..." />;

  if (error) {
    return (
      <div className="p-6 border bg-white/5 border-white/10 text-red-400">
        Could not load adjacent systems: {error.message}
      </div>
    );
  }

  const stargates = data?.solarSystem?.stargates ?? [];

  if (stargates.length === 0) {
    // Normal for wormhole space: Thera has no stargates at all.
    return (
      <div className="p-6 text-gray-400 border bg-white/5 border-white/10">
        This system has no stargates.
      </div>
    );
  }

  // Gates whose destination has not been resolved yet — the stargate worker has
  // not run, or the target system is not in the database — are dropped here
  // rather than in the resolver, so `stargates` stays a faithful view of the
  // table.
  const neighbours = stargates.filter((gate) => gate.destination?.system);

  if (neighbours.length === 0) {
    return (
      <div className="p-6 text-gray-400 border bg-white/5 border-white/10">
        This system has {stargates.length} stargates, but their destinations have
        not been resolved yet. Run <code>yarn queue:stargates</code> and{" "}
        <code>yarn worker:stargates</code>.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border bg-white/5 border-white/10">
      <table className="w-full text-sm">
        <thead className="text-xs tracking-wide text-gray-400 uppercase border-b border-white/10">
          <tr>
            <th className="px-4 py-3 text-left">System</th>
            <th className="px-4 py-3 text-left">Security</th>
            <th className="px-4 py-3 text-left">Constellation</th>
            <th className="px-4 py-3 text-left">Region</th>
            <th className="px-4 py-3 text-right">Ship kills</th>
            <th className="px-4 py-3 text-right">Pod kills</th>
          </tr>
        </thead>
        <tbody>
          {neighbours.map((gate) => {
            const system = gate.destination!.system!;
            return (
              <tr
                key={gate.id}
                className="border-b border-white/5 last:border-0"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/solar-systems/${system.id}`}
                    prefetch={false}
                    className="text-cyan-400 hover:underline"
                  >
                    {system.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <SecurityBadge securityStatus={system.securityStatus} />
                </td>
                <td className="px-4 py-3">
                  {system.constellation ? (
                    <Link
                      href={`/constellations/${system.constellation.id}`}
                      prefetch={false}
                      className="text-gray-300 hover:underline"
                    >
                      {system.constellation.name}
                    </Link>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {system.constellation?.region ? (
                    <Link
                      href={`/regions/${system.constellation.region.id}`}
                      prefetch={false}
                      className="text-gray-300 hover:underline"
                    >
                      {system.constellation.region.name}
                    </Link>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-gray-300">
                  {system.latestKills?.ship_kills ?? 0}
                </td>
                <td className="px-4 py-3 text-right text-gray-300">
                  {system.latestKills?.pod_kills ?? 0}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
