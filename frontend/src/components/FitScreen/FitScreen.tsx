import type { Fitting } from "@/generated/graphql";
interface FitScreenProps {
  shipType?: {
    id: number;
    name: string;
  };
  fitting?: Fitting | null;
}

export default function FitScreen({ shipType, fitting }: FitScreenProps) {
  const highSlots = fitting?.highSlots?.slots || [];

  // Her slot için açı - manuel olarak ayarla
  const anglePerSlot = 17; // 30 derece aralıklarla (360/12 = 30)

  return (
    <div className="fit-screen-container">
      <div className="fitting">
        <div className="hull">
          {shipType && (
            <img
              src={`https://images.evetech.net/types/${shipType.id}/render?size=512`}
              alt={shipType.name}
              className="hull-image"
            />
          )}
        </div>
        <div className="slots">
          {/* High Slots */}
          {highSlots.map((slot, index) => {
            const rotation = index * anglePerSlot;
            const module = slot.module;

            return (
              <div
                key={`high-${slot.slotIndex}`}
                className="slot"
                style={{
                  transform: `rotate(${rotation}deg)`,
                }}
              >
                <div
                  className="slot-outer"
                  style={{
                    transform: `translateY(-307px) translateX(-32px)`,
                  }}
                >
                  <div className="slot-inner">
                    {module ? (
                      <>
                        {/* Charge Icon (if exists) */}
                        {module.charge && (
                          <img
                            src={`https://images.evetech.net/types/${module.charge.itemType.id}/icon?size=64`}
                            alt={module.charge.itemType.name}
                            className="w-12 h-12"
                            style={{ transform: `rotate(${-rotation}deg)` }}
                            title={module.charge.itemType.name}
                          />
                        )}
                        {/* Module Icon */}
                        <img
                          src={`https://images.evetech.net/types/${module.itemType.id}/icon?size=64`}
                          alt={module.itemType.name}
                          className="w-12 h-12"
                          style={{ transform: `rotate(${-rotation}deg)` }}
                          title={module.itemType.name}
                        />
                      </>
                    ) : (
                      <div className="text-xs text-gray-500">
                        H{slot.slotIndex}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
