import type { Fitting } from "@/generated/graphql";
import Slot from "./Slot";

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
  const serviceSlots = fitting?.serviceSlots.slots || [];

  // Check if slot types should be rendered based on totalSlots
  const hasSubsystems = (fitting?.subsystems.totalSlots || 0) > 0;
  const hasServiceSlots = (fitting?.serviceSlots.totalSlots || 0) > 0;

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
          <Slot slots={highSlots} startAngle={-35.5} />
          <Slot slots={midSlots} startAngle={60.5} />
          <Slot slots={lowSlots} startAngle={143.5} />
          <Slot slots={rigSlots} startAngle={233.5} />
          {hasSubsystems && <Slot slots={subSystems} startAngle={270} />}
          {hasServiceSlots && (
            <Slot slots={serviceSlots} startAngle={318} translateY={-242} />
          )}
        </div>
      </div>
    </div>
  );
}
