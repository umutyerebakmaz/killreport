import { isBlueprint } from '@/utils/itemType';
import Tooltip from '../Tooltip/Tooltip';
import EveImage from '../ui/EveImage';
import Image from 'next/image';

interface SlotProps {
  slots: any[];
  startAngle?: number;
  angleGap?: number;
  translateX?: number;
  translateY?: number;
  slotType?: 'high' | 'mid' | 'low' | 'rig' | 'sub' | 'implant';
}

export default function Slot({
  slots,
  startAngle = 0,
  angleGap = 11.5,
  translateX = -43,
  translateY = -392,
  slotType = 'high',
}: SlotProps) {
  const slotIcon = `/icons/slot-${slotType}.png`;
  const slotTypeName =
    slotType.charAt(0).toUpperCase() + slotType.slice(1).toLowerCase();

  return (
    <>
      {slots.map((slot, index) => {
        const rotation = startAngle + index * angleGap;
        const module = slot.module;

        // A loaded weapon (or a module holding a script) shows what is loaded;
        // the tooltip names the module first and the charge under it.
        const shown = module?.charge ?? module;

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
              <div className="gap-y-0.5 slot-inner">
                {/* if module exist */}
                {module ? (
                  <Tooltip
                    content={
                      // The inventory grid's tooltip type (FittingItem): one
                      // step up from tooltip.css, names bold. ink-muted rather
                      // than FittingItem's gray-100, which read too bright
                      // beside 64px icons.
                      <ul className="space-y-1 text-base">
                        {[module, module.charge].filter(Boolean).map((item) => (
                          <li
                            key={item.itemType.id}
                            className="flex items-center gap-2 font-bold text-ink-muted"
                          >
                            <EveImage
                              kind="type"
                              id={item.itemType.id}
                              name={item.itemType.name}
                              size={64}
                              singleton={item.singleton}
                              blueprint={isBlueprint(item.itemType)}
                              className="size-16"
                            />
                            {item.itemType.name}
                          </li>
                        ))}
                      </ul>
                    }
                  >
                    <div className="border shrink-0 border-white/10 bg-white/5">
                      <EveImage
                        kind="type"
                        id={shown.itemType.id}
                        name={shown.itemType.name}
                        size={64}
                        singleton={shown.singleton}
                        blueprint={isBlueprint(shown.itemType)}
                        className="z-10 size-16"
                        style={{ transform: `rotate(${-rotation}deg)` }}
                      />
                    </div>
                  </Tooltip>
                ) : (
                  <Tooltip content={`Empty ${slotTypeName} Slot`}>
                    <div className="w-16 h-16 shrink-0">
                      <div className="border border-white/10 bg-white/5">
                        <Image
                          src={slotIcon}
                          alt={`${slotTypeName} Slot`}
                          width={64}
                          height={64}
                          className="z-10 w-16 h-16"
                          unoptimized
                        />
                      </div>
                    </div>
                  </Tooltip>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
