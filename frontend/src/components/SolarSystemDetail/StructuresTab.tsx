"use client";

import { Loader } from "@/components/Loader/Loader";
import { useSolarSystemStationsQuery } from "@/generated/graphql";
import { formatISK } from "@/utils/formatISK";
import Link from "next/link";

interface StructuresTabProps {
  systemId: number;
}

export default function StructuresTab({ systemId }: StructuresTabProps) {
  const { data, loading, error } = useSolarSystemStationsQuery({
    variables: { id: systemId },
  });

  if (loading) return <Loader size="md" text="Loading structures..." />;

  if (error) {
    return (
      <div className="p-6 border bg-white/5 border-white/10 text-red-400">
        Could not load structures: {error.message}
      </div>
    );
  }

  const stations = data?.solarSystem?.stations ?? [];

  if (stations.length === 0) {
    return (
      <div className="p-6 text-gray-400 border bg-white/5 border-white/10">
        This system has no NPC stations.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border bg-white/5 border-white/10">
      <table className="w-full text-sm">
        <thead className="text-xs tracking-wide text-gray-400 uppercase border-b border-white/10">
          <tr>
            <th className="px-4 py-3 text-left">Station</th>
            <th className="px-4 py-3 text-left">Type</th>
            <th className="px-4 py-3 text-left">Owner</th>
            <th className="px-4 py-3 text-right">Reprocessing</th>
            <th className="px-4 py-3 text-right">Station take</th>
            <th className="px-4 py-3 text-right">Office rent</th>
            <th className="px-4 py-3 text-left">Services</th>
          </tr>
        </thead>
        <tbody>
          {stations.map((station) => (
            <tr
              key={station.id}
              className="border-b border-white/5 last:border-0"
            >
              <td className="px-4 py-3">
                {station.name ? (
                  <span className="text-gray-200">{station.name}</span>
                ) : (
                  <span className="italic text-gray-500">
                    Station {station.id}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-gray-400">
                {station.type?.name ?? "—"}
              </td>
              <td className="px-4 py-3">
                {station.ownerCorporation ? (
                  <Link
                    href={`/corporations/${station.ownerCorporation.id}`}
                    prefetch={false}
                    className="text-cyan-400 hover:underline"
                  >
                    {station.ownerCorporation.name}
                  </Link>
                ) : station.ownerCorporationId != null ? (
                  // Most station owners are NPC corporations, and those are not
                  // ingested: the ID is the whole truth we hold about them.
                  <span className="italic text-gray-500">
                    Corporation {station.ownerCorporationId}
                  </span>
                ) : (
                  <span className="text-gray-500">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-right text-gray-300">
                {station.reprocessingEfficiency != null
                  ? `${(station.reprocessingEfficiency * 100).toFixed(0)}%`
                  : "—"}
              </td>
              <td className="px-4 py-3 text-right text-gray-300">
                {station.reprocessingStationsTake != null
                  ? `${(station.reprocessingStationsTake * 100).toFixed(0)}%`
                  : "—"}
              </td>
              <td className="px-4 py-3 text-right text-gray-300">
                {station.officeRentalCost != null
                  ? formatISK(station.officeRentalCost)
                  : "—"}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {station.services.map((service) => (
                    <span
                      key={service}
                      className="px-1.5 py-0.5 text-xs text-gray-400 border border-white/10"
                    >
                      {service}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
