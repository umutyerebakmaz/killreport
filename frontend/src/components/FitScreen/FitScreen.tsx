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
  const midSlots = fitting?.midSlots?.slots || [];
  const lowSlots = fitting?.lowSlots?.slots || [];
  const rigSlots = fitting?.rigs.slots || [];
  const subSystems = fitting?.subsystems.slots || [];

  // Her slot için açı - manuel olarak ayarla
  const anglePerSlot = 11.2; // Slot'lar arası açı
  const highStartAngle = -36.5; // Başlangıç açısı (0° = üst, 90° = sağ, 180° = alt, 270° = sol)
  const midStartAngle = 60.5; // Başlangıç açısı (0° = üst, 90° = sağ, 180° = alt, 270° = sol)
  const lowStartAngle = 143.5; // Başlangıç açısı (0° = üst, 90° = sağ, 180° = alt, 270° = sol)
  const rigStartAngle = 233.5; // Başlangıç açısı (0° = üst, 90° = sağ, 180° = alt, 270° = sol)
  const subSystemsStartAngle = 270; // Başlangıç açısı (0° = üst, 90° = sağ, 180° = alt, 270° = sol)

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
            const rotation = highStartAngle + index * anglePerSlot;
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
                        {/* Top div: Charge icon if exists, otherwise Module icon - ALWAYS with ring */}
                        <div className="relative overflow-visible size-12">
                          {/* Ring background - always show on top icon */}
                          <svg
                            className="absolute inset-0 overflow-visible size-12"
                            viewBox="-2 -2 52 52"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M0 0 L48 0 L39 48 L9 48 Z"
                              stroke="currentColor"
                              fill="none"
                              strokeWidth="2"
                              className="text-gray-500"
                            />
                          </svg>
                          <img
                            src={`https://images.evetech.net/types/${
                              module.charge
                                ? module.charge.itemType.id
                                : module.itemType.id
                            }/icon?size=64`}
                            alt={
                              module.charge
                                ? module.charge.itemType.name
                                : module.itemType.name
                            }
                            className="relative z-10 size-12"
                            style={{ transform: `rotate(${-rotation}deg)` }}
                            title={
                              module.charge
                                ? module.charge.itemType.name
                                : module.itemType.name
                            }
                          />
                        </div>
                        {/* Bottom div: Module icon only if charge exists (no ring) */}
                        <div className="relative size-12">
                          {module.charge && (
                            <img
                              src={`https://images.evetech.net/types/${module.itemType.id}/icon?size=64`}
                              alt={module.itemType.name}
                              className="relative z-10 size-12"
                              style={{ transform: `rotate(${-rotation}deg)` }}
                              title={module.itemType.name}
                            />
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Empty slot - also show ring */}
                        <div className="relative overflow-visible size-12">
                          {/* Ring background */}
                          <svg
                            className="absolute inset-0 overflow-visible size-12"
                            viewBox="-2 -2 52 52"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M0 0 L48 0 L39 48 L9 48 Z"
                              stroke="currentColor"
                              fill="none"
                              strokeWidth="2"
                              className="text-gray-500"
                            />
                          </svg>
                          <img
                            src="/icons/slot-high.png"
                            alt="High Slot"
                            className="relative z-10 size-12"
                            style={{ transform: `rotate(${-rotation}deg)` }}
                          />
                        </div>
                        <div className="size-12"></div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Mid Slots */}
          {midSlots.map((slot, index) => {
            const rotation = midStartAngle + index * anglePerSlot;
            const module = slot.module;

            return (
              <div
                key={`mid-${slot.slotIndex}`}
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
                        {/* Top div: Charge icon if exists, otherwise Module icon - ALWAYS with ring */}
                        <div className="relative overflow-visible size-12">
                          {/* Ring background - always show on top icon */}
                          <svg
                            className="absolute inset-0 overflow-visible size-12"
                            viewBox="-2 -2 52 52"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M0 0 L48 0 L39 48 L9 48 Z"
                              stroke="currentColor"
                              fill="none"
                              strokeWidth="2"
                              className="text-gray-500"
                            />
                          </svg>
                          <img
                            src={`https://images.evetech.net/types/${
                              module.charge
                                ? module.charge.itemType.id
                                : module.itemType.id
                            }/icon?size=64`}
                            alt={
                              module.charge
                                ? module.charge.itemType.name
                                : module.itemType.name
                            }
                            className="relative z-10 size-12"
                            style={{ transform: `rotate(${-rotation}deg)` }}
                            title={
                              module.charge
                                ? module.charge.itemType.name
                                : module.itemType.name
                            }
                          />
                        </div>
                        {/* Bottom div: Module icon only if charge exists (no ring) */}
                        <div className="relative size-12">
                          {module.charge && (
                            <img
                              src={`https://images.evetech.net/types/${module.itemType.id}/icon?size=64`}
                              alt={module.itemType.name}
                              className="relative z-10 size-12"
                              style={{ transform: `rotate(${-rotation}deg)` }}
                              title={module.itemType.name}
                            />
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Empty slot - also show ring */}
                        <div className="relative overflow-visible size-12">
                          {/* Ring background */}
                          <svg
                            className="absolute inset-0 overflow-visible size-12"
                            viewBox="-2 -2 52 52"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M0 0 L48 0 L39 48 L9 48 Z"
                              stroke="currentColor"
                              fill="none"
                              strokeWidth="2"
                              className="text-gray-500"
                            />
                          </svg>
                          <img
                            src="/icons/slot-mid.png"
                            alt="High Slot"
                            className="relative z-10 size-12"
                            style={{ transform: `rotate(${-rotation}deg)` }}
                          />
                        </div>
                        <div className="size-12"></div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Low Slots */}
          {lowSlots.map((slot, index) => {
            const rotation = lowStartAngle + index * anglePerSlot;
            const module = slot.module;

            return (
              <div
                key={`mid-${slot.slotIndex}`}
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
                        {/* Top div: Charge icon if exists, otherwise Module icon - ALWAYS with ring */}
                        <div className="relative overflow-visible size-12">
                          {/* Ring background - always show on top icon */}
                          <svg
                            className="absolute inset-0 overflow-visible size-12"
                            viewBox="-2 -2 52 52"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M0 0 L48 0 L39 48 L9 48 Z"
                              stroke="currentColor"
                              fill="none"
                              strokeWidth="2"
                              className="text-gray-500"
                            />
                          </svg>
                          <img
                            src={`https://images.evetech.net/types/${
                              module.charge
                                ? module.charge.itemType.id
                                : module.itemType.id
                            }/icon?size=64`}
                            alt={
                              module.charge
                                ? module.charge.itemType.name
                                : module.itemType.name
                            }
                            className="relative z-10 size-12"
                            style={{ transform: `rotate(${-rotation}deg)` }}
                            title={
                              module.charge
                                ? module.charge.itemType.name
                                : module.itemType.name
                            }
                          />
                        </div>
                        {/* Bottom div: Module icon only if charge exists (no ring) */}
                        <div className="relative size-12">
                          {module.charge && (
                            <img
                              src={`https://images.evetech.net/types/${module.itemType.id}/icon?size=64`}
                              alt={module.itemType.name}
                              className="relative z-10 size-12"
                              style={{ transform: `rotate(${-rotation}deg)` }}
                              title={module.itemType.name}
                            />
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Empty slot - also show ring */}
                        <div className="relative overflow-visible size-12">
                          {/* Ring background */}
                          <svg
                            className="absolute inset-0 overflow-visible size-12"
                            viewBox="-2 -2 52 52"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M0 0 L48 0 L39 48 L9 48 Z"
                              stroke="currentColor"
                              fill="none"
                              strokeWidth="2"
                              className="text-gray-500"
                            />
                          </svg>
                          <img
                            src="/icons/slot-low.png"
                            alt="High Slot"
                            className="relative z-10 size-12"
                            style={{ transform: `rotate(${-rotation}deg)` }}
                          />
                        </div>
                        <div className="size-12"></div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Rig Slots */}
          {rigSlots.map((slot, index) => {
            const rotation = rigStartAngle + index * anglePerSlot;
            const module = slot.module;

            return (
              <div
                key={`mid-${slot.slotIndex}`}
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
                        {/* Top div: Charge icon if exists, otherwise Module icon - ALWAYS with ring */}
                        <div className="relative overflow-visible size-12">
                          {/* Ring background - always show on top icon */}
                          <svg
                            className="absolute inset-0 overflow-visible size-12"
                            viewBox="-2 -2 52 52"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M0 0 L48 0 L39 48 L9 48 Z"
                              stroke="currentColor"
                              fill="none"
                              strokeWidth="2"
                              className="text-gray-500"
                            />
                          </svg>
                          <img
                            src={`https://images.evetech.net/types/${
                              module.charge
                                ? module.charge.itemType.id
                                : module.itemType.id
                            }/icon?size=64`}
                            alt={
                              module.charge
                                ? module.charge.itemType.name
                                : module.itemType.name
                            }
                            className="relative z-10 size-12"
                            style={{ transform: `rotate(${-rotation}deg)` }}
                            title={
                              module.charge
                                ? module.charge.itemType.name
                                : module.itemType.name
                            }
                          />
                        </div>
                        {/* Bottom div: Module icon only if charge exists (no ring) */}
                        <div className="relative size-12">
                          {module.charge && (
                            <img
                              src={`https://images.evetech.net/types/${module.itemType.id}/icon?size=64`}
                              alt={module.itemType.name}
                              className="relative z-10 size-12"
                              style={{ transform: `rotate(${-rotation}deg)` }}
                              title={module.itemType.name}
                            />
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Empty slot - also show ring */}
                        <div className="relative overflow-visible size-12">
                          {/* Ring background */}
                          <svg
                            className="absolute inset-0 overflow-visible size-12"
                            viewBox="-2 -2 52 52"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M0 0 L48 0 L39 48 L9 48 Z"
                              stroke="currentColor"
                              fill="none"
                              strokeWidth="2"
                              className="text-gray-500"
                            />
                          </svg>
                          <img
                            src="/icons/slot-rig.png"
                            alt="High Slot"
                            className="relative z-10 size-12"
                            style={{ transform: `rotate(${-rotation}deg)` }}
                          />
                        </div>
                        <div className="size-12"></div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {/* Subsystems */}
          {subSystems.map((slot, index) => {
            const rotation = subSystemsStartAngle + index * anglePerSlot;
            const module = slot.module;

            return (
              <div
                key={`sub-system-${slot.slotIndex}`}
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
                        {/* Top div: Charge icon if exists, otherwise Module icon - ALWAYS with ring */}
                        <div className="relative overflow-visible size-12">
                          {/* Ring background - always show on top icon */}
                          <svg
                            className="absolute inset-0 overflow-visible size-12"
                            viewBox="-2 -2 52 52"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M0 0 L48 0 L39 48 L9 48 Z"
                              stroke="currentColor"
                              fill="none"
                              strokeWidth="2"
                              className="text-gray-500"
                            />
                          </svg>
                          <img
                            src={`https://images.evetech.net/types/${
                              module.charge
                                ? module.charge.itemType.id
                                : module.itemType.id
                            }/icon?size=64`}
                            alt={
                              module.charge
                                ? module.charge.itemType.name
                                : module.itemType.name
                            }
                            className="relative z-10 size-12"
                            style={{ transform: `rotate(${-rotation}deg)` }}
                            title={
                              module.charge
                                ? module.charge.itemType.name
                                : module.itemType.name
                            }
                          />
                        </div>
                        {/* Bottom div: Module icon only if charge exists (no ring) */}
                        <div className="relative size-12">
                          {module.charge && (
                            <img
                              src={`https://images.evetech.net/types/${module.itemType.id}/icon?size=64`}
                              alt={module.itemType.name}
                              className="relative z-10 size-12"
                              style={{ transform: `rotate(${-rotation}deg)` }}
                              title={module.itemType.name}
                            />
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Empty slot - also show ring */}
                        <div className="relative overflow-visible size-12">
                          {/* Ring background */}
                          <svg
                            className="absolute inset-0 overflow-visible size-12"
                            viewBox="-2 -2 52 52"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M0 0 L48 0 L39 48 L9 48 Z"
                              stroke="currentColor"
                              fill="none"
                              strokeWidth="2"
                              className="text-gray-500"
                            />
                          </svg>
                        </div>
                        <div className="size-12"></div>
                      </>
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
