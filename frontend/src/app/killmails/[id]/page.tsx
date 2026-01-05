"use client";

import AttackersCard from "@/components/AttackersCard";
import { Loader } from "@/components/Loader/Loader";
import { useKillmailQuery } from "@/generated/graphql";
import Link from "next/link";
import { use } from "react";

export default function KillmailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, loading, error } = useKillmailQuery({
    variables: { id },
  });

  if (loading) {
    return <Loader fullHeight size="lg" text="Loading killmail..." />;
  }

  if (error || !data?.killmail) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-red-400">
          Error: {error?.message || "Killmail not found"}
        </div>
      </div>
    );
  }

  const km = data.killmail;
  const victim = km.victim;
  const attackers = km.attackers || [];
  const items = km.items || [];

  return (
    <>
      {/* Header */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Victim & Location (2/3 width) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Victim Card */}
          <div className="victim-card">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center pb-2">
                <span className="px-3 py-1 text-sm font-medium text-red-400 rounded bg-red-400/10">
                  VICTIM
                </span>
              </div>

              <div className="flex">
                <img
                  src={`https://images.evetech.net/characters/${victim.character?.id}/portrait?size=256`}
                  alt={victim.character?.name}
                  width={128}
                  height={128}
                  className="shadow-md"
                  loading="lazy"
                />

                <img
                  src={`https://images.evetech.net/types/${km.victim.shipType?.id}/render?size=256`}
                  alt={victim?.shipType?.name || "Ship"}
                  width={128}
                  height={128}
                  className="shadow-md"
                  loading="lazy"
                />
              </div>

              <div className="space-y-3">
                {victim?.character && (
                  <div>
                    <div className="text-sm text-gray-500">Pilot</div>
                    <Link
                      href={`/characters/${victim.character?.id}`}
                      prefetch={false}
                      className="text-lg font-medium text-white hover:text-blue-400"
                    >
                      {victim.character.name}
                    </Link>
                  </div>
                )}

                {victim?.corporation && (
                  <div>
                    <div className="text-sm text-gray-500">Corporation</div>
                    <Link
                      href={`/corporations/${victim.corporation?.id}`}
                      prefetch={false}
                      className="text-white hover:text-blue-400"
                    >
                      {victim.corporation.name}
                      {victim.corporation.ticker && (
                        <span className="ml-2 text-gray-400">
                          [{victim.corporation.ticker}]
                        </span>
                      )}
                    </Link>
                  </div>
                )}

                {victim?.alliance && (
                  <div>
                    <div className="text-sm text-gray-500">Alliance</div>
                    <Link
                      href={`/alliances/${victim.alliance?.id}`}
                      prefetch={false}
                      className="text-white hover:text-blue-400"
                    >
                      {victim.alliance.name}
                      {victim.alliance.ticker && (
                        <span className="ml-2 text-gray-400">
                          &lt;{victim.alliance.ticker}&gt;
                        </span>
                      )}
                    </Link>
                  </div>
                )}

                {victim?.shipType && (
                  <div>
                    <div className="text-sm text-gray-500">Ship</div>
                    <div className="text-white">
                      {victim.shipType.name}
                      {victim.shipType.group && (
                        <span className="ml-2 text-sm text-gray-400">
                          ({victim.shipType.group.name})
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-sm text-gray-500">Damage Taken</div>
                  <div className="text-lg font-medium text-red-400">
                    {victim?.damageTaken?.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Location Card */}
          <div className="p-6 rounded-lg bg-white/5 backdrop-blur-sm inset-ring inset-ring-white/10">
            <h3 className="mb-4 text-lg font-semibold text-white">Location</h3>
            <div className="space-y-2">
              {km.solarSystem && (
                <>
                  <div>
                    <span className="text-sm text-gray-500">System: </span>
                    <Link
                      href={`/solar-systems/${km.solarSystem?.id}`}
                      prefetch={false}
                      className="text-white hover:text-blue-400"
                    >
                      {km.solarSystem.name}
                    </Link>
                    {km.solarSystem.security_status !== null && (
                      <span
                        className={`ml-2 ${
                          (km.solarSystem.security_status ?? 0) >= 0.5
                            ? "text-green-400"
                            : (km.solarSystem.security_status ?? 0) > 0
                            ? "text-yellow-400"
                            : "text-red-400"
                        }`}
                      >
                        [{km.solarSystem.security_status?.toFixed(1)}]
                      </span>
                    )}
                  </div>
                  {km.solarSystem.constellation?.name && (
                    <div>
                      <span className="text-sm text-gray-500">
                        Constellation:{" "}
                      </span>
                      <span className="text-white">
                        {km.solarSystem.constellation.name}
                      </span>
                    </div>
                  )}
                  {km.solarSystem.constellation?.region?.name && (
                    <div>
                      <span className="text-sm text-gray-500">Region: </span>
                      <span className="text-white">
                        {km.solarSystem.constellation.region.name}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Items Section */}
          {items.length > 0 && (
            <div className="p-6 mt-6 rounded-lg bg-white/5 backdrop-blur-sm inset-ring inset-ring-white/10">
              <h3 className="mb-4 text-lg font-semibold text-white">
                Dropped & Destroyed Items ({items.length})
              </h3>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item, index) => (
                  <div key={index} className="p-2 text-sm rounded bg-white/5">
                    <div className="text-white">{item?.itemType?.name}</div>
                    <div className="flex gap-4 text-xs text-gray-500">
                      {item?.quantityDropped && (
                        <span className="text-green-400">
                          Dropped: {item.quantityDropped}
                        </span>
                      )}
                      {item?.quantityDestroyed && (
                        <span className="text-red-400">
                          Destroyed: {item.quantityDestroyed}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Attackers (1/3 width) */}
        <div className="space-y-6 lg:col-span-1">
          <AttackersCard attackers={attackers} />
        </div>
      </div>
    </>
  );
}
