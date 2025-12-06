"use client";

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
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-300">Loading killmail...</div>
      </div>
    );
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
  const finalBlowAttacker = attackers.find((a) => a?.finalBlow);

  return (
    <div className="px-4 py-8 mx-auto max-w-7xl sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/killmails"
          className="text-sm text-gray-400 hover:text-white"
        >
          ← Back to killmails
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-white">
          Killmail #{km.killmailId}
        </h1>
        <p className="mt-2 text-gray-400">
          {new Date(km.killmailTime).toLocaleString()}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Victim & Location */}
        <div className="space-y-6">
          {/* Victim Card */}
          <div className="p-6 rounded-lg bg-white/5 backdrop-blur-sm inset-ring inset-ring-white/10">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 text-sm font-medium text-red-400 rounded bg-red-400/10">
                VICTIM
              </span>
            </div>

            <div className="space-y-3">
              {victim?.character && (
                <div>
                  <div className="text-sm text-gray-500">Pilot</div>
                  <Link
                    href={`/characters/${victim.characterId}`}
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
                    href={`/corporations/${victim.corporationId}`}
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
                    href={`/alliances/${victim.allianceId}`}
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

          {/* Location Card */}
          <div className="p-6 rounded-lg bg-white/5 backdrop-blur-sm inset-ring inset-ring-white/10">
            <h3 className="mb-4 text-lg font-semibold text-white">Location</h3>
            <div className="space-y-2">
              {km.solarSystem && (
                <>
                  <div>
                    <span className="text-sm text-gray-500">System: </span>
                    <Link
                      href={`/solar-systems/${km.solarSystemId}`}
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
        </div>

        {/* Right Column: Attackers */}
        <div className="space-y-6">
          <div className="p-6 rounded-lg bg-white/5 backdrop-blur-sm inset-ring inset-ring-white/10">
            <h3 className="mb-4 text-lg font-semibold text-white">
              Attackers ({attackers.length})
            </h3>

            <div className="space-y-3 overflow-y-auto max-h-96">
              {attackers.map((attacker, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg ${
                    attacker?.finalBlow
                      ? "bg-green-400/10 inset-ring inset-ring-green-400/20"
                      : "bg-white/5"
                  }`}
                >
                  {attacker?.finalBlow && (
                    <div className="mb-2">
                      <span className="px-2 py-1 text-xs font-medium text-green-400 rounded bg-green-400/20">
                        FINAL BLOW
                      </span>
                    </div>
                  )}

                  <div className="space-y-1">
                    {attacker?.character && (
                      <div className="font-medium text-white">
                        {attacker.character.name}
                      </div>
                    )}

                    {attacker?.corporation && (
                      <div className="text-sm text-gray-400">
                        {attacker.corporation.name}
                      </div>
                    )}

                    {attacker?.shipType && (
                      <div className="text-sm text-gray-500">
                        {attacker.shipType.name}
                      </div>
                    )}

                    {attacker?.weaponType && (
                      <div className="text-xs text-gray-600">
                        Weapon: {attacker.weaponType.name}
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>
                        {attacker?.damageDone?.toLocaleString()} damage
                      </span>
                      {attacker?.securityStatus !== null && (
                        <span
                          className={
                            (attacker?.securityStatus ?? 0) >= 0
                              ? "text-green-500"
                              : "text-red-500"
                          }
                        >
                          Sec: {attacker?.securityStatus?.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
  );
}
