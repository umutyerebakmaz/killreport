import type { Fitting } from "@/generated/graphql";
import ImplantSlot from "./ImplantSlot";
import ServiceSlot from "./ServiceSlot";
import Slot from "./Slot";

interface FitScreenProps {
  shipType?: {
    id: number;
    name: string;
  };
  fitting?: Fitting | null;
}

export default function FitScreen({ shipType, fitting }: FitScreenProps) {
  const highs = fitting?.highSlots?.slots || [];
  const mids = fitting?.midSlots?.slots || [];
  const lows = fitting?.lowSlots?.slots || [];
  const rigs = fitting?.rigs.slots || [];
  const subs = fitting?.subsystems.slots || [];
  const services = fitting?.serviceSlots.slots || [];
  const implants = fitting?.implants?.slots || [];

  // DEBUG: Log implants datai
  console.log("🔍 FitScreen Debug:", {
    shipType: shipType?.name,
    implantsCount: implants.length,
    implantsTotalSlots: fitting?.implants?.totalSlots,
    implants: implants,
  });

  // Check if slot types should be rendered based on totalSlots
  const hasSubsystems = (fitting?.subsystems.totalSlots || 0) > 0;
  const hasServiceSlots = (fitting?.serviceSlots.totalSlots || 0) > 0;
  const hasFittingSlots =
    (fitting?.highSlots.totalSlots || 0) > 0 ||
    (fitting?.midSlots.totalSlots || 0) > 0 ||
    (fitting?.lowSlots.totalSlots || 0) > 0;
  const hasImplants = (fitting?.implants?.totalSlots || 0) > 0;

  return (
    <>
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
            {hasFittingSlots && (
              <>
                <Slot slotType="high" slots={highs} startAngle={-35.5} />
                <Slot slotType="mid" slots={mids} startAngle={60.5} />
                <Slot slotType="low" slots={lows} startAngle={155.5} />
                <Slot slotType="rig" slots={rigs} startAngle={237.5} />
                {hasSubsystems && (
                  <Slot slotType="sub" slots={subs} startAngle={270} />
                )}
                {hasServiceSlots && <ServiceSlot slots={services} />}
              </>
            )}
            {hasImplants && !hasFittingSlots && (
              <ImplantSlot slots={implants} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
