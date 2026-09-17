import { isBlueprint } from '@/utils/itemType';
import Tooltip from '../Tooltip/Tooltip';
import EveImage from '../ui/EveImage';

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
  translateX = -32,
  translateY = -294,
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

        const name = module?.charge
          ? module.charge.itemType.name
          : module?.itemType.name;

        const id = module?.charge
          ? module.charge.itemType.id
          : module?.itemType.id;

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
                  <>
                    {/* top div */}
                    <Tooltip content={name}>
                      <div className="border shrink-0 border-white/10 bg-white/5">
                        <EveImage
                          kind="type"
                          id={
                            module?.charge
                              ? module.charge.itemType.id
                              : module.itemType.id
                          }
                          name={name}
                          size={48}
                          singleton={
                            module?.charge
                              ? module.charge.singleton
                              : module.singleton
                          }
                          blueprint={isBlueprint(
                            module?.charge
                              ? module.charge.itemType
                              : module.itemType,
                          )}
                          className="z-10 size-12"
                          style={{ transform: `rotate(${-rotation}deg)` }}
                        />
                      </div>
                    </Tooltip>

                    {/* bottom div */}
                    {module.charge && (
                      <Tooltip content={module.itemType.name}>
                        <div className="border border-white/10 bg-white/5">
                          <EveImage
                            kind="type"
                            id={module.itemType.id}
                            name={module.itemType.name}
                            size={48}
                            singleton={module.singleton}
                            blueprint={isBlueprint(module.itemType)}
                            className="size-12"
                            style={{ transform: `rotate(${-rotation}deg)` }}
                          />
                        </div>
                      </Tooltip>
                    )}
                  </>
                ) : (
                  <>
                    {/* top div empty  */}
                    <Tooltip content={`Empty ${slotTypeName} Slot`}>
                      <div className="w-12 h-12 shrink-0">
                        <div className="border border-white/10 bg-white/5">
                          <img
                            src={slotIcon}
                            alt={`${slotTypeName} Slot`}
                            className="z-10 w-12 h-12"
                          />
                        </div>
                      </div>
                    </Tooltip>
                    {/* bottom div empty */}
                    <div className="w-12 h-12 shrink-0"></div>
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
