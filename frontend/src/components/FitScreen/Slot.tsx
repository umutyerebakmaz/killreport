import Tooltip from "../Tooltip/Tooltip";

interface SlotProps {
  slots: any[];
  startAngle?: number;
  angleGap?: number;
  translateX?: number;
  translateY?: number;
  slotType?: "high" | "mid" | "low" | "rig" | "sub";
}

export default function Slot({
  slots,
  startAngle = 0,
  angleGap = 11.2,
  translateX = -32,
  translateY = -307,
  slotType = "high",
}: SlotProps) {
  const slotIcon = `/icons/slot-${slotType}.png`;
  const slotTypeName =
    slotType.charAt(0).toUpperCase() + slotType.slice(1).toLowerCase();

  return (
    <>
      {slots.map((slot, index) => {
        const rotation = startAngle + index * angleGap;
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
                transform: `translateY(${translateY}px) translateX(${translateX}px)`,
              }}
            >
              <div className="slot-inner">
                {module ? (
                  <>
                    {/* Top div: Charge icon if exists, otherwise Module icon - ALWAYS with ring */}
                    <Tooltip
                      content={
                        module.charge
                          ? module.charge.itemType.name
                          : module.itemType.name
                      }
                    >
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
                            strokeWidth="1"
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
                        />
                      </div>
                    </Tooltip>

                    {/* Bottom div: Module icon only if charge exists (no ring) */}
                    <div className="relative size-12">
                      {module.charge && (
                        <Tooltip content={module.itemType.name}>
                          <img
                            src={`https://images.evetech.net/types/${module.itemType.id}/icon?size=64`}
                            alt={module.itemType.name}
                            className="relative z-10 size-12"
                            style={{ transform: `rotate(${-rotation}deg)` }}
                          />
                        </Tooltip>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Empty slot - also show ring */}
                    <Tooltip content={`Empty ${slotTypeName} Slot`}>
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
                        <svg className="absolute inset-0 overflow-visible size-12" width="48" height="48" viewBox="0 0 500 500">
                          <g id="slot">
                            <path
                              d="M 243 46 A 210 210 0 0 1 279 46.7 L 276 84.7 A 172 172 0 0 0 246 84 L 243 46"
                              style={{
                                fillOpacity: 0.1,
                                strokeWidth: 1,
                                strokeOpacity: 0.5,
                              }}
                            ></path>
                          </g>
                        </svg>
                        <img
                          src={slotIcon}
                          alt={`${slotTypeName} Slot`}
                          className="relative z-10 size-12"
                        />
                      </div>
                    </Tooltip>
                    <div className="size-12"></div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
