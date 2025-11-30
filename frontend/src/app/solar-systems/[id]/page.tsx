"use client";

import Breadcrumb from "@/components/Breadcrumb/Breadcrumb";
import SecurityBadge from "@/components/SecurityBadge/SecurityBadge";
import { useSolarSystemQuery } from "@/generated/graphql";
import { getSecurityColor, getSecurityLabel } from "@/utils/security";
import {
  GlobeAltIcon,
  MapIcon,
  MapPinIcon,
  StarIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { use } from "react";

interface SolarSystemDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function SolarSystemDetailPage({
  params,
}: SolarSystemDetailPageProps) {
  const { id } = use(params);

  const { data, loading, error } = useSolarSystemQuery({
    variables: { id: parseInt(id) },
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 rounded-full animate-spin border-cyan-500 border-t-transparent" />
          <span className="text-lg">Loading solar system...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-600">Error: {error.message}</div>
      </div>
    );
  }

  const system = data?.solarSystem;

  if (!system) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Solar system not found</div>
      </div>
    );
  }

  const securityColor = getSecurityColor(system.security_status);
  const securityLabel = getSecurityLabel(system.security_status);

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <Breadcrumb
        items={[
          { label: "Regions", href: "/regions" },
          system.constellation?.region
            ? {
                label: system.constellation.region.name,
                href: `/regions/${system.constellation.region.id}`,
              }
            : { label: "Unknown Region" },
          system.constellation
            ? {
                label: system.constellation.name,
                href: `/constellations/${system.constellation.id}`,
              }
            : { label: "Unknown Constellation" },
          { label: system.name },
        ]}
      />

      <div className="system-detail-card">
        {/* Header */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-6">
            <div
              className={`flex items-center justify-center w-24 h-24 shadow-md shrink-0 ${
                system.security_status != null && system.security_status >= 0.5
                  ? "bg-green-500/20 border border-green-500/50"
                  : system.security_status != null && system.security_status > 0
                  ? "bg-yellow-500/20 border border-yellow-500/50"
                  : system.security_status != null
                  ? "bg-red-500/20 border border-red-500/50"
                  : "bg-purple-500/20 border border-purple-500/50"
              }`}
            >
              <MapPinIcon className={`w-12 h-12 ${securityColor}`} />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">{system.name}</h1>
              <div className="flex items-center gap-4 mt-2">
                <SecurityBadge
                  securityStatus={system.security_status}
                  showLabel={true}
                  size="lg"
                />
              </div>
              <div className="flex flex-wrap items-center gap-6 mt-4 text-sm">
                {system.constellation && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <MapIcon className="w-4 h-4 text-purple-500" />
                    <span>Constellation:</span>
                    <Link
                      href={`/constellations/${system.constellation.id}`}
                      className="transition-colors text-cyan-400 hover:text-cyan-300"
                    >
                      {system.constellation.name}
                    </Link>
                  </div>
                )}
                {system.constellation?.region && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <GlobeAltIcon className="w-4 h-4 text-cyan-500" />
                    <span>Region:</span>
                    <Link
                      href={`/regions/${system.constellation.region.id}`}
                      className="transition-colors text-cyan-400 hover:text-cyan-300"
                    >
                      {system.constellation.region.name}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Info Card */}
          <div className="bg-white/5 border border-white/10 p-4 min-w-[280px]">
            <h3 className="mb-3 text-sm font-medium text-gray-400">
              Quick Info
            </h3>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-gray-400">Security</dt>
                <dd className={`font-medium ${securityColor}`}>
                  {system.security_status != null
                    ? system.security_status.toFixed(2)
                    : "W-Space"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Type</dt>
                <dd className={`font-medium ${securityColor}`}>
                  {securityLabel}
                </dd>
              </div>
              {system.security_class && (
                <div className="flex justify-between">
                  <dt className="text-gray-400">Class</dt>
                  <dd className="text-gray-200">{system.security_class}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Content */}
        <div className="grid gap-6 mt-8 md:grid-cols-2 lg:grid-cols-3">
          {/* System Info */}
          <div className="p-6 border bg-white/5 border-white/10">
            <h2 className="flex items-center gap-2 mb-4 text-xl font-bold">
              <MapPinIcon className="w-5 h-5 text-orange-400" />
              System Information
            </h2>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-gray-400">System ID</dt>
                <dd className="text-gray-200">{system.id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Security Status</dt>
                <dd className={`${securityColor}`}>
                  {system.security_status != null
                    ? system.security_status.toFixed(5)
                    : "N/A"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Security Class</dt>
                <dd className="text-gray-200">
                  {system.security_class || "N/A"}
                </dd>
              </div>
              {system.star_id && (
                <div className="flex justify-between">
                  <dt className="text-gray-400">Star ID</dt>
                  <dd className="text-gray-200">{system.star_id}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Location Hierarchy */}
          <div className="p-6 border bg-white/5 border-white/10">
            <h2 className="flex items-center gap-2 mb-4 text-xl font-bold">
              <GlobeAltIcon className="w-5 h-5 text-cyan-400" />
              Location Hierarchy
            </h2>
            <div className="space-y-4">
              {/* Region */}
              {system.constellation?.region && (
                <div className="flex items-center gap-3 p-3 border bg-white/5 border-white/10">
                  <GlobeAltIcon className="w-6 h-6 text-cyan-500" />
                  <div>
                    <div className="text-xs text-gray-500 uppercase">
                      Region
                    </div>
                    <Link
                      href={`/regions/${system.constellation.region.id}`}
                      className="font-medium transition-colors text-cyan-400 hover:text-cyan-300"
                    >
                      {system.constellation.region.name}
                    </Link>
                  </div>
                </div>
              )}

              {/* Constellation */}
              {system.constellation && (
                <div className="flex items-center gap-3 p-3 ml-4 border bg-white/5 border-white/10">
                  <MapIcon className="w-6 h-6 text-purple-500" />
                  <div>
                    <div className="text-xs text-gray-500 uppercase">
                      Constellation
                    </div>
                    <Link
                      href={`/constellations/${system.constellation.id}`}
                      className="font-medium transition-colors text-cyan-400 hover:text-cyan-300"
                    >
                      {system.constellation.name}
                    </Link>
                  </div>
                </div>
              )}

              {/* Current System */}
              <div className="flex items-center gap-3 p-3 ml-8 border-2 bg-white/5 border-cyan-500/50">
                <MapPinIcon className={`w-6 h-6 ${securityColor}`} />
                <div>
                  <div className="text-xs text-gray-500 uppercase">
                    Solar System
                  </div>
                  <span className="font-medium text-white">{system.name}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Position Info */}
          {system.position && (
            <div className="p-6 border bg-white/5 border-white/10">
              <h2 className="flex items-center gap-2 mb-4 text-xl font-bold">
                <StarIcon className="w-5 h-5 text-yellow-400" />
                Position in Space
              </h2>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm text-gray-400">X Coordinate</dt>
                  <dd className="text-lg text-gray-200">
                    {system.position.x.toExponential(4)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-400">Y Coordinate</dt>
                  <dd className="text-lg text-gray-200">
                    {system.position.y.toExponential(4)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-400">Z Coordinate</dt>
                  <dd className="text-lg text-gray-200">
                    {system.position.z.toExponential(4)}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </div>

        {/* Future: Killmail Activity, Stations, Gates etc. */}
        <div className="p-6 mt-8 border border-dashed bg-white/5 border-white/10">
          <h2 className="mb-2 text-xl font-bold text-gray-400">Coming Soon</h2>
          <p className="text-gray-500">
            Future features: Killmail activity, stations, stargates, planets,
            and more detailed system information.
          </p>
        </div>
      </div>
    </div>
  );
}
