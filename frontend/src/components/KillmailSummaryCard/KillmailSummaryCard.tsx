import { formatISK } from "@/utils/formatISK";
import { isBlueprint } from "@/utils/itemImageUrl";
import { getShipTier } from "@/utils/shipTier";
import ShipTierBadge from "../ShipTierBadge/ShipTierBadge";
import FittingSection from "./FittingSection";

// Special handling for Capsule ship price
const getShipPrice = (shipType: any) => {
  // Capsule (type_id: 670) has fixed value of 10 ISK
  if (shipType?.id === 670) {
    return 10;
  }
  const jitaPrice = shipType?.jitaPrice;
  const blueprint = isBlueprint(shipType);
  const isCopy = blueprint && 2 === 2; // Ships are never copies

  if (isCopy) {
    return 0.01;
  }

  return jitaPrice?.sell || jitaPrice?.average || 0;
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
          <FittingSection
            title="High Slots"
            items={fitting.highSlots.slots
              .filter((slot: any) => slot.module)
              .map((slot: any) => slot.module)}
            keyPrefix="high"
            hasCharges={true}
          />
        )}

      {/* Mid Slots */}
      {fitting?.midSlots &&
        fitting.midSlots.slots.some((slot: any) => slot.module) && (
          <FittingSection
            title="Mid Slots"
            items={fitting.midSlots.slots
              .filter((slot: any) => slot.module)
              .map((slot: any) => slot.module)}
            keyPrefix="mid"
            hasCharges={true}
          />
        )}

      {/* Low Slots */}
      {fitting?.lowSlots &&
        fitting.lowSlots.slots.some((slot: any) => slot.module) && (
          <FittingSection
            title="Low Slots"
            items={fitting.lowSlots.slots
              .filter((slot: any) => slot.module)
              .map((slot: any) => slot.module)}
            keyPrefix="low"
            hasCharges={false}
          />
        )}

      {/* Rigs */}
      {fitting?.rigs && fitting.rigs.slots.length > 0 && (
        <FittingSection
          title="Rigs"
          items={fitting.rigs.slots
            .filter((slot: any) => slot.module)
            .map((slot: any) => slot.module)}
          keyPrefix="rig"
          hasCharges={false}
        />
      )}

      {/* Subsystems */}
      {fitting?.subsystems && fitting.subsystems.slots.length > 0 && (
        <FittingSection
          title="Subsystems"
          items={fitting.subsystems.slots
            .filter((slot: any) => slot.module)
            .map((slot: any) => slot.module)}
          keyPrefix="subsystem"
          hasCharges={false}
        />
      )}

      {/* Service Slots */}
      {isStructure &&
        fitting?.serviceSlots &&
        fitting.serviceSlots.slots.some((slot: any) => slot.module) && (
          <FittingSection
            title="Service Slots"
            items={fitting.serviceSlots.slots
              .filter((slot: any) => slot.module)
              .map((slot: any) => slot.module)}
            keyPrefix="service"
            hasCharges={false}
          />
        )}

      {/* Implants (array version) */}
      {fitting?.implants && fitting.implants.length > 0 && (
        <FittingSection
          title="Implants"
          items={fitting.implants}
          keyPrefix="implant"
          hasCharges={false}
        />
      )}

      {/* Drone Bay */}
      {fitting?.droneBay && fitting.droneBay.length > 0 && (
        <FittingSection
          title="Drone Bay"
          items={fitting.droneBay}
          keyPrefix="drone"
          hasCharges={false}
        />
      )}

      {/* Implants (slot version) */}
      {fitting?.implants &&
        fitting.implants.slots &&
        fitting.implants.slots.some((slot: any) => slot.module) && (
          <FittingSection
            title="Implants"
            items={fitting.implants.slots
              .filter((slot: any) => slot.module)
              .map((slot: any) => slot.module)}
            keyPrefix="implant-slot"
            hasCharges={false}
          />
        )}

      {/* Cargo */}
      {fitting?.cargo && fitting.cargo.length > 0 && (
        <FittingSection
          title="Cargo"
          items={fitting.cargo}
          keyPrefix="cargo"
          hasCharges={false}
        />
      )}

      {/* Fuel Bay */}
      {fitting?.fuelBay && fitting.fuelBay.length > 0 && (
        <FittingSection
          title="Fuel Bay"
          items={fitting.fuelBay}
          keyPrefix="fuel-bay"
          hasCharges={false}
        />
      )}

      {/* Mining Hold */}
      {fitting?.oreHold && fitting.oreHold.length > 0 && (
        <FittingSection
          title="Mining Hold"
          items={fitting.oreHold}
          keyPrefix="ore-hold"
          hasCharges={false}
        />
      )}

      {/* Fleet Hangar */}
      {fitting?.fleetHangar && fitting.fleetHangar.length > 0 && (
        <FittingSection
          title="Fleet Hangar"
          items={fitting.fleetHangar}
          keyPrefix="fleet-hangar"
          hasCharges={false}
        />
      )}

      {/* Infrastructure Hangar */}
      {fitting?.infrastructureHangar &&
        fitting.infrastructureHangar.length > 0 && (
          <FittingSection
            title="Infrastructure Hangar"
            items={fitting.infrastructureHangar}
            keyPrefix="infrastructure-hangar"
            hasCharges={false}
          />
        )}

      {/* Gas Hold */}
      {fitting?.gasHold && fitting.gasHold.length > 0 && (
        <FittingSection
          title="Gas Hold"
          items={fitting.gasHold}
          keyPrefix="gas-hold"
          hasCharges={false}
        />
      )}

      {/* Mineral Hold */}
      {fitting?.mineralHold && fitting.mineralHold.length > 0 && (
        <FittingSection
          title="Mineral Hold"
          items={fitting.mineralHold}
          keyPrefix="mineral-hold"
          hasCharges={false}
        />
      )}

      {/* Salvage Hold */}
      {fitting?.salvageHold && fitting.salvageHold.length > 0 && (
        <FittingSection
          title="Salvage Hold"
          items={fitting.salvageHold}
          keyPrefix="salvage-hold"
          hasCharges={false}
        />
      )}

      {/* Planetary Commodities Hold */}
      {fitting?.planetaryCommoditiesHold &&
        fitting.planetaryCommoditiesHold.length > 0 && (
          <FittingSection
            title="Planetary Commodities Hold"
            items={fitting.planetaryCommoditiesHold}
            keyPrefix="planetary-commodities"
            hasCharges={false}
          />
        )}

      {/* Ice Hold */}
      {fitting?.iceHold && fitting.iceHold.length > 0 && (
        <FittingSection
          title="Ice Hold"
          items={fitting.iceHold}
          keyPrefix="ice-hold"
          hasCharges={false}
        />
      )}

      {/* Infrastructure Hold */}
      {fitting?.infrastructureHold && fitting.infrastructureHold.length > 0 && (
        <FittingSection
          title="Infrastructure Hold"
          items={fitting.infrastructureHold}
          keyPrefix="infrastructure-hold"
          hasCharges={false}
        />
      )}

      {/* Fighter Bay */}
      {fitting?.fighterBay && fitting.fighterBay.length > 0 && (
        <FittingSection
          title="Fighter Bay"
          items={fitting.fighterBay}
          keyPrefix="fighter"
          hasCharges={false}
        />
      )}

      {/* Structure Fuel */}
      {isStructure &&
        fitting?.structureFuel &&
        fitting.structureFuel.length > 0 && (
          <FittingSection
            title="Structure Fuel"
            items={fitting.structureFuel}
            keyPrefix="fuel"
            hasCharges={false}
          />
        )}

      {/* Core Room */}
      {isStructure && fitting?.coreRoom && fitting.coreRoom.length > 0 && (
        <FittingSection
          title="Core Room"
          items={fitting.coreRoom}
          keyPrefix="core"
          hasCharges={false}
        />
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
