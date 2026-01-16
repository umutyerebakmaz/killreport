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
  slots: FittingSlot[] | FittingModule[];
  startAngle: number;
  radius: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function FitScreen({ shipType, fitting }: FitScreenProps) {
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
        slots: fitting.highSlots.slots,
        startAngle: -135, // Üst sol (12 saat - saat 10 arası)
        radius: 230, // High slotlar için daha dış radius
      },
      mid: {
        label: "Mid Slots",
        slots: fitting.midSlots.slots,
        startAngle: -45, // Sağ üst (saat 2 - saat 4 arası)
        radius: 230,
      },
      low: {
        label: "Low Slots",
        slots: fitting.lowSlots.slots,
        startAngle: 45, // Alt sağ (saat 4 - saat 8 arası)
        radius: 230,
      },
      rig: {
        label: "Rig Slots",
        slots: fitting.rigs.modules,
        startAngle: 135, // Sol alt - rig için 3 slot max (3 * 11.25 = 33.75°)
        radius: 230,
      },
      subsystem: {
        label: "Subsystems",
        slots: fitting.subsystems || [],
        startAngle: 135 + 3 * degreesPerSlot + gapBetweenRigAndSubsystem, // Rigden sonra gap + başlangıç
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

    const angleStep = 11.25;

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
      <div className="flex gap-8 p-12">
        {/* Main SVG Canvas */}
        <div className="relative">
          <svg width="600" height="600" style={{ overflow: "visible" }}>
            {/* Background grid pattern */}
            <defs>
              <clipPath id="shipClip">
                <circle cx="300" cy="300" r="150" />
              </clipPath>
            </defs>

            {/* bu cember slotlara denk gelmeli */}
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
                {config.slots
                  .map((slot, index) => ({ slot, index }))
                  .sort((a, b) => {
                    const aId = `${category}-${a.index}`;
                    const bId = `${category}-${b.index}`;
                    if (aId === hoveredSlot) return 1;
                    if (bId === hoveredSlot) return -1;
                    return 0;
                  })
                  .map(({ slot, index }) => {
                    const pos = calculateSlotPosition(category, index);
                    const slotId = `${category}-${index}`;

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
                            position="top"
                          >
                            <div
                              className="flex flex-col items-center gap-0.5"
                              style={{ width: "48px", height: "48px" }}
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
