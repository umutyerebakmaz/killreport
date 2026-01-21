import Tooltip from "../Tooltip/Tooltip";

interface ServiceSlotProps {
  slots: any[];
}

export default function ServiceSlot({ slots }: ServiceSlotProps) {
  const slotIcon = `/icons/slot-service.png`;

  return (
    <div className="absolute flex items-center justify-center gap-2 -translate-x-1/2 -bottom-18 left-1/2">
      {slots.map((slot, index) => {
        const module = slot.module;

        return (
          <div key={`service-${slot.slotIndex}`}>
            {module ? (
              <Tooltip
                content={
                  module.charge
                    ? module.charge.itemType.name
                    : module.itemType.name
                }
              >
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
                  />
                </div>
              </Tooltip>
            ) : (
              <Tooltip content="Empty Service Slot">
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
                    src={slotIcon}
                    alt="Service Slot"
                    className="relative z-10 size-12"
                  />
                </div>
              </Tooltip>
            )}
          </div>
        );
      })}
    </div>
  );
}
