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

interface SlotCategory {
  slots: FittingSlot[] | FittingModule[];
  startAngle: number;
  radius: number;
}

// ============================================================================
// MAIN COMPONENT - PURE CSS RADIAL POSITIONING
// ============================================================================

export default function FitScreen({ shipType, fitting }: FitScreenProps) {
  // Content check
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

  // Slot categories
  const slotCategories = useMemo((): Record<string, SlotCategory> => {
    if (!fitting) return {};

    const degreesPerSlot = 11.25;
    const gapBetweenRigAndSubsystem = (degreesPerSlot / 2) * 3;

    // Helper: totalSlots sayısı kadar slot oluştur, gelen modülleri slotIndex'e göre yerleştir
    const createSlotArray = (
      totalSlots: number,
      slots: FittingSlot[]
    ): FittingSlot[] => {
      const result: FittingSlot[] = [];
      for (let i = 0; i < totalSlots; i++) {
        const existingSlot = slots.find((s) => s.slotIndex === i);
        result.push(existingSlot || { slotIndex: i, module: null });
      }
      return result;
    };

    return {
      high: {
        slots: createSlotArray(
          fitting.highSlots.totalSlots,
          fitting.highSlots.slots
        ),
        startAngle: -135,
        radius: 230,
      },
      mid: {
        slots: createSlotArray(
          fitting.midSlots.totalSlots,
          fitting.midSlots.slots
        ),
        startAngle: -45,
        radius: 230,
      },
      low: {
        slots: createSlotArray(
          fitting.lowSlots.totalSlots,
          fitting.lowSlots.slots
        ),
        startAngle: 45,
        radius: 230,
      },
      rig: {
        slots: fitting.rigs.modules,
        startAngle: 135,
        radius: 230,
      },
      subsystem: {
        slots: fitting.subsystems || [],
        startAngle: 135 + 3 * degreesPerSlot + gapBetweenRigAndSubsystem,
        radius: 230,
      },
    };
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
    <div className="flex flex-col items-center justify-center w-full gap-8 p-4">
      {/* ================================================================
           RADIAL CONTAINER: Pure CSS transform positioning
           ================================================================ */}
      <div className="relative" style={{ width: "600px", height: "600px" }}>
        {/* Center ship image */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative" style={{ width: "300px", height: "300px" }}>
            {shipType && (
              <img
                src={`https://images.evetech.net/types/${shipType.id}/render?size=512`}
                alt={shipType.name}
                className="object-cover w-full h-full rounded-full"
              />
            )}
          </div>
        </div>

        {/* ================================================================
            RADIAL SLOTS: CSS Transform ile pozisyonlama

            Nasıl Çalışır:
            1. absolute + top-1/2 + left-1/2 → Merkeze yerleştir
            2. translate(-50%, -50%) → Kendi merkezini container merkezine al
            3. rotate(angle) → İstediğin açıya döndür
            4. translateX(radius) → Merkezden uzağa kaydır
            5. rotate(-angle) → Geri döndür (içerik düz kalsın)
             ================================================================ */}
        {Object.entries(slotCategories).map(([category, config]) => {
          console.log(`${category} slots:`, config.slots.length, config.slots);
          return (
            <div key={category}>
              {config.slots.map((slot, index) => {
                const module: FittingModule | null =
                  "module" in slot
                    ? slot.module ?? null
                    : (slot as FittingModule);

                const slotId = `${category}-${index}`;
                const angleStep = 11.25;
                const angle = config.startAngle + index * angleStep;

                // Container yüksekliği: charge varsa 2 icon + gap, yoksa 1 icon
                const hasCharge = module?.charge;
                const containerHeight = hasCharge ? 104 : 48; // 48 + 8gap + 48

                // Açıya göre offset hesapla:
                // -90° (üst) → negatif offset (yukarı kaydır)
                // 0° (sağ) → offset yok
                // 90° (alt) → pozitif offset (aşağı kaydır)
                const angleRad = (angle * Math.PI) / 180;
                const verticalOffset =
                  Math.sin(angleRad) * (containerHeight / 2);

                return (
                  <div
                    key={slotId}
                    className="absolute top-1/2 left-1/2"
                    style={{
                      transform: `translate(-50%, calc(-50% + ${verticalOffset}px)) rotate(${angle}deg) translateX(${config.radius}px) rotate(-${angle}deg)`,
                    }}
                  >
                    {/* Flex container: Module ve Charge alt alta */}
                    <div className="flex flex-col items-center gap-2">
                      {module ? (
                        <>
                          {/* Module (üstte) */}
                          <Tooltip
                            content={module.itemType.name}
                            position="top"
                          >
                            <div className="w-12 h-12">
                              <img
                                src={`https://images.evetech.net/types/${module.itemType.id}/icon?size=64`}
                                alt={module.itemType.name}
                                width="48"
                                height="48"
                                className="rounded"
                              />
                            </div>
                          </Tooltip>

                          {/* Charge (altta) */}
                          {module.charge && (
                            <Tooltip
                              content={module.charge.itemType.name}
                              position="top"
                            >
                              <div className="w-12 h-12">
                                <img
                                  src={`https://images.evetech.net/types/${module.charge.itemType.id}/icon?size=64`}
                                  alt={module.charge.itemType.name}
                                  width="48"
                                  height="48"
                                  className="transition-all rounded"
                                />
                              </div>
                            </Tooltip>
                          )}
                        </>
                      ) : (
                        // Empty slot
                        <div className="flex items-center justify-center w-12 h-12 border border-gray-700 rounded bg-gray-800/30">
                          <div className="text-sm font-bold text-white/40">
                            {index + 1}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
