import { isBlueprint } from '@/utils/itemType';
import Tooltip from '../Tooltip/Tooltip';
import EveImage from '../ui/EveImage';

interface ServiceSlotProps {
  slots: any[];
}

export default function ServiceSlot({ slots }: ServiceSlotProps) {
  return (
    <div className="absolute -bottom-21 left-1/2 -translate-x-1/2 flex items-center justify-center gap-0.5">
      {slots.map((slot) => {
        const module = slot.module;
        const slotNumber = slot.slotIndex + 1;

        return (
          <div key={`service-${slot.slotIndex}`}>
            {module ? (
              <Tooltip content={module.itemType.name}>
                <div className="relative overflow-visible size-16">
                  {/* Ring background */}
                  <div className="absolute inset-0 overflow-visible border border-white/10 size-16 bg-white/5"></div>
                  <EveImage
                    kind="type"
                    id={module.itemType.id}
                    name={module.itemType.name}
                    size={64}
                    singleton={module.singleton}
                    blueprint={isBlueprint(module.itemType)}
                    className="relative z-10 size-16"
                  />
                </div>
              </Tooltip>
            ) : (
              <Tooltip content={`Empty Service Slot ${slotNumber}`}>
                <div className="relative flex items-center justify-center overflow-visible text-xl text-ink-muted border size-16 bg-white/5 border-white/10">
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
