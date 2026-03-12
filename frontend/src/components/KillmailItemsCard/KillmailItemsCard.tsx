import { formatISK } from "@/utils/formatISK";
import {
  getItemImageUrl,
  getItemName,
  isBlueprint,
} from "@/utils/itemImageUrl";
import { getShipTier } from "@/utils/shipTier";
import ShipTierBadge from "../ShipTierBadge/ShipTierBadge";

const getItemPrice = (itemType: any, singleton: number = 1, jitaPrice: any) => {
  // Blueprint Copy (singleton !== 1) has minimal value
  const blueprint = isBlueprint(itemType);
  const isCopy = blueprint && singleton !== 1;

  if (isCopy) {
    return 0.01; // Blueprint copies have minimal value
  }

  return jitaPrice?.sell || jitaPrice?.average || 0;
};

// Special handling for Capsule ship price
const getShipPrice = (shipType: any) => {
  // Capsule (type_id: 670) has fixed value of 10 ISK
  if (shipType?.id === 670) {
    return 10;
  }
  return getItemPrice(shipType, 1, shipType?.jitaPrice);
};

// Render quantity with separate destroyed/dropped display
const renderQuantity = (destroyed: number, dropped: number) => {
  const hasDestroyed = destroyed > 0;
  const hasDropped = dropped > 0;

  if (hasDestroyed && hasDropped) {
    return (
      <div className="flex flex-col w-16 leading-tight">
        <span className="text-red-400">{destroyed}</span>
        <span className="text-green-500">{dropped}</span>
      </div>
    );
  } else if (hasDestroyed) {
    return <div className="w-16 text-red-400">{destroyed}</div>;
  } else if (hasDropped) {
    return <div className="w-16 text-green-500">{dropped}</div>;
  } else {
    return <div className="w-16 text-white">1</div>;
  }
};

// Group items by type ID AND status (destroyed/dropped separately)
const groupItems = (items: any[]) => {
  const grouped = new Map<
    string,
    {
      itemType: any;
      singleton: number;
      quantityDestroyed: number;
      quantityDropped: number;
    }
  >();

  items.forEach((item) => {
    const typeId = item.itemType.id;
    const singleton = item.singleton;
    const isDestroyed = (item.quantityDestroyed || 0) > 0;
    const isDropped = (item.quantityDropped || 0) > 0;

    if (isDestroyed) {
      const key = `${typeId}-${singleton}-destroyed`;
      const existing = grouped.get(key);

      if (existing) {
        existing.quantityDestroyed += item.quantityDestroyed || 0;
      } else {
        grouped.set(key, {
          itemType: item.itemType,
          singleton: item.singleton,
          quantityDestroyed: item.quantityDestroyed || 0,
          quantityDropped: 0,
        });
      }
    }

    if (isDropped) {
      const key = `${typeId}-${singleton}-dropped`;
      const existing = grouped.get(key);

      if (existing) {
        existing.quantityDropped += item.quantityDropped || 0;
      } else {
        grouped.set(key, {
          itemType: item.itemType,
          singleton: item.singleton,
          quantityDestroyed: 0,
          quantityDropped: item.quantityDropped || 0,
        });
      }
    }
  });

  return Array.from(grouped.values());
};

interface KillmailSummaryCardProps {
  victim: any;
  fitting: any;
  isStructure: boolean;
  destroyedValue: number;
  droppedValue: number;
  totalValue: number;
}

export default function KillmailSummaryCard({
  victim,
  fitting,
  isStructure,
  destroyedValue,
  droppedValue,
  totalValue,
}: KillmailSummaryCardProps) {
  return (
    <div className="p-6 items-card">
      {/* Ship */}
      {victim?.shipType && (
        <div className="pb-4 mb-4 border-b border-white/10">
          <h3 className="mb-2 font-bold text-gray-400 uppercase">Ship</h3>
          <div className="flex items-center gap-3 py-2">
            <div className="relative shrink-0">
              {getShipTier(victim.shipType.dogmaAttributes) && (
                <div className="absolute top-0 left-0 z-20">
                  <ShipTierBadge
                    tier={getShipTier(victim.shipType.dogmaAttributes)}
                    className="size-5"
                  />
                </div>
              )}
              <img
                src={`https://images.evetech.net/types/${victim.shipType.id}/render?size=128`}
                alt={victim.shipType.name}
                className="border size-16 border-amber-900/80"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (target.src.includes("/render?")) {
                    target.src = `https://images.evetech.net/types/${victim.shipType.id}/icon?size=128`;
                  }
                }}
              />
            </div>
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
              <div className="text-red-400 tabular-nums">1</div>
              <div className="w-40 text-red-400 tabular-nums">
                {formatISK(getShipPrice(victim.shipType))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* High Slots */}
      {fitting?.highSlots &&
        fitting.highSlots.slots.some((slot: any) => slot.module) && (
          <div className="pb-4 mb-4 border-b border-white/10">
            <h3 className="mb-2 font-bold text-gray-400 uppercase">
              High Slots
            </h3>
            <div className="space-y-2">
              {(() => {
                const modules: any[] = [];
                const charges: any[] = [];

                fitting.highSlots.slots.forEach((slot: any) => {
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
                            src={getItemImageUrl(
                              item.itemType,
                              item.singleton,
                              64,
                            )}
                            alt={getItemName(item.itemType, item.singleton)}
                            className="border bg-white/5 size-16 border-white/10"
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="flex-1 min-w-0">
                            <div className={`truncate ${textColor}`}>
                              {getItemName(item.itemType, item.singleton)}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-right">
                            {renderQuantity(
                              item.quantityDestroyed,
                              item.quantityDropped,
                            )}
                            <div className={`w-40 tabular-nums ${textColor}`}>
                              {formatISK(
                                getItemPrice(
                                  item.itemType,
                                  item.singleton,
                                  item.itemType.jitaPrice,
                                ) * totalQty,
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
                          : "text-gray-400";

                      return (
                        <div
                          key={`charge-${item.itemType.id}-${index}`}
                          className="flex items-center gap-3 py-2"
                        >
                          <img
                            src={getItemImageUrl(
                              item.itemType,
                              item.singleton,
                              64,
                            )}
                            alt={getItemName(item.itemType, item.singleton)}
                            className="border bg-white/5 size-16 border-white/10"
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="flex-1 min-w-0">
                            <div className={`truncate ${textColor}`}>
                              {getItemName(item.itemType, item.singleton)}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-right">
                            {renderQuantity(
                              item.quantityDestroyed,
                              item.quantityDropped,
                            )}
                            <div className={`w-40 tabular-nums ${textColor}`}>
                              {formatISK(
                                getItemPrice(
                                  item.itemType,
                                  item.singleton,
                                  item.itemType.jitaPrice,
                                ) * totalQty,
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
      {fitting?.midSlots &&
        fitting.midSlots.slots.some((slot: any) => slot.module) && (
          <div className="pb-4 mb-4 border-b border-white/10">
            <h3 className="mb-2 font-bold text-gray-400 uppercase">
              Mid Slots
            </h3>
            <div className="space-y-2">
              {(() => {
                const modules: any[] = [];
                const charges: any[] = [];

                fitting.midSlots.slots.forEach((slot: any) => {
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
                            src={getItemImageUrl(
                              item.itemType,
                              item.singleton,
                              64,
                            )}
                            alt={getItemName(item.itemType, item.singleton)}
                            className="border bg-white/5 size-16 border-white/10"
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="flex-1 min-w-0">
                            <div className={`truncate ${textColor}`}>
                              {getItemName(item.itemType, item.singleton)}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-right">
                            {renderQuantity(
                              item.quantityDestroyed,
                              item.quantityDropped,
                            )}
                            <div className={`w-40 tabular-nums ${textColor}`}>
                              {formatISK(
                                getItemPrice(
                                  item.itemType,
                                  item.singleton,
                                  item.itemType.jitaPrice,
                                ) * totalQty,
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
                            src={getItemImageUrl(
                              item.itemType,
                              item.singleton,
                              64,
                            )}
                            alt={getItemName(item.itemType, item.singleton)}
                            className="border bg-white/5 size-16 border-white/10"
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="flex-1 min-w-0">
                            <div className={`truncate ${textColor}`}>
                              {getItemName(item.itemType, item.singleton)}
                            </div>
                          </div>
                          <div className="flex gap-4 text-right">
                            <div className={`${textColor} w-16`}>
                              {totalQty}
                            </div>
                            <div className={`${textColor} tabular-nums w-40`}>
                              {formatISK(
                                getItemPrice(
                                  item.itemType,
                                  item.singleton,
                                  item.itemType.jitaPrice,
                                ) * totalQty,
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
      {fitting?.lowSlots &&
        fitting.lowSlots.slots.some((slot: any) => slot.module) && (
          <div className="pb-4 mb-4 border-b border-white/10">
            <h3 className="mb-2 font-bold text-gray-400 uppercase">
              Low Slots
            </h3>
            <div className="space-y-2">
              {(() => {
                const modules = fitting.lowSlots.slots
                  .filter((slot: any) => slot.module)
                  .map((slot: any) => slot.module);
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
                        src={getItemImageUrl(item.itemType, item.singleton, 64)}
                        alt={getItemName(item.itemType, item.singleton)}
                        className="border bg-white/5 size-16 border-white/10"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`truncate ${textColor}`}>
                          {getItemName(item.itemType, item.singleton)}
                        </div>
                      </div>
                      <div className="flex gap-4 text-right">
                        <div className={`${textColor} w-16`}>{totalQty}</div>
                        <div className={`${textColor} tabular-nums w-40`}>
                          {formatISK(
                            getItemPrice(
                              item.itemType,
                              item.singleton,
                              item.itemType.jitaPrice,
                            ) * totalQty,
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
                .filter((slot: any) => slot.module)
                .map((slot: any) => slot.module);
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
                      src={getItemImageUrl(item.itemType, item.singleton, 64)}
                      alt={getItemName(item.itemType, item.singleton)}
                      className="border bg-white/5 size-16 border-white/10"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`truncate ${textColor}`}>
                        {getItemName(item.itemType, item.singleton)}
                      </div>
                    </div>
                    <div className="flex gap-4 text-right">
                      <div className={`${textColor} w-16`}>{totalQty}</div>
                      <div className={`${textColor} tabular-nums w-40`}>
                        {formatISK(
                          getItemPrice(
                            item.itemType,
                            item.singleton,
                            item.itemType.jitaPrice,
                          ) * totalQty,
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
          <h3 className="mb-2 font-bold text-gray-400 uppercase">Subsystems</h3>
          <div className="space-y-2">
            {(() => {
              const modules = fitting.subsystems.slots
                .filter((slot: any) => slot.module)
                .map((slot: any) => slot.module);
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
                      src={getItemImageUrl(item.itemType, item.singleton, 64)}
                      alt={getItemName(item.itemType, item.singleton)}
                      className="border bg-white/5 size-16 border-white/10"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`truncate ${textColor}`}>
                        {getItemName(item.itemType, item.singleton)}
                      </div>
                    </div>
                    <div className="flex gap-4 text-right">
                      <div className={`${textColor} w-16`}>{totalQty}</div>
                      <div className={`${textColor} tabular-nums w-40`}>
                        {formatISK(
                          getItemPrice(
                            item.itemType,
                            item.singleton,
                            item.itemType.jitaPrice,
                          ) * totalQty,
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

      {/* Service Slots */}
      {isStructure &&
        fitting?.serviceSlots &&
        fitting.serviceSlots.slots.some((slot: any) => slot.module) && (
          <div className="pb-4 mb-4 border-b border-white/10">
            <h3 className="mb-2 font-bold text-gray-400 uppercase">
              Service Slots
            </h3>
            <div className="space-y-2">
              {(() => {
                const modules = fitting.serviceSlots.slots
                  .filter((slot: any) => slot.module)
                  .map((slot: any) => slot.module);
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
                        src={getItemImageUrl(item.itemType, item.singleton, 64)}
                        alt={getItemName(item.itemType, item.singleton)}
                        className="border bg-white/5 size-16 border-white/10"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`truncate ${textColor}`}>
                          {getItemName(item.itemType, item.singleton)}
                        </div>
                      </div>
                      <div className="flex gap-4 text-right">
                        <div className={`${textColor} w-16`}>{totalQty}</div>
                        <div className={`${textColor} tabular-nums w-40`}>
                          {formatISK(
                            getItemPrice(
                              item.itemType,
                              item.singleton,
                              item.itemType.jitaPrice,
                            ) * totalQty,
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

      {/* Implants */}
      {fitting?.implants && fitting.implants.length > 0 && (
        <div className="pb-4 mb-4 border-b border-white/10">
          <h3 className="mb-2 font-bold text-gray-400 uppercase">Implants</h3>
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
                      src={getItemImageUrl(item.itemType, item.singleton, 64)}
                      alt={getItemName(item.itemType, item.singleton)}
                      className="border bg-white/5 size-16 border-white/10"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`truncate ${textColor} font-medium`}>
                        {getItemName(item.itemType, item.singleton)}
                      </div>
                    </div>
                    <div className="flex gap-4 text-right">
                      <div className={`${textColor} w-16`}>{totalQty}</div>
                      <div
                        className={`${textColor} tabular-nums w-40 font-semibold`}
                      >
                        {formatISK(
                          getItemPrice(
                            item.itemType,
                            item.singleton,
                            item.itemType.jitaPrice,
                          ) * totalQty,
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
          <h3 className="mb-2 font-bold text-gray-400 uppercase">Drone Bay</h3>
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
                      src={getItemImageUrl(item.itemType, item.singleton, 64)}
                      alt={getItemName(item.itemType, item.singleton)}
                      className="border bg-white/5 size-16 border-white/10"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`truncate ${textColor}`}>
                        {getItemName(item.itemType, item.singleton)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      {renderQuantity(
                        item.quantityDestroyed,
                        item.quantityDropped,
                      )}
                      <div className={`w-40 tabular-nums ${textColor}`}>
                        {formatISK(
                          getItemPrice(
                            item.itemType,
                            item.singleton,
                            item.itemType.jitaPrice,
                          ) * totalQty,
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

      {/* Implants */}
      {fitting?.implants &&
        fitting.implants.slots &&
        fitting.implants.slots.some((slot: any) => slot.module) && (
          <div className="pb-4 mb-4 border-b border-white/10">
            <h3 className="mb-2 font-bold text-gray-400 uppercase">Implants</h3>
            <div className="space-y-2">
              {(() => {
                const modules = fitting.implants.slots
                  .filter((slot: any) => slot.module)
                  .map((slot: any) => slot.module);
                const groupedImplants = groupItems(modules);

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
                      className="flex items-center gap-3 py-2"
                    >
                      <img
                        src={getItemImageUrl(item.itemType, item.singleton, 64)}
                        alt={getItemName(item.itemType, item.singleton)}
                        className="border bg-white/5 size-16 border-white/10"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`truncate ${textColor}`}>
                          {getItemName(item.itemType, item.singleton)}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        {renderQuantity(
                          item.quantityDestroyed,
                          item.quantityDropped,
                        )}
                        <div className={`w-40 tabular-nums ${textColor}`}>
                          {formatISK(
                            getItemPrice(
                              item.itemType,
                              item.singleton,
                              item.itemType.jitaPrice,
                            ) * totalQty,
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

      {/* Cargo */}
      {fitting?.cargo && fitting.cargo.length > 0 && (
        <div className="pb-4 mb-4 border-b border-white/10">
          <h3 className="mb-2 font-bold text-gray-400 uppercase">Cargo</h3>
          <div className="space-y-2">
            {(() => {
              const groupedCargo = groupItems(fitting.cargo);
              return groupedCargo.map((item, index) => {
                // Debug for type 25949
                if (item.itemType.id === 25949) {
                  console.log("🔍 Cargo Item 25949 Full Object:", {
                    itemType: item.itemType,
                    singleton: item.singleton,
                    group: item.itemType.group,
                    category: item.itemType.group?.category,
                    categoryName: item.itemType.group?.category?.name,
                  });
                }

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
                      src={getItemImageUrl(item.itemType, item.singleton, 64)}
                      alt={getItemName(item.itemType, item.singleton)}
                      className="border bg-white/5 size-16 border-white/10"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`truncate ${textColor}`}>
                        {getItemName(item.itemType, item.singleton)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      {renderQuantity(
                        item.quantityDestroyed,
                        item.quantityDropped,
                      )}
                      <div className={`w-40 tabular-nums ${textColor}`}>
                        {formatISK(
                          getItemPrice(
                            item.itemType,
                            item.singleton,
                            item.itemType.jitaPrice,
                          ) * totalQty,
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

      {/* Fuel Bay */}
      {fitting?.fuelBay && fitting.fuelBay.length > 0 && (
        <div className="pb-4 mb-4 border-b border-white/10">
          <h3 className="mb-2 font-bold text-gray-400 uppercase">Fuel Bay</h3>
          <div className="space-y-2">
            {(() => {
              const groupedFuelBay = groupItems(fitting.fuelBay);
              return groupedFuelBay.map((item, index) => {
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
                    key={`fuel-bay-${item.itemType.id}-${index}`}
                    className="flex items-center gap-3 py-2"
                  >
                    <img
                      src={getItemImageUrl(item.itemType, item.singleton, 64)}
                      alt={getItemName(item.itemType, item.singleton)}
                      className="border bg-white/5 size-16 border-white/10"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`truncate ${textColor}`}>
                        {getItemName(item.itemType, item.singleton)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      {renderQuantity(
                        item.quantityDestroyed,
                        item.quantityDropped,
                      )}
                      <div className={`w-40 tabular-nums ${textColor}`}>
                        {formatISK(
                          getItemPrice(
                            item.itemType,
                            item.singleton,
                            item.itemType.jitaPrice,
                          ) * totalQty,
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

      {/* Mining Hold */}
      {fitting?.oreHold && fitting.oreHold.length > 0 && (
        <div className="pb-4 mb-4 border-b border-white/10">
          <h3 className="mb-2 font-bold text-gray-400 uppercase">
            Mining Hold
          </h3>
          <div className="space-y-2">
            {(() => {
              const groupedOreHold = groupItems(fitting.oreHold);
              return groupedOreHold.map((item, index) => {
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
                    key={`ore-hold-${item.itemType.id}-${index}`}
                    className="flex items-center gap-3 py-2"
                  >
                    <img
                      src={getItemImageUrl(item.itemType, item.singleton, 64)}
                      alt={getItemName(item.itemType, item.singleton)}
                      className="border bg-white/5 size-16 border-white/10"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`truncate ${textColor}`}>
                        {getItemName(item.itemType, item.singleton)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      {renderQuantity(
                        item.quantityDestroyed,
                        item.quantityDropped,
                      )}
                      <div className={`w-40 tabular-nums ${textColor}`}>
                        {formatISK(
                          getItemPrice(
                            item.itemType,
                            item.singleton,
                            item.itemType.jitaPrice,
                          ) * totalQty,
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

      {/* Fleet Hangar */}
      {fitting?.fleetHangar && fitting.fleetHangar.length > 0 && (
        <div className="pb-4 mb-4 border-b border-white/10">
          <h3 className="mb-2 font-bold text-gray-400 uppercase">
            Fleet Hangar
          </h3>
          <div className="space-y-2">
            {(() => {
              const groupedFleetHangar = groupItems(fitting.fleetHangar);
              return groupedFleetHangar.map((item, index) => {
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
                    key={`fleet-hangar-${item.itemType.id}-${index}`}
                    className="flex items-center gap-3 py-2"
                  >
                    <img
                      src={getItemImageUrl(item.itemType, item.singleton, 64)}
                      alt={getItemName(item.itemType, item.singleton)}
                      className="border bg-white/5 size-16 border-white/10"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`truncate ${textColor}`}>
                        {getItemName(item.itemType, item.singleton)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      {renderQuantity(
                        item.quantityDestroyed,
                        item.quantityDropped,
                      )}
                      <div className={`w-40 tabular-nums ${textColor}`}>
                        {formatISK(
                          getItemPrice(
                            item.itemType,
                            item.singleton,
                            item.itemType.jitaPrice,
                          ) * totalQty,
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

      {/* Infrastructure Hangar */}
      {fitting?.infrastructureHangar &&
        fitting.infrastructureHangar.length > 0 && (
          <div className="pb-4 mb-4 border-b border-white/10">
            <h3 className="mb-2 font-bold text-gray-400 uppercase">
              Infrastructure Hangar
            </h3>
            <div className="space-y-2">
              {(() => {
                const groupedInfrastructureHangar = groupItems(
                  fitting.infrastructureHangar,
                );
                return groupedInfrastructureHangar.map((item, index) => {
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
                      key={`infrastructure-hangar-${item.itemType.id}-${index}`}
                      className="flex items-center gap-3 py-2"
                    >
                      <img
                        src={getItemImageUrl(item.itemType, item.singleton, 64)}
                        alt={getItemName(item.itemType, item.singleton)}
                        className="border bg-white/5 size-16 border-white/10"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`truncate ${textColor}`}>
                          {getItemName(item.itemType, item.singleton)}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        {renderQuantity(
                          item.quantityDestroyed,
                          item.quantityDropped,
                        )}
                        <div className={`w-40 tabular-nums ${textColor}`}>
                          {formatISK(
                            getItemPrice(
                              item.itemType,
                              item.singleton,
                              item.itemType.jitaPrice,
                            ) * totalQty,
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

      {/* Gas Hold */}
      {fitting?.gasHold && fitting.gasHold.length > 0 && (
        <div className="pb-4 mb-4 border-b border-white/10">
          <h3 className="mb-2 font-bold text-gray-400 uppercase">Gas Hold</h3>
          <div className="space-y-2">
            {(() => {
              const groupedGasHold = groupItems(fitting.gasHold);
              return groupedGasHold.map((item, index) => {
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
                    key={`gas-hold-${item.itemType.id}-${index}`}
                    className="flex items-center gap-3 py-2"
                  >
                    <img
                      src={getItemImageUrl(item.itemType, item.singleton, 64)}
                      alt={getItemName(item.itemType, item.singleton)}
                      className="border bg-white/5 size-16 border-white/10"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`truncate ${textColor}`}>
                        {getItemName(item.itemType, item.singleton)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      {renderQuantity(
                        item.quantityDestroyed,
                        item.quantityDropped,
                      )}
                      <div className={`w-40 tabular-nums ${textColor}`}>
                        {formatISK(
                          getItemPrice(
                            item.itemType,
                            item.singleton,
                            item.itemType.jitaPrice,
                          ) * totalQty,
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

      {/* Mineral Hold */}
      {fitting?.mineralHold && fitting.mineralHold.length > 0 && (
        <div className="pb-4 mb-4 border-b border-white/10">
          <h3 className="mb-2 font-bold text-gray-400 uppercase">
            Mineral Hold
          </h3>
          <div className="space-y-2">
            {(() => {
              const groupedMineralHold = groupItems(fitting.mineralHold);
              return groupedMineralHold.map((item, index) => {
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
                    key={`mineral-hold-${item.itemType.id}-${index}`}
                    className="flex items-center gap-3 py-2"
                  >
                    <img
                      src={getItemImageUrl(item.itemType, item.singleton, 64)}
                      alt={getItemName(item.itemType, item.singleton)}
                      className="border bg-white/5 size-16 border-white/10"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`truncate ${textColor}`}>
                        {getItemName(item.itemType, item.singleton)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      {renderQuantity(
                        item.quantityDestroyed,
                        item.quantityDropped,
                      )}
                      <div className={`w-40 tabular-nums ${textColor}`}>
                        {formatISK(
                          getItemPrice(
                            item.itemType,
                            item.singleton,
                            item.itemType.jitaPrice,
                          ) * totalQty,
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

      {/* Salvage Hold */}
      {fitting?.salvageHold && fitting.salvageHold.length > 0 && (
        <div className="pb-4 mb-4 border-b border-white/10">
          <h3 className="mb-2 font-bold text-gray-400 uppercase">
            Salvage Hold
          </h3>
          <div className="space-y-2">
            {(() => {
              const groupedSalvageHold = groupItems(fitting.salvageHold);
              return groupedSalvageHold.map((item, index) => {
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
                    key={`salvage-hold-${item.itemType.id}-${index}`}
                    className="flex items-center gap-3 py-2"
                  >
                    <img
                      src={getItemImageUrl(item.itemType, item.singleton, 64)}
                      alt={getItemName(item.itemType, item.singleton)}
                      className="border bg-white/5 size-16 border-white/10"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`truncate ${textColor}`}>
                        {getItemName(item.itemType, item.singleton)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      {renderQuantity(
                        item.quantityDestroyed,
                        item.quantityDropped,
                      )}
                      <div className={`w-40 tabular-nums ${textColor}`}>
                        {formatISK(
                          getItemPrice(
                            item.itemType,
                            item.singleton,
                            item.itemType.jitaPrice,
                          ) * totalQty,
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

      {/* Planetary Commodities Hold */}
      {fitting?.planetaryCommoditiesHold &&
        fitting.planetaryCommoditiesHold.length > 0 && (
          <div className="pb-4 mb-4 border-b border-white/10">
            <h3 className="mb-2 font-bold text-gray-400 uppercase">
              Planetary Commodities Hold
            </h3>
            <div className="space-y-2">
              {(() => {
                const groupedPlanetaryCommodities = groupItems(
                  fitting.planetaryCommoditiesHold,
                );
                return groupedPlanetaryCommodities.map((item, index) => {
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
                      key={`planetary-commodities-${item.itemType.id}-${index}`}
                      className="flex items-center gap-3 py-2"
                    >
                      <img
                        src={getItemImageUrl(item.itemType, item.singleton, 64)}
                        alt={getItemName(item.itemType, item.singleton)}
                        className="border bg-white/5 size-16 border-white/10"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`truncate ${textColor}`}>
                          {getItemName(item.itemType, item.singleton)}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        {renderQuantity(
                          item.quantityDestroyed,
                          item.quantityDropped,
                        )}
                        <div className={`w-40 tabular-nums ${textColor}`}>
                          {formatISK(
                            getItemPrice(
                              item.itemType,
                              item.singleton,
                              item.itemType.jitaPrice,
                            ) * totalQty,
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

      {/* Ice Hold */}
      {fitting?.iceHold && fitting.iceHold.length > 0 && (
        <div className="pb-4 mb-4 border-b border-white/10">
          <h3 className="mb-2 font-bold text-gray-400 uppercase">Ice Hold</h3>
          <div className="space-y-2">
            {(() => {
              const groupedIceHold = groupItems(fitting.iceHold);
              return groupedIceHold.map((item, index) => {
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
                    key={`ice-hold-${item.itemType.id}-${index}`}
                    className="flex items-center gap-3 py-2"
                  >
                    <img
                      src={getItemImageUrl(item.itemType, item.singleton, 64)}
                      alt={getItemName(item.itemType, item.singleton)}
                      className="border bg-white/5 size-16 border-white/10"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`truncate ${textColor}`}>
                        {getItemName(item.itemType, item.singleton)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      {renderQuantity(
                        item.quantityDestroyed,
                        item.quantityDropped,
                      )}
                      <div className={`w-40 tabular-nums ${textColor}`}>
                        {formatISK(
                          getItemPrice(
                            item.itemType,
                            item.singleton,
                            item.itemType.jitaPrice,
                          ) * totalQty,
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

      {/* Infrastructure Hold */}
      {fitting?.infrastructureHold && fitting.infrastructureHold.length > 0 && (
        <div className="pb-4 mb-4 border-b border-white/10">
          <h3 className="mb-2 font-bold text-gray-400 uppercase">
            Infrastructure Hold
          </h3>
          <div className="space-y-2">
            {(() => {
              const groupedInfrastructureHold = groupItems(
                fitting.infrastructureHold,
              );
              return groupedInfrastructureHold.map((item, index) => {
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
                    key={`infrastructure-hold-${item.itemType.id}-${index}`}
                    className="flex items-center gap-3 py-2"
                  >
                    <img
                      src={getItemImageUrl(item.itemType, item.singleton, 64)}
                      alt={getItemName(item.itemType, item.singleton)}
                      className="border bg-white/5 size-16 border-white/10"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`truncate ${textColor}`}>
                        {getItemName(item.itemType, item.singleton)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      {renderQuantity(
                        item.quantityDestroyed,
                        item.quantityDropped,
                      )}
                      <div className={`w-40 tabular-nums ${textColor}`}>
                        {formatISK(
                          getItemPrice(
                            item.itemType,
                            item.singleton,
                            item.itemType.jitaPrice,
                          ) * totalQty,
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
                      src={getItemImageUrl(item.itemType, item.singleton, 64)}
                      alt={getItemName(item.itemType, item.singleton)}
                      className="border bg-white/5 size-16 border-white/10"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`truncate ${textColor}`}>
                        {getItemName(item.itemType, item.singleton)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      {renderQuantity(
                        item.quantityDestroyed,
                        item.quantityDropped,
                      )}
                      <div className={`w-40 tabular-nums ${textColor}`}>
                        {formatISK(
                          getItemPrice(
                            item.itemType,
                            item.singleton,
                            item.itemType.jitaPrice,
                          ) * totalQty,
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

      {/* Structure Fuel */}
      {isStructure &&
        fitting?.structureFuel &&
        fitting.structureFuel.length > 0 && (
          <div className="pb-4 mb-4 border-b border-white/10">
            <h3 className="mb-2 font-bold text-gray-400 uppercase">
              Structure Fuel
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
                        src={getItemImageUrl(item.itemType, item.singleton, 64)}
                        alt={getItemName(item.itemType, item.singleton)}
                        className="border bg-white/5 size-16 border-white/10"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`truncate ${textColor}`}>
                          {getItemName(item.itemType, item.singleton)}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        {renderQuantity(
                          item.quantityDestroyed,
                          item.quantityDropped,
                        )}
                        <div className={`w-40 tabular-nums ${textColor}`}>
                          {formatISK(
                            getItemPrice(
                              item.itemType,
                              item.singleton,
                              item.itemType.jitaPrice,
                            ) * totalQty,
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

      {/* Core Room */}
      {isStructure && fitting?.coreRoom && fitting.coreRoom.length > 0 && (
        <div className="pb-4 mb-4 border-b border-white/10">
          <h3 className="mb-2 font-bold text-gray-400 uppercase">Core Room</h3>
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
                      src={getItemImageUrl(item.itemType, item.singleton, 64)}
                      alt={getItemName(item.itemType, item.singleton)}
                      className="border bg-white/5 size-16 border-white/10"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`truncate ${textColor}`}>
                        {getItemName(item.itemType, item.singleton)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      {renderQuantity(
                        item.quantityDestroyed,
                        item.quantityDropped,
                      )}
                      <div className={`w-40 tabular-nums ${textColor}`}>
                        {formatISK(
                          getItemPrice(
                            item.itemType,
                            item.singleton,
                            item.itemType.jitaPrice,
                          ) * totalQty,
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

      {/* Value Summary */}
      <div>
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
  );
}
