"use client";

import AttackersCard from "@/components/AttackersCard";
import FitScreen from "@/components/FitScreen/FitScreen";
import { Loader } from "@/components/Loader/Loader";
import { useKillmailQuery } from "@/generated/graphql";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { use } from "react";

// Helper functions (pure, no dependencies)
const formatISK = (amount: number | null | undefined) => {
  if (!amount) return "0 ISK";
  return `${Math.round(amount).toLocaleString()} ISK`;
};

const getItemPrice = (jitaPrice: any) => {
  return jitaPrice?.sell || jitaPrice?.average || 0;
};

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
  const fitting = km.fitting;
  const destroyedValue = km.destroyedValue || 0;
  const droppedValue = km.droppedValue || 0;
  const totalValue = km.totalValue || 0;

  // Debug: Backend'den gelen değerleri görelim
  console.log("Backend değerleri:", {
    destroyedValue: km.destroyedValue,
    droppedValue: km.droppedValue,
    totalValue: km.totalValue,
  });

  return (
    <>
      {/* Header */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: FitScreen (2/3 width) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Fit + Victim */}
          <div className="flex fit-and-victim">
            <FitScreen shipType={victim?.shipType} fitting={fitting as any} />
            <div className="victim-card">
              <div className="flex items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <a
                    href={`https://zkillboard.com/kill/${km.id}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1 text-sm font-medium text-gray-300 transition-colors rounded bg-gray-800/50 hover:bg-gray-700/50 hover:text-white"
                  >
                    <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                    zKillboard
                  </a>
                  <a
                    href={`https://kb.evetools.org/kill/${km.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1 text-sm font-medium text-gray-300 transition-colors rounded bg-gray-800/50 hover:bg-gray-700/50 hover:text-white"
                  >
                    <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                    EVE Tools
                  </a>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-32">
                  <img
                    src={`https://images.evetech.net/characters/${victim?.character?.id}/portrait?size=256`}
                    alt={victim?.character?.name}
                    width={128}
                    height={128}
                    className="object-cover w-32 h-32 shadow-md shrink-0"
                    loading="lazy"
                  />
                </div>
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

          {/* Items List */}
          <div className="p-6 items-card">
            {/* Ship */}
            {victim?.shipType && (
              <div className="pb-4 mb-4 border-b border-white/10">
                <h3 className="mb-2 text-sm font-bold text-gray-400 uppercase">
                  Ship
                </h3>
                <div className="flex items-center gap-3 py-2">
                  <img
                    src={`https://images.evetech.net/types/${victim.shipType.id}/icon?size=64`}
                    alt={victim.shipType.name}
                    className="w-16 h-16"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white truncate">
                      {victim.shipType.name}
                    </div>
                    {victim.shipType.group && (
                      <div className="text-sm text-gray-500">
                        {victim.shipType.group.name}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-4 text-right">
                    <div className="text-white">1</div>
                    <div className="w-40 text-red-400 tabular-nums">
                      {formatISK(getItemPrice(victim.shipType.jitaPrice))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* High Slots */}
            {fitting?.highSlots &&
              fitting.highSlots.slots.some((slot) => slot.module) && (
                <div className="pb-4 mb-4 border-b border-white/10">
                  <h3 className="mb-2 font-bold text-gray-400 uppercase">
                    High Slots
                  </h3>
                  <div className="space-y-2">
                    {fitting.highSlots.slots.flatMap((slot) => {
                      if (!slot.module) return [];
                      const items = [];

                      // Module
                      const moduleIsDestroyed =
                        (slot.module.quantityDestroyed || 0) > 0;
                      const moduleIsDropped =
                        (slot.module.quantityDropped || 0) > 0;
                      const moduleTextColor = moduleIsDestroyed
                        ? "text-red-400"
                        : moduleIsDropped
                        ? "text-green-400"
                        : "text-white";

                      items.push(
                        <div
                          key={`module-${slot.slotIndex}`}
                          className="flex items-center gap-3 py-2 transition-colors hover:bg-white/5"
                        >
                          <img
                            src={`https://images.evetech.net/types/${slot.module.itemType.id}/icon?size=64`}
                            alt={slot.module.itemType.name}
                            className="w-16 h-16"
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="flex-1 min-w-0">
                            <div
                              className={`text-sm truncate ${moduleTextColor}`}
                            >
                              {slot.module.itemType.name}
                            </div>
                          </div>
                          <div className="flex gap-4 text-right">
                            <div className={`${moduleTextColor} w-16`}>
                              {(slot.module.quantityDropped || 0) +
                                (slot.module.quantityDestroyed || 0) || 1}
                            </div>
                            <div
                              className={`${moduleTextColor} tabular-nums w-40`}
                            >
                              {formatISK(
                                getItemPrice(slot.module.itemType.jitaPrice) *
                                  ((slot.module.quantityDropped || 0) +
                                    (slot.module.quantityDestroyed || 0) || 1)
                              )}
                            </div>
                          </div>
                        </div>
                      );

                      // Charge (if exists)
                      if (slot.module.charge) {
                        const chargeIsDestroyed =
                          (slot.module.charge.quantityDestroyed || 0) > 0;
                        const chargeIsDropped =
                          (slot.module.charge.quantityDropped || 0) > 0;
                        const chargeTextColor = chargeIsDestroyed
                          ? "text-red-400"
                          : chargeIsDropped
                          ? "text-green-400"
                          : "text-white";

                        items.push(
                          <div
                            key={`charge-${slot.slotIndex}`}
                            className="flex items-center gap-3 py-2"
                          >
                            <img
                              src={`https://images.evetech.net/types/${slot.module.charge.itemType.id}/icon?size=64`}
                              alt={slot.module.charge.itemType.name}
                              className="w-16 h-16"
                              loading="lazy"
                              decoding="async"
                            />
                            <div className="flex-1 min-w-0">
                              <div
                                className={`text-sm truncate ${chargeTextColor}`}
                              >
                                {slot.module.charge.itemType.name}
                              </div>
                            </div>
                            <div className="flex gap-4 text-right">
                              <div className={`${chargeTextColor} w-16`}>
                                {(slot.module.charge.quantityDropped || 0) +
                                  (slot.module.charge.quantityDestroyed || 0) ||
                                  1}
                              </div>
                              <div
                                className={`${chargeTextColor} tabular-nums w-40`}
                              >
                                {formatISK(
                                  getItemPrice(
                                    slot.module.charge.itemType.jitaPrice
                                  ) *
                                    ((slot.module.charge.quantityDropped || 0) +
                                      (slot.module.charge.quantityDestroyed ||
                                        0) || 1)
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return items;
                    })}
                  </div>
                </div>
              )}

            {/* Mid Slots */}
            {fitting?.midSlots && fitting.midSlots.slots.length > 0 && (
              <div className="pb-4 mb-4 border-b border-white/10">
                <h3 className="mb-2 text-sm font-bold text-gray-400 uppercase">
                  Mid Slots
                </h3>
                <div className="space-y-2">
                  {fitting.midSlots.slots.flatMap((slot) => {
                    if (!slot.module) return [];
                    const items = [];

                    // Module
                    const moduleIsDestroyed =
                      (slot.module.quantityDestroyed || 0) > 0;
                    const moduleIsDropped =
                      (slot.module.quantityDropped || 0) > 0;
                    const moduleTextColor = moduleIsDestroyed
                      ? "text-red-400"
                      : moduleIsDropped
                      ? "text-green-400"
                      : "text-white";

                    items.push(
                      <div
                        key={`module-${slot.slotIndex}`}
                        className="flex items-center gap-3 py-2"
                      >
                        <img
                          src={`https://images.evetech.net/types/${slot.module.itemType.id}/icon?size=64`}
                          alt={slot.module.itemType.name}
                          className="w-16 h-16"
                          loading="lazy"
                          decoding="async"
                        />
                        <div className="flex-1 min-w-0">
                          <div
                            className={`text-sm truncate ${moduleTextColor}`}
                          >
                            {slot.module.itemType.name}
                          </div>
                        </div>
                        <div className="flex gap-4 text-right">
                          <div className={`${moduleTextColor} w-16`}>
                            {(slot.module.quantityDropped || 0) +
                              (slot.module.quantityDestroyed || 0) || 1}
                          </div>
                          <div
                            className={`${moduleTextColor} tabular-nums w-40`}
                          >
                            {formatISK(
                              getItemPrice(slot.module.itemType.jitaPrice) *
                                ((slot.module.quantityDropped || 0) +
                                  (slot.module.quantityDestroyed || 0) || 1)
                            )}
                          </div>
                        </div>
                      </div>
                    );

                    // Charge (if exists)
                    if (slot.module.charge) {
                      const chargeIsDestroyed =
                        (slot.module.charge.quantityDestroyed || 0) > 0;
                      const chargeIsDropped =
                        (slot.module.charge.quantityDropped || 0) > 0;
                      const chargeTextColor = chargeIsDestroyed
                        ? "text-red-400"
                        : chargeIsDropped
                        ? "text-green-400"
                        : "text-white";

                      items.push(
                        <div
                          key={`charge-${slot.slotIndex}`}
                          className="flex items-center gap-3 py-2"
                        >
                          <img
                            src={`https://images.evetech.net/types/${slot.module.charge.itemType.id}/icon?size=64`}
                            alt={slot.module.charge.itemType.name}
                            className="w-16 h-16"
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="flex-1 min-w-0">
                            <div
                              className={`text-sm truncate ${chargeTextColor}`}
                            >
                              {slot.module.charge.itemType.name}
                            </div>
                          </div>
                          <div className="flex gap-4 text-right">
                            <div className={`${chargeTextColor} w-16`}>
                              {(slot.module.charge.quantityDropped || 0) +
                                (slot.module.charge.quantityDestroyed || 0) ||
                                1}
                            </div>
                            <div
                              className={`${chargeTextColor} tabular-nums w-40`}
                            >
                              {formatISK(
                                getItemPrice(
                                  slot.module.charge.itemType.jitaPrice
                                ) *
                                  ((slot.module.charge.quantityDropped || 0) +
                                    (slot.module.charge.quantityDestroyed ||
                                      0) || 1)
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return items;
                  })}
                </div>
              </div>
            )}

            {/* Low Slots */}
            {fitting?.lowSlots && fitting.lowSlots.slots.length > 0 && (
              <div className="pb-4 mb-4 border-b border-white/10">
                <h3 className="mb-2 text-sm font-bold text-gray-400 uppercase">
                  Low Slots
                </h3>
                <div className="space-y-2">
                  {fitting.lowSlots.slots.map((slot) => {
                    if (!slot.module) return null;
                    const isDestroyed =
                      (slot.module.quantityDestroyed || 0) > 0;
                    const isDropped = (slot.module.quantityDropped || 0) > 0;
                    const textColor = isDestroyed
                      ? "text-red-400"
                      : isDropped
                      ? "text-green-400"
                      : "text-white";
                    return (
                      <div
                        key={slot.slotIndex}
                        className="flex items-center gap-3 py-2"
                      >
                        <img
                          src={`https://images.evetech.net/types/${slot.module.itemType.id}/icon?size=64`}
                          alt={slot.module.itemType.name}
                          className="w-16 h-16"
                        />
                        <div className="flex-1 min-w-0">
                          <div className={`truncate ${textColor}`}>
                            {slot.module.itemType.name}
                          </div>
                        </div>
                        <div className="flex text-right">
                          <div className={`${textColor} w-16`}>
                            {(slot.module.quantityDropped || 0) +
                              (slot.module.quantityDestroyed || 0) || 1}
                          </div>
                          <div className={`${textColor} tabular-nums w-40`}>
                            {formatISK(
                              getItemPrice(slot.module.itemType.jitaPrice) *
                                ((slot.module.quantityDropped || 0) +
                                  (slot.module.quantityDestroyed || 0) || 1)
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Rigs */}
            {fitting?.rigs && fitting.rigs.modules.length > 0 && (
              <div className="pb-4 mb-4 border-b border-white/10">
                <h3 className="mb-2 text-sm font-bold text-gray-400 uppercase">
                  Rigs
                </h3>
                <div className="space-y-2">
                  {fitting.rigs.modules.map((module, index) => {
                    const quantity =
                      (module.quantityDropped || 0) +
                        (module.quantityDestroyed || 0) || 1;
                    const isDestroyed = (module.quantityDestroyed || 0) > 0;
                    const isDropped = (module.quantityDropped || 0) > 0;
                    const textColor = isDestroyed
                      ? "text-red-400"
                      : isDropped
                      ? "text-green-400"
                      : "text-white";
                    return (
                      <div key={index} className="flex items-center gap-3 py-2">
                        <img
                          src={`https://images.evetech.net/types/${module.itemType.id}/icon?size=64`}
                          alt={module.itemType.name}
                          className="w-16 h-16"
                          loading="lazy"
                          decoding="async"
                        />
                        <div className="flex-1 min-w-0">
                          <div className={`truncate ${textColor}`}>
                            {module.itemType.name}
                          </div>
                        </div>
                        <div className="flex gap-4 text-right">
                          <div className={`${textColor} w-16`}>{quantity}</div>
                          <div className={`${textColor} tabular-nums w-40`}>
                            {formatISK(
                              getItemPrice(module.itemType.jitaPrice) * quantity
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Drone Bay */}
            {fitting?.droneBay && fitting.droneBay.length > 0 && (
              <div className="pb-4 mb-4 border-b border-white/10">
                <h3 className="mb-2 text-sm font-bold text-gray-400 uppercase">
                  Drone Bay
                </h3>
                <div className="space-y-2">
                  {fitting.droneBay.map((module, index) => {
                    const quantity =
                      (module.quantityDropped || 0) +
                        (module.quantityDestroyed || 0) || 1;
                    const isDestroyed = (module.quantityDestroyed || 0) > 0;
                    const isDropped = (module.quantityDropped || 0) > 0;
                    const textColor = isDestroyed
                      ? "text-red-400"
                      : isDropped
                      ? "text-green-400"
                      : "text-white";
                    return (
                      <div key={index} className="flex items-center gap-3 py-2">
                        <img
                          src={`https://images.evetech.net/types/${module.itemType.id}/icon?size=64`}
                          alt={module.itemType.name}
                          className="w-16 h-16"
                          loading="lazy"
                          decoding="async"
                        />
                        <div className="flex-1 min-w-0">
                          <div className={`truncate ${textColor}`}>
                            {module.itemType.name}
                          </div>
                        </div>
                        <div className="flex gap-4 text-right">
                          <div className={`${textColor} w-16`}>{quantity}</div>
                          <div className={`${textColor} tabular-nums w-40`}>
                            {formatISK(
                              getItemPrice(module.itemType.jitaPrice) * quantity
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cargo Bay */}
            {fitting?.cargo && fitting.cargo.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-bold text-gray-400 uppercase">
                  Cargo Bay
                </h3>
                <div className="space-y-2">
                  {fitting.cargo.map((module, index) => {
                    const quantity =
                      (module.quantityDropped || 0) +
                        (module.quantityDestroyed || 0) || 1;
                    const isDestroyed = (module.quantityDestroyed || 0) > 0;
                    const isDropped = (module.quantityDropped || 0) > 0;
                    const textColor = isDestroyed
                      ? "text-red-400"
                      : isDropped
                      ? "text-green-400"
                      : "text-white";
                    return (
                      <div key={index} className="flex items-center gap-3 py-2">
                        <img
                          src={`https://images.evetech.net/types/${module.itemType.id}/icon?size=64`}
                          alt={module.itemType.name}
                          className="w-16 h-16"
                          loading="lazy"
                          decoding="async"
                        />
                        <div className="flex-1 min-w-0">
                          <div className={`truncate ${textColor}`}>
                            {module.itemType.name}
                          </div>
                        </div>
                        <div className="flex gap-4 text-right">
                          <div className={`${textColor} w-16`}>{quantity}</div>
                          <div className={`${textColor} tabular-nums w-40`}>
                            {formatISK(
                              getItemPrice(module.itemType.jitaPrice) * quantity
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Value Summary - Accounting Style */}
            <div className="pt-4 border-t border-white/10">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Destroyed</span>
                  <span className="text-red-400 tabular-nums">
                    {formatISK(destroyedValue)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Dropped</span>
                  <span className="text-green-400 tabular-nums">
                    {formatISK(droppedValue)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <span className="text-base font-semibold text-gray-400">
                    Total Value
                  </span>
                  <span className="text-xl font-bold text-yellow-400 tabular-nums">
                    {formatISK(totalValue)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Attackers (1/3 width) */}
        <div className="space-y-6 lg:col-span-1">
          <AttackersCard attackers={attackers} />
        </div>
      </div>
    </>
  );
}
