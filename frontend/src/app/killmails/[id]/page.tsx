"use client";

import AttackersCard from "@/components/AttackersCard";
import FitScreen from "@/components/FitScreen/FitScreen";
import { Loader } from "@/components/Loader/Loader";
import Tooltip from "@/components/Tooltip/Tooltip";
import { useKillmailQuery } from "@/generated/graphql";
import { formatISK } from "@/utils/formatISK";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { use } from "react";

const getItemPrice = (jitaPrice: any) => {
  return jitaPrice?.sell || jitaPrice?.average || 0;
};

// Render quantity with separate destroyed/dropped display
const renderQuantity = (destroyed: number, dropped: number) => {
  const hasDestroyed = destroyed > 0;
  const hasDropped = dropped > 0;

  if (hasDestroyed && hasDropped) {
    // Both - show as stacked
    return (
      <div className="flex flex-col w-16 leading-tight">
        <span className="text-red-400">{destroyed}</span>
        <span className="text-green-500">{dropped}</span>
      </div>
    );
  } else if (hasDestroyed) {
    // Only destroyed
    return <div className="w-16 text-red-400">{destroyed}</div>;
  } else if (hasDropped) {
    // Only dropped
    return <div className="w-16 text-green-500">{dropped}</div>;
  } else {
    // None (default to 1 for fitted modules)
    return <div className="w-16 text-white">1</div>;
  }
};

// Group items by type ID AND status (destroyed/dropped separately)
const groupItems = (items: any[]) => {
  const grouped = new Map<
    string,
    {
      itemType: any;
      quantityDestroyed: number;
      quantityDropped: number;
    }
  >();

  items.forEach((item) => {
    const typeId = item.itemType.id;
    const isDestroyed = (item.quantityDestroyed || 0) > 0;
    const isDropped = (item.quantityDropped || 0) > 0;

    // Create separate entries for destroyed and dropped
    if (isDestroyed) {
      const key = `${typeId}-destroyed`;
      const existing = grouped.get(key);

      if (existing) {
        existing.quantityDestroyed += item.quantityDestroyed || 0;
      } else {
        grouped.set(key, {
          itemType: item.itemType,
          quantityDestroyed: item.quantityDestroyed || 0,
          quantityDropped: 0,
        });
      }
    }

    if (isDropped) {
      const key = `${typeId}-dropped`;
      const existing = grouped.get(key);

      if (existing) {
        existing.quantityDropped += item.quantityDropped || 0;
      } else {
        grouped.set(key, {
          itemType: item.itemType,
          quantityDestroyed: 0,
          quantityDropped: item.quantityDropped || 0,
        });
      }
    }
  });

  return Array.from(grouped.values());
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

  // Check if victim is a structure (Upwell structures have category "Structure")
  const isStructure = victim?.shipType?.group?.category?.name === "Structure";

  // Debug structure detection
  console.log("🏗️ Structure Debug:", {
    isStructure,
    categoryName: victim?.shipType?.group?.category?.name,
    shipName: victim?.shipType?.name,
    hasStructureFuel: (fitting?.structureFuel?.length ?? 0) > 0,
    structureFuelCount: fitting?.structureFuel?.length ?? 0,
  });

  // Backend'den gelen değerleri kullan
  const totalValue = km.totalValue || 0;
  const destroyedValue = km.destroyedValue || 0;
  const droppedValue = km.droppedValue || 0;

  return (
    <>
      {/* Header */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: FitScreen (2/3 width) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Fit + Victim */}
          <div className="flex flex-col gap-6 p-6 fit-and-victim">
            <div className="victim-card">
              {/* Grid container: FitScreen (1/2) + Summary (1/2) */}
              <div className="grid grid-cols-3 gap-6">
                {/* FitScreen - Left (2/3) */}
                <div className="col-span-2">
                  <div className="flex items-center justify-between pb-2">
                    <div className="flex items-center gap-2 pb-6">
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
                  <FitScreen
                    shipType={victim?.shipType}
                    fitting={fitting as any}
                  />
                </div>

                {/* Killmail Summary Card - Right (1/3) */}
                <div>
                  <div className="space-y-3">
                    {/* Character, Corp, Alliance Images */}
                    {victim?.character?.id && (
                      <div className="flex items-start">
                        {/* Character Portrait */}
                        <Tooltip content="Show Victim Info" position="top">
                          <a href={`/characters/${victim.character?.id}`}>
                            <img
                              src={`https://images.evetech.net/characters/${victim.character?.id}/portrait?size=128`}
                              alt={victim.character?.name || "Character"}
                              width={96}
                              height={96}
                              className="shadow-md"
                              loading="lazy"
                            />
                          </a>
                        </Tooltip>

                        <div className="flex flex-col">
                          {/* Alliance Portrait */}
                          <a href={`/alliances/${victim.alliance?.id}`}>
                            <img
                              src={`https://images.evetech.net/corporations/${victim.corporation?.id}/logo?size=64`}
                              alt={victim.corporation?.name || "Corporation"}
                              width={48}
                              height={48}
                              className="shadow-sm"
                              loading="lazy"
                            />
                          </a>
                          <a href={`/corporations/${victim.corporation?.id}`}>
                            {/* Corporation Portrait */}
                            <img
                              src={`https://images.evetech.net/alliances/${victim.alliance?.id}/logo?size=64`}
                              alt={victim.alliance?.name || "Alliance"}
                              width={48}
                              height={48}
                              className="shadow-sm"
                              loading="lazy"
                            />
                          </a>
                        </div>

                        <div className="flex flex-col items-start justify-start pl-4">
                          <Tooltip content="Show Victim Info" position="top">
                            <a
                              href={`/characters/${victim.character?.id}`}
                              className="text-gray-400 transition-colors hover:text-blue-400"
                            >
                              {victim.character?.name}
                            </a>
                          </Tooltip>

                          <Tooltip
                            content="Show Corporation Info"
                            position="top"
                          >
                            <a
                              href={`/corporations/${victim.corporation?.id}`}
                              className="text-gray-400 transition-colors hover:text-blue-400"
                            >
                              {victim.corporation?.name}
                            </a>
                          </Tooltip>

                          <Tooltip content="Show Alliance Info" position="top">
                            <a
                              href={`/alliances/${victim.alliance?.id}`}
                              className="text-gray-400 transition-colors hover:text-blue-400"
                            >
                              {victim.alliance?.name}
                            </a>
                          </Tooltip>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span className="text-gray-400">Ship</span>
                      <span className="text-right">
                        <span className="text-gray-400">
                          {victim?.shipType?.name}
                        </span>
                        {victim?.shipType?.group && (
                          <span className="text-gray-500">
                            {" "}
                            ({victim.shipType.group.name})
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">System</span>
                      <span className="text-right">
                        <span className="text-gray-400">
                          {km.solarSystem?.name}
                        </span>
                        {km.solarSystem?.security_status !== undefined &&
                          km.solarSystem.security_status !== null && (
                            <span
                              className={
                                km.solarSystem.security_status >= 0.5
                                  ? "text-green-400"
                                  : km.solarSystem.security_status > 0
                                    ? "text-yellow-400"
                                    : "text-red-400"
                              }
                            >
                              {" "}
                              ({km.solarSystem.security_status.toFixed(1)})
                            </span>
                          )}
                        {km.solarSystem?.constellation?.region && (
                          <span className="text-gray-500">
                            {" "}
                            / {km.solarSystem.constellation.region.name}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Time</span>
                      <span className="text-gray-400">
                        {new Date(km.killmailTime).toLocaleString("en-US", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Damage</span>
                      <span className="text-red-400 tabular-nums">
                        {victim?.damageTaken?.toLocaleString()}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Destroyed</span>
                        <span className="text-red-400 tabular-nums">
                          {formatISK(destroyedValue)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Dropped</span>
                        <span className="text-green-400 tabular-nums">
                          {formatISK(droppedValue)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Total</span>
                        <span className="font-bold text-yellow-400 tabular-nums">
                          {formatISK(totalValue)}
                        </span>
                      </div>
                    </div>
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
                <h3 className="mb-2 font-bold text-gray-400 uppercase">Ship</h3>
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
                      <div className="text-gray-500">
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
                    {(() => {
                      // Collect all modules and charges from slots
                      const modules: any[] = [];
                      const charges: any[] = [];

                      fitting.highSlots.slots.forEach((slot) => {
                        if (slot.module) {
                          modules.push(slot.module);
                          if (slot.module.charge) {
                            charges.push(slot.module.charge);
                          }
                        }
                      });

                      // Group modules and charges separately
                      const groupedModules = groupItems(modules);
                      const groupedCharges = groupItems(charges);

                      return (
                        <>
                          {/* Render grouped modules */}
                          {groupedModules.map((item, index) => {
                            const totalQty =
                              item.quantityDestroyed + item.quantityDropped ||
                              1;
                            const isDestroyed = item.quantityDestroyed > 0;
                            const isDropped = item.quantityDropped > 0;
                            const textColor = isDestroyed
                              ? "text-red-400"
                              : isDropped
                                ? "text-green-500"
                                : "text-white";

                            return (
                              <div
                                key={`module-${item.itemType.id}-${index}`}
                                className="flex items-center gap-3 py-2"
                              >
                                <img
                                  src={`https://images.evetech.net/types/${item.itemType.id}/icon?size=64`}
                                  alt={item.itemType.name}
                                  className="w-16 h-16"
                                  loading="lazy"
                                  decoding="async"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className={`truncate ${textColor}`}>
                                    {item.itemType.name}
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 text-right">
                                  {renderQuantity(
                                    item.quantityDestroyed,
                                    item.quantityDropped,
                                  )}
                                  <div
                                    className={`w-40 tabular-nums ${textColor}`}
                                  >
                                    {formatISK(
                                      getItemPrice(item.itemType.jitaPrice) *
                                        totalQty,
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {/* Render grouped charges */}
                          {groupedCharges.map((item, index) => {
                            const totalQty =
                              item.quantityDestroyed + item.quantityDropped ||
                              1;
                            const isDestroyed = item.quantityDestroyed > 0;
                            const isDropped = item.quantityDropped > 0;
                            const textColor = isDestroyed
                              ? "text-red-400"
                              : isDropped
                                ? "text-green-500"
                                : "text-gray-400";

                            return (
                              <div
                                key={`charge-${item.itemType.id}-${index}`}
                                className="flex items-center gap-3 py-2"
                              >
                                <img
                                  src={`https://images.evetech.net/types/${item.itemType.id}/icon?size=64`}
                                  alt={item.itemType.name}
                                  className="w-16 h-16 opacity-75"
                                  loading="lazy"
                                  decoding="async"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className={`truncate ${textColor}`}>
                                    {item.itemType.name}
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 text-right">
                                  {renderQuantity(
                                    item.quantityDestroyed,
                                    item.quantityDropped,
                                  )}
                                  <div
                                    className={`w-40 tabular-nums ${textColor}`}
                                  >
                                    {formatISK(
                                      getItemPrice(item.itemType.jitaPrice) *
                                        totalQty,
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

            {/* Mid Slots */}
            {fitting?.midSlots && fitting.midSlots.slots.length > 0 && (
              <div className="pb-4 mb-4 border-b border-white/10">
                <h3 className="mb-2 font-bold text-gray-400 uppercase">
                  Mid Slots
                </h3>
                <div className="space-y-2">
                  {(() => {
                    const modules: any[] = [];
                    const charges: any[] = [];

                    fitting.midSlots.slots.forEach((slot) => {
                      if (slot.module) {
                        modules.push(slot.module);
                        if (slot.module.charge) {
                          charges.push(slot.module.charge);
                        }
                      }
                    });

                    const groupedModules = groupItems(modules);
                    const groupedCharges = groupItems(charges);

                    return (
                      <>
                        {groupedModules.map((item, index) => {
                          const totalQty =
                            item.quantityDestroyed + item.quantityDropped || 1;
                          const isDestroyed = item.quantityDestroyed > 0;
                          const isDropped = item.quantityDropped > 0;
                          const textColor = isDestroyed
                            ? "text-red-400"
                            : isDropped
                              ? "text-green-500"
                              : "text-white";

                          return (
                            <div
                              key={`module-${item.itemType.id}-${index}`}
                              className="flex items-center gap-3 py-2"
                            >
                              <img
                                src={`https://images.evetech.net/types/${item.itemType.id}/icon?size=64`}
                                alt={item.itemType.name}
                                className="w-16 h-16"
                                loading="lazy"
                                decoding="async"
                              />
                              <div className="flex-1 min-w-0">
                                <div className={`truncate ${textColor}`}>
                                  {item.itemType.name}
                                </div>
                              </div>
                              <div className="flex items-center gap-4 text-right">
                                {renderQuantity(
                                  item.quantityDestroyed,
                                  item.quantityDropped,
                                )}
                                <div
                                  className={`w-40 tabular-nums ${textColor}`}
                                >
                                  {formatISK(
                                    getItemPrice(item.itemType.jitaPrice) *
                                      totalQty,
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {groupedCharges.map((item, index) => {
                          const totalQty =
                            item.quantityDestroyed + item.quantityDropped || 1;
                          const isDestroyed = item.quantityDestroyed > 0;
                          const isDropped = item.quantityDropped > 0;
                          const textColor = isDestroyed
                            ? "text-red-400"
                            : isDropped
                              ? "text-green-500"
                              : "text-white";

                          return (
                            <div
                              key={`charge-${item.itemType.id}-${index}`}
                              className="flex items-center gap-3 py-2"
                            >
                              <img
                                src={`https://images.evetech.net/types/${item.itemType.id}/icon?size=64`}
                                alt={item.itemType.name}
                                className="w-16 h-16 opacity-75"
                                loading="lazy"
                                decoding="async"
                              />
                              <div className="flex-1 min-w-0">
                                <div className={`truncate ${textColor}`}>
                                  {item.itemType.name}
                                </div>
                              </div>
                              <div className="flex gap-4 text-right">
                                <div className={`${textColor} w-16`}>
                                  {totalQty}
                                </div>
                                <div
                                  className={`${textColor} tabular-nums w-40`}
                                >
                                  {formatISK(
                                    getItemPrice(item.itemType.jitaPrice) *
                                      totalQty,
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Low Slots */}
            {fitting?.lowSlots && fitting.lowSlots.slots.length > 0 && (
              <div className="pb-4 mb-4 border-b border-white/10">
                <h3 className="mb-2 font-bold text-gray-400 uppercase">
                  Low Slots
                </h3>
                <div className="space-y-2">
                  {(() => {
                    const modules = fitting.lowSlots.slots
                      .filter((slot) => slot.module)
                      .map((slot) => slot.module);
                    const groupedModules = groupItems(modules);

                    return groupedModules.map((item, index) => {
                      const totalQty =
                        item.quantityDestroyed + item.quantityDropped || 1;
                      const isDestroyed = item.quantityDestroyed > 0;
                      const isDropped = item.quantityDropped > 0;
                      const textColor = isDestroyed
                        ? "text-red-400"
                        : isDropped
                          ? "text-green-500"
                          : "text-white";

                      return (
                        <div
                          key={`low-${item.itemType.id}-${index}`}
                          className="flex items-center gap-3 py-2"
                        >
                          <img
                            src={`https://images.evetech.net/types/${item.itemType.id}/icon?size=64`}
                            alt={item.itemType.name}
                            className="w-16 h-16"
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="flex-1 min-w-0">
                            <div className={`truncate ${textColor}`}>
                              {item.itemType.name}
                            </div>
                          </div>
                          <div className="flex gap-4 text-right">
                            <div className={`${textColor} w-16`}>
                              {totalQty}
                            </div>
                            <div className={`${textColor} tabular-nums w-40`}>
                              {formatISK(
                                getItemPrice(item.itemType.jitaPrice) *
                                  totalQty,
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* Rigs */}
            {fitting?.rigs && fitting.rigs.slots.length > 0 && (
              <div className="pb-4 mb-4 border-b border-white/10">
                <h3 className="mb-2 font-bold text-gray-400 uppercase">Rigs</h3>
                <div className="space-y-2">
                  {(() => {
                    const modules = fitting.rigs.slots
                      .filter((slot) => slot.module)
                      .map((slot) => slot.module);
                    const groupedModules = groupItems(modules);

                    return groupedModules.map((item, index) => {
                      const totalQty =
                        item.quantityDestroyed + item.quantityDropped || 1;
                      const isDestroyed = item.quantityDestroyed > 0;
                      const isDropped = item.quantityDropped > 0;
                      const textColor = isDestroyed
                        ? "text-red-400"
                        : isDropped
                          ? "text-green-500"
                          : "text-white";

                      return (
                        <div
                          key={`rig-${item.itemType.id}-${index}`}
                          className="flex items-center gap-3 py-2"
                        >
                          <img
                            src={`https://images.evetech.net/types/${item.itemType.id}/icon?size=64`}
                            alt={item.itemType.name}
                            className="w-16 h-16"
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="flex-1 min-w-0">
                            <div className={`truncate ${textColor}`}>
                              {item.itemType.name}
                            </div>
                          </div>
                          <div className="flex gap-4 text-right">
                            <div className={`${textColor} w-16`}>
                              {totalQty}
                            </div>
                            <div className={`${textColor} tabular-nums w-40`}>
                              {formatISK(
                                getItemPrice(item.itemType.jitaPrice) *
                                  totalQty,
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* Subsystems */}
            {fitting?.subsystems && fitting.subsystems.slots.length > 0 && (
              <div className="pb-4 mb-4 border-b border-white/10">
                <h3 className="mb-2 font-bold text-gray-400 uppercase">
                  Subsystems
                </h3>
                <div className="space-y-2">
                  {(() => {
                    const modules = fitting.subsystems.slots
                      .filter((slot) => slot.module)
                      .map((slot) => slot.module);
                    const groupedModules = groupItems(modules);

                    return groupedModules.map((item, index) => {
                      const totalQty =
                        item.quantityDestroyed + item.quantityDropped || 1;
                      const isDestroyed = item.quantityDestroyed > 0;
                      const isDropped = item.quantityDropped > 0;
                      const textColor = isDestroyed
                        ? "text-red-400"
                        : isDropped
                          ? "text-green-500"
                          : "text-white";

                      return (
                        <div
                          key={`subsystem-${item.itemType.id}-${index}`}
                          className="flex items-center gap-3 py-2"
                        >
                          <img
                            src={`https://images.evetech.net/types/${item.itemType.id}/icon?size=64`}
                            alt={item.itemType.name}
                            className="w-16 h-16"
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="flex-1 min-w-0">
                            <div className={`truncate ${textColor}`}>
                              {item.itemType.name}
                            </div>
                          </div>
                          <div className="flex gap-4 text-right">
                            <div className={`${textColor} w-16`}>
                              {totalQty}
                            </div>
                            <div className={`${textColor} tabular-nums w-40`}>
                              {formatISK(
                                getItemPrice(item.itemType.jitaPrice) *
                                  totalQty,
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* Structure Service Slots (Upwell Structures Only) */}
            {isStructure &&
              fitting?.serviceSlots &&
              fitting.serviceSlots.slots.some((slot) => slot.module) && (
                <div className="pb-4 mb-4 border-b border-white/10">
                  <h3 className="mb-2 font-bold text-purple-400 uppercase">
                    ⚙️ Structure Service Slots
                  </h3>
                  <div className="space-y-2">
                    {(() => {
                      const modules = fitting.serviceSlots.slots
                        .filter((slot) => slot.module)
                        .map((slot) => slot.module);
                      const groupedModules = groupItems(modules);

                      return groupedModules.map((item, index) => {
                        const totalQty =
                          item.quantityDestroyed + item.quantityDropped || 1;
                        const isDestroyed = item.quantityDestroyed > 0;
                        const isDropped = item.quantityDropped > 0;
                        const textColor = isDestroyed
                          ? "text-red-400"
                          : isDropped
                            ? "text-green-500"
                            : "text-white";

                        return (
                          <div
                            key={`service-${item.itemType.id}-${index}`}
                            className="flex items-center gap-3 py-2"
                          >
                            <img
                              src={`https://images.evetech.net/types/${item.itemType.id}/icon?size=64`}
                              alt={item.itemType.name}
                              className="w-16 h-16"
                              loading="lazy"
                              decoding="async"
                            />
                            <div className="flex-1 min-w-0">
                              <div className={`truncate ${textColor}`}>
                                {item.itemType.name}
                              </div>
                            </div>
                            <div className="flex gap-4 text-right">
                              <div className={`${textColor} w-16`}>
                                {totalQty}
                              </div>
                              <div className={`${textColor} tabular-nums w-40`}>
                                {formatISK(
                                  getItemPrice(item.itemType.jitaPrice) *
                                    totalQty,
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

            {/* Implants (Pod Kills) */}
            {fitting?.implants && fitting.implants.length > 0 && (
              <div className="pb-4 mb-4 border-b border-white/10">
                <h3 className="mb-2 font-bold text-gray-400 uppercase">
                  Implants
                </h3>
                <div className="space-y-2">
                  {(() => {
                    const groupedImplants = groupItems(fitting.implants);
                    return groupedImplants.map((item, index) => {
                      const totalQty =
                        item.quantityDestroyed + item.quantityDropped || 1;
                      const isDestroyed = item.quantityDestroyed > 0;
                      const isDropped = item.quantityDropped > 0;
                      const textColor = isDestroyed
                        ? "text-red-400"
                        : isDropped
                          ? "text-green-500"
                          : "text-white";

                      return (
                        <div
                          key={`implant-${item.itemType.id}-${index}`}
                          className="flex items-center gap-3 px-2 py-2"
                        >
                          <img
                            src={`https://images.evetech.net/types/${item.itemType.id}/icon?size=64`}
                            alt={item.itemType.name}
                            className="w-16 h-16"
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="flex-1 min-w-0">
                            <div
                              className={`truncate ${textColor} font-medium`}
                            >
                              {item.itemType.name}
                            </div>
                          </div>
                          <div className="flex gap-4 text-right">
                            <div className={`${textColor} w-16`}>
                              {totalQty}
                            </div>
                            <div
                              className={`${textColor} tabular-nums w-40 font-semibold`}
                            >
                              {formatISK(
                                getItemPrice(item.itemType.jitaPrice) *
                                  totalQty,
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* Drone Bay */}
            {fitting?.droneBay && fitting.droneBay.length > 0 && (
              <div className="pb-4 mb-4 border-b border-white/10">
                <h3 className="mb-2 font-bold text-gray-400 uppercase">
                  Drone Bay
                </h3>
                <div className="space-y-2">
                  {(() => {
                    const groupedDrones = groupItems(fitting.droneBay);
                    return groupedDrones.map((item, index) => {
                      const totalQty =
                        item.quantityDestroyed + item.quantityDropped || 1;
                      const isDestroyed = item.quantityDestroyed > 0;
                      const isDropped = item.quantityDropped > 0;
                      const textColor = isDestroyed
                        ? "text-red-400"
                        : isDropped
                          ? "text-green-500"
                          : "text-white";

                      return (
                        <div
                          key={`drone-${item.itemType.id}-${index}`}
                          className="flex items-center gap-3 py-2"
                        >
                          <img
                            src={`https://images.evetech.net/types/${item.itemType.id}/icon?size=64`}
                            alt={item.itemType.name}
                            className="w-16 h-16"
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="flex-1 min-w-0">
                            <div className={`truncate ${textColor}`}>
                              {item.itemType.name}
                            </div>
                          </div>
                          <div className="flex gap-4 text-right">
                            <div className={`${textColor} w-16`}>
                              {totalQty}
                            </div>
                            <div className={`${textColor} tabular-nums w-40`}>
                              {formatISK(
                                getItemPrice(item.itemType.jitaPrice) *
                                  totalQty,
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* Cargo Bay */}
            {fitting?.cargo && fitting.cargo.length > 0 && (
              <div className="pb-4 mb-4 border-b border-white/10">
                <h3 className="mb-2 font-bold text-gray-400 uppercase">
                  Cargo Bay
                </h3>
                <div className="space-y-2">
                  {(() => {
                    const groupedCargo = groupItems(fitting.cargo);
                    return groupedCargo.map((item, index) => {
                      const totalQty =
                        item.quantityDestroyed + item.quantityDropped || 1;
                      const isDestroyed = item.quantityDestroyed > 0;
                      const isDropped = item.quantityDropped > 0;
                      const textColor = isDestroyed
                        ? "text-red-400"
                        : isDropped
                          ? "text-green-500"
                          : "text-white";

                      return (
                        <div
                          key={`cargo-${item.itemType.id}-${index}`}
                          className="flex items-center gap-3 py-2"
                        >
                          <img
                            src={`https://images.evetech.net/types/${item.itemType.id}/icon?size=64`}
                            alt={item.itemType.name}
                            className="w-16 h-16"
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="flex-1 min-w-0">
                            <div className={`truncate ${textColor}`}>
                              {item.itemType.name}
                            </div>
                          </div>
                          <div className="flex gap-4 text-right">
                            <div className={`${textColor} w-16`}>
                              {totalQty}
                            </div>
                            <div className={`${textColor} tabular-nums w-40`}>
                              {formatISK(
                                getItemPrice(item.itemType.jitaPrice) *
                                  totalQty,
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* Fighter Bay */}
            {fitting?.fighterBay && fitting.fighterBay.length > 0 && (
              <div className="pb-4 mb-4 border-b border-white/10">
                <h3 className="mb-2 font-bold text-gray-400 uppercase">
                  Fighter Bay
                </h3>
                <div className="space-y-2">
                  {(() => {
                    const groupedFighters = groupItems(fitting.fighterBay);
                    return groupedFighters.map((item, index) => {
                      const totalQty =
                        item.quantityDestroyed + item.quantityDropped || 1;
                      const isDestroyed = item.quantityDestroyed > 0;
                      const isDropped = item.quantityDropped > 0;
                      const textColor = isDestroyed
                        ? "text-red-400"
                        : isDropped
                          ? "text-green-500"
                          : "text-white";

                      return (
                        <div
                          key={`fighter-${item.itemType.id}-${index}`}
                          className="flex items-center gap-3 py-2"
                        >
                          <img
                            src={`https://images.evetech.net/types/${item.itemType.id}/icon?size=64`}
                            alt={item.itemType.name}
                            className="w-16 h-16"
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="flex-1 min-w-0">
                            <div className={`truncate ${textColor}`}>
                              {item.itemType.name}
                            </div>
                          </div>
                          <div className="flex gap-4 text-right">
                            <div className={`${textColor} w-16`}>
                              {totalQty}
                            </div>
                            <div className={`${textColor} tabular-nums w-40`}>
                              {formatISK(
                                getItemPrice(item.itemType.jitaPrice) *
                                  totalQty,
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* Structure Fuel (Upwell Structures Only) */}
            {isStructure &&
              fitting?.structureFuel &&
              fitting.structureFuel.length > 0 && (
                <div className="pb-4 mb-4 border-b border-white/10">
                  <h3 className="mb-2 font-bold text-orange-400 uppercase">
                    ⚡ Structure Fuel
                  </h3>
                  <div className="space-y-2">
                    {(() => {
                      const groupedFuel = groupItems(fitting.structureFuel);
                      return groupedFuel.map((item, index) => {
                        const totalQty =
                          item.quantityDestroyed + item.quantityDropped || 1;
                        const isDestroyed = item.quantityDestroyed > 0;
                        const isDropped = item.quantityDropped > 0;
                        const textColor = isDestroyed
                          ? "text-red-400"
                          : isDropped
                            ? "text-green-500"
                            : "text-white";

                        return (
                          <div
                            key={`fuel-${item.itemType.id}-${index}`}
                            className="flex items-center gap-3 py-2"
                          >
                            <img
                              src={`https://images.evetech.net/types/${item.itemType.id}/icon?size=64`}
                              alt={item.itemType.name}
                              className="w-16 h-16"
                              loading="lazy"
                              decoding="async"
                            />
                            <div className="flex-1 min-w-0">
                              <div className={`truncate ${textColor}`}>
                                {item.itemType.name}
                              </div>
                            </div>
                            <div className="flex gap-4 text-right">
                              <div className={`${textColor} w-16`}>
                                {totalQty}
                              </div>
                              <div className={`${textColor} tabular-nums w-40`}>
                                {formatISK(
                                  getItemPrice(item.itemType.jitaPrice) *
                                    totalQty,
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

            {/* Structure Core Room (Upwell Structures Only - Quantum Core) */}
            {isStructure &&
              fitting?.coreRoom &&
              fitting.coreRoom.length > 0 && (
                <div className="pb-4 mb-4 border-b border-white/10">
                  <h3 className="mb-2 font-bold text-cyan-400 uppercase">
                    💎 Structure Core Room
                  </h3>
                  <div className="space-y-2">
                    {(() => {
                      const groupedCore = groupItems(fitting.coreRoom);
                      return groupedCore.map((item, index) => {
                        const totalQty =
                          item.quantityDestroyed + item.quantityDropped || 1;
                        const isDestroyed = item.quantityDestroyed > 0;
                        const isDropped = item.quantityDropped > 0;
                        const textColor = isDestroyed
                          ? "text-red-400"
                          : isDropped
                            ? "text-green-500"
                            : "text-white";

                        return (
                          <div
                            key={`core-${item.itemType.id}-${index}`}
                            className="flex items-center gap-3 py-2"
                          >
                            <img
                              src={`https://images.evetech.net/types/${item.itemType.id}/icon?size=64`}
                              alt={item.itemType.name}
                              className="w-16 h-16"
                              loading="lazy"
                              decoding="async"
                            />
                            <div className="flex-1 min-w-0">
                              <div className={`truncate ${textColor}`}>
                                {item.itemType.name}
                              </div>
                            </div>
                            <div className="flex gap-4 text-right">
                              <div className={`${textColor} w-16`}>
                                {totalQty}
                              </div>
                              <div className={`${textColor} tabular-nums w-40`}>
                                {formatISK(
                                  getItemPrice(item.itemType.jitaPrice) *
                                    totalQty,
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
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
