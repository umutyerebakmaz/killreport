import { getItemImageUrl } from "@/utils/itemImageUrl";
import Tooltip from "../Tooltip/Tooltip";

interface ServiceSlotProps {
  slots: any[];
}

export default function ServiceSlot({ slots }: ServiceSlotProps) {
  return (
    <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex items-center justify-center gap-0.5">
      {slots.map((slot) => {
        const module = slot.module;
        const slotNumber = slot.slotIndex + 1;

        return (
          <div key={`service-${slot.slotIndex}`}>
            {module ? (
              <Tooltip content={module.itemType.name}>
                <div className="relative overflow-visible size-12">
                  {/* Ring background */}
                  <div className="absolute inset-0 overflow-visible border border-white/10 size-12 bg-white/5"></div>
                  <img
                    src={getItemImageUrl(module.itemType, module.singleton, 64)}
                    alt={module.itemType.name}
                    className="relative z-10 size-12"
                  />
                </div>
              </Tooltip>
            ) : (
              <Tooltip content={`Empty Service Slot ${slotNumber}`}>
                <div className="relative flex items-center justify-center overflow-visible text-lg text-gray-500 border size-12 bg-white/5 border-white/10">
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
