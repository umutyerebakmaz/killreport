import Tooltip from "@/components/Tooltip/Tooltip";
import type { Fitting, FittingModule, FittingSlot } from "@/generated/graphql";
import { useMemo } from "react";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface FitScreenProps {
  shipType?: {
    id: number;
    name: string;
  };
  fitting?: Fitting | null;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function FitScreen({ shipType, fitting }: FitScreenProps) {
  // Memoize hasContent check
  const hasContent = useMemo(() => {
    if (!fitting) return false;
    return (
      fitting.highSlots.slots.length > 0 ||
      fitting.midSlots.slots.length > 0 ||
      fitting.lowSlots.slots.length > 0 ||
      fitting.rigs.modules.length > 0 ||
      fitting.subsystems.length > 0
    );
  }, [fitting]);

  const hasInventory = useMemo(() => {
    if (!fitting) return false;
    return (
      fitting.cargo.length > 0 ||
      fitting.droneBay.length > 0 ||
      fitting.fighterBay.length > 0
    );
  }, [fitting]);

  if (!fitting || !hasContent) {
    return (
      <div className="flex p-4">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm text-gray-500">No fitting data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex p-4">
      {/* Main Fitting Section */}
      <div className="flex flex-col items-start">
        <div className="flex flex-col gap-6">
          {/* Module Slots - Vertical Layout */}
          {fitting.highSlots.slots.length > 0 && (
            <SlotGroup
              slots={fitting.highSlots.slots}
              label={`High Slots (${fitting.highSlots.totalSlots})`}
            />
          )}

          {fitting.midSlots.slots.length > 0 && (
            <SlotGroup
              slots={fitting.midSlots.slots}
              label={`Mid Slots (${fitting.midSlots.totalSlots})`}
            />
          )}

          {fitting.lowSlots.slots.length > 0 && (
            <SlotGroup
              slots={fitting.lowSlots.slots}
              label={`Low Slots (${fitting.lowSlots.totalSlots})`}
            />
          )}
        </div>

        <div className="flex flex-col gap-6 mt-6">
          {/* Rigs */}
          {fitting.rigs.modules.length > 0 && (
            <ModuleGroup
              modules={fitting.rigs.modules}
              label={`Rigs (${fitting.rigs.totalSlots})`}
            />
          )}

          {/* Subsystems (T3 Cruisers) */}
          {fitting.subsystems.length > 0 && (
            <ModuleGroup modules={fitting.subsystems} label="Subsystems" />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

// Slot Group - For High/Mid/Low slots with organized FittingSlot[]
interface SlotGroupProps {
  slots: FittingSlot[];
  label: string;
}

function SlotGroup({ slots, label }: SlotGroupProps) {
  if (slots.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold tracking-wider text-gray-400 uppercase">
        {label}
      </h3>
      <div className="flex flex-wrap gap-2">
        {slots.map((slot) => (
          <ModuleSlot
            key={slot.slotIndex}
            module={slot.module}
            slotIndex={slot.slotIndex}
          />
        ))}
      </div>
    </div>
  );
}

// Module Group - For Rigs/Subsystems (no empty slots, no slot indexing needed)
interface ModuleGroupProps {
  modules: FittingModule[];
  label: string;
}

function ModuleGroup({ modules, label }: ModuleGroupProps) {
  if (modules.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold tracking-wider text-gray-400 uppercase">
        {label}
      </h3>
      <div className="flex flex-wrap gap-2">
        {modules.map((module, index) => (
          <ModuleSlot
            key={`${label}-${index}`}
            module={module}
            slotIndex={index + 1}
            hideEmptySlot
          />
        ))}
      </div>
    </div>
  );
}

// Module Slot Component - Unified for all slot types
interface ModuleSlotProps {
  module?: FittingModule | null;
  slotIndex: number;
  hideEmptySlot?: boolean;
}

function ModuleSlot({
  module,
  slotIndex,
  hideEmptySlot = false,
}: ModuleSlotProps) {
  // Empty slot
  if (!module) {
    if (hideEmptySlot) return null;

    return (
      <div className="flex flex-col gap-1">
        <div className="relative w-16 h-16 transition-colors border border-white/10">
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-base text-gray-600">
              {slotIndex + 1}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const totalQuantity = useMemo(
    () => (module.quantityDropped || 0) + (module.quantityDestroyed || 0),
    [module.quantityDropped, module.quantityDestroyed]
  );

  const chargeQuantity = useMemo(() => {
    if (!module.charge) return 0;
    return (
      (module.charge.quantityDropped || 0) +
      (module.charge.quantityDestroyed || 0)
    );
  }, [module.charge]);

  // Determine border color based on item state
  const borderColor = useMemo(() => {
    if (module.quantityDestroyed && module.quantityDestroyed > 0) {
      return "border-red-500";
    }
    if (module.quantityDropped && module.quantityDropped > 0) {
      return "border-green-500";
    }
    return "border-white/10";
  }, [module.quantityDestroyed, module.quantityDropped]);

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Charge Icon */}
      {module.charge && (
        <Tooltip content={module.charge.itemType.name} position="top">
          <div
            className={`relative w-16 h-16 overflow-hidden transition-all border cursor-pointer hover:scale-105 ${borderColor}`}
          >
            <img
              src={`https://images.evetech.net/types/${module.charge.itemType.id}/icon?size=64`}
              alt={module.charge.itemType.name}
              className="object-cover w-full h-full"
              loading="lazy"
            />
            {chargeQuantity > 1 && (
              <div className="absolute bottom-0 left-0 bg-black/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {chargeQuantity}
              </div>
            )}
          </div>
        </Tooltip>
      )}

      {/* Module Icon */}
      <Tooltip content={module.itemType.name} position="bottom">
        <div
          className={`relative w-16 h-16 overflow-hidden transition-all border cursor-pointer group hover:scale-105 ${borderColor}`}
        >
          <img
            src={`https://images.evetech.net/types/${module.itemType.id}/icon?size=64`}
            alt={module.itemType.name}
            className="object-cover w-full h-full"
            loading="lazy"
          />

          {/* Quantity Badge */}
          {totalQuantity > 1 && (
            <div className="absolute bottom-0 left-0 bg-black/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {totalQuantity}
            </div>
          )}
        </div>
      </Tooltip>
    </div>
  );
}

// Inventory Section - For Cargo/Drones/Fighters
interface InventorySectionProps {
  items: FittingModule[];
  label: string;
}

function InventorySection({ items, label }: InventorySectionProps) {
  return (
    <div className="p-4 border border-white/10">
      <h4 className="mb-3 text-xs font-bold tracking-wider text-gray-400 uppercase">
        {label} ({items.length})
      </h4>
      <div className="space-y-1 overflow-y-auto max-h-48">
        {items.map((item, index) => {
          const totalQuantity =
            (item.quantityDropped || 0) + (item.quantityDestroyed || 0);

          return (
            <Tooltip key={index} content={item.itemType.name} position="right">
              <div className="flex items-center gap-2 p-2 text-xs transition-colors hover:bg-white/5">
                <img
                  src={`https://images.evetech.net/types/${item.itemType.id}/icon?size=32`}
                  alt={item.itemType.name}
                  className="w-8 h-8"
                  loading="lazy"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-gray-300 truncate">
                    {item.itemType.name}
                  </div>
                  {item.itemType.group && (
                    <div className="text-[10px] text-gray-500 truncate">
                      {item.itemType.group.name}
                    </div>
                  )}
                </div>
                {totalQuantity > 1 && (
                  <span className="px-2 py-1 text-[10px] font-bold text-white">
                    ×{totalQuantity}
                  </span>
                )}
              </div>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
