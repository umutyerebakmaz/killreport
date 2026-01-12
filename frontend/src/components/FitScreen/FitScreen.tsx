import Tooltip from "@/components/Tooltip/Tooltip";
import type { Fitting, FittingModule, FittingSlot } from "@/generated/graphql";
import { useMemo, useState } from "react";

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

interface SlotCategory {
  label: string;
  color: string;
  slots: FittingSlot[] | FittingModule[];
  startAngle: number;
  endAngle: number;
  radius: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function FitScreen({ shipType, fitting }: FitScreenProps) {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);

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

  // Slot kategorilerini fitting datasından oluştur
  const slotCategories = useMemo((): Record<string, SlotCategory> => {
    if (!fitting) return {};

    // Her kategori 90 derece alacak (360/4 = 90)
    // Her slotta 90/8 = 11.25 derece gap
    const degreesPerSlot = 11.25;
    const gapBetweenRigAndSubsystem = (degreesPerSlot / 2) * 3; // 3 yarım gap = ~17°

    return {
      high: {
        label: "High Slots",
        color: "#2C2C2C",
        slots: fitting.highSlots.slots,
        startAngle: -135, // Üst sol (12 saat - saat 10 arası)
        endAngle: -45, // Üst sağ
        radius: 230, // High slotlar için daha dış radius
      },
      mid: {
        label: "Mid Slots",
        color: "#3b82f6",
        slots: fitting.midSlots.slots,
        startAngle: -45, // Sağ üst (saat 2 - saat 4 arası)
        endAngle: 45, // Sağ alt
        radius: 230,
      },
      low: {
        label: "Low Slots",
        color: "#eab308",
        slots: fitting.lowSlots.slots,
        startAngle: 45, // Alt sağ (saat 4 - saat 8 arası)
        endAngle: 135, // Alt sol
        radius: 230,
      },
      rig: {
        label: "Rig Slots",
        color: "#8b5cf6",
        slots: fitting.rigs.modules,
        startAngle: 135, // Sol alt - rig için 3 slot max (3 * 11.25 = 33.75°)
        endAngle: 135 + 3 * degreesPerSlot, // ~168.75°
        radius: 230,
      },
      subsystem: {
        label: "Subsystems",
        color: "#10b981", // yeşil
        slots: fitting.subsystems || [],
        startAngle: 135 + 3 * degreesPerSlot + gapBetweenRigAndSubsystem, // Rigden sonra gap + başlangıç
        endAngle: 225, // Sol üst
        radius: 230,
      },
    };
  }, [fitting]);

  // Slot pozisyonunu hesapla
  const calculateSlotPosition = (
    category: string,
    index: number
  ): { x: number; y: number; angle: number } => {
    const config = slotCategories[category];
    if (!config) return { x: 300, y: 300, angle: 0 };

    let maxSlots: number;
    let angleStep: number;

    if (category === "rig") {
      // Rig için max 3 slot
      maxSlots = 3;
      angleStep = 11.25;
    } else if (category === "subsystem") {
      // Subsystem için max 4 slot
      maxSlots = 4;
      angleStep = 11.25;
    } else {
      // Diğer kategoriler için max 8 slot
      maxSlots = 8;
      angleStep = 11.25;
    }

    // Slotu ortala - ilk slot biraz içerden başlasın
    const offset = angleStep / 2;
    const angle =
      (config.startAngle + offset + index * angleStep) * (Math.PI / 180);

    return {
      x: 300 + Math.cos(angle) * config.radius,
      y: 300 + Math.sin(angle) * config.radius,
      angle: config.startAngle + offset + index * angleStep,
    };
  };

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
    <div className="flex flex-col items-center justify-center w-full gap-8 p-4">
      <div className="flex gap-8">
        {/* Main SVG Canvas */}
        <div className="relative">
          <svg width="600" height="600">
            {/* Background grid pattern */}
            <defs>
              <clipPath id="shipClip">
                <circle cx="300" cy="300" r="150" />
              </clipPath>
            </defs>

            {/* Orbital rings */}
            {[160, 210].map((r, i) => (
              <circle key={i} cx="300" cy="300" r={r} fill="#000" />
            ))}

            {/* Center ship container */}
            <g>
              {/* Ship image - cover style, clipped to circle */}
              {shipType && (
                <image
                  href={`https://images.evetech.net/types/${shipType.id}/render?size=512`}
                  x="150"
                  y="150"
                  width="300"
                  height="300"
                  clipPath="url(#shipClip)"
                  preserveAspectRatio="xMidYMid slice"
                />
              )}
            </g>

            {/* Render slots for each category */}
            {Object.entries(slotCategories).map(([category, config]) => (
              <g key={category}>
                {config.slots.map((slot, index) => {
                  const pos = calculateSlotPosition(category, index);
                  const slotId = `${category}-${index}`;
                  const isSelected = selectedSlot === slotId;
                  const isHovered = hoveredSlot === slotId;

                  // FittingSlot veya FittingModule tipini kontrol et
                  const module: FittingModule | null =
                    "module" in slot
                      ? slot.module ?? null
                      : (slot as FittingModule);

                  return (
                    <g key={slotId}>
                      <foreignObject
                        x={pos.x - 24}
                        y={pos.y - 24}
                        width="48"
                        height="48"
                        style={{ overflow: "visible" }}
                      >
                        <Tooltip
                          content={
                            module
                              ? module.itemType.name
                              : `${config.label} - Slot ${index + 1}`
                          }
                          position={category === "high" ? "top" : "top"}
                        >
                          <div
                            className="flex flex-col items-center gap-0.5 cursor-pointer"
                            style={{ width: "48px", height: "48px" }}
                            onClick={() =>
                              setSelectedSlot(
                                slotId === selectedSlot ? null : slotId
                              )
                            }
                            onMouseEnter={() => setHoveredSlot(slotId)}
                            onMouseLeave={() => setHoveredSlot(null)}
                          >
                            {module ? (
                              <>
                                {/* Charge Icon (if exists) */}
                                {module.charge && (
                                  <img
                                    src={`https://images.evetech.net/types/${module.charge.itemType.id}/icon?size=64`}
                                    alt={module.charge.itemType.name}
                                    width="64"
                                    height="64"
                                    className="transition-all"
                                    title={module.charge.itemType.name}
                                  />
                                )}
                                {/* Module Icon */}
                                <img
                                  src={`https://images.evetech.net/types/${module.itemType.id}/icon?size=64`}
                                  alt={module.itemType.name}
                                  width="48"
                                  height="48"
                                  className="transition-all"
                                />
                              </>
                            ) : (
                              <div className="flex items-center justify-center w-full h-full">
                                <span className="text-sm font-bold text-white/40">
                                  {index + 1}
                                </span>
                              </div>
                            )}
                          </div>
                        </Tooltip>
                      </foreignObject>
                    </g>
                  );
                })}
              </g>
            ))}
          </svg>
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
            className={`relative w-16 h-16 overflow-hidden transition-all border cursor-pointer ${borderColor}`}
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
          className={`relative w-16 h-16 overflow-hidden transition-all border cursor-pointer group ${borderColor}`}
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
