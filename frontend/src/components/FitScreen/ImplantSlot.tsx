import Tooltip from "../Tooltip/Tooltip";

interface ImplantSlotProps {
  slots: any[];
}

export default function ImplantSlot({ slots }: ImplantSlotProps) {
  return (
    <div className="absolute flex items-center justify-center gap-2 -translate-x-1/2 -bottom-1 left-1/2">
      {slots.map((slot) => {
        const module = slot.module;
        const slotNumber = slot.slotIndex + 1; // slotIndex is 0-based, display as 1-10

        return (
          <div key={`implant-${slot.slotIndex}`}>
            {module ? (
              <Tooltip content={module.itemType.name}>
                <div className="relative overflow-visible size-12">
                  {/* Ring background */}
                  <div className="absolute inset-0 overflow-visible border border-white/10 size-12 bg-white/5"></div>
                  <img
                    src={`https://images.evetech.net/types/${module.itemType.id}/icon?size=64`}
                    alt={module.itemType.name}
                    className="relative z-10 size-12"
                  />
                </div>
              </Tooltip>
            ) : (
              <Tooltip content={`Empty Implant Slot ${slotNumber}`}>
                <div className="relative flex items-center justify-center px-2 overflow-visible text-lg text-gray-500 border size-12 bg-white/5 border-white/10">
                  {slotNumber}
                </div>
              </Tooltip>
            )}
          </div>
        );
      })}
    </div>
  );
}
