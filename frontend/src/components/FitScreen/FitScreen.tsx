import type { Fitting } from "@/generated/graphql";
interface FitScreenProps {
  shipType?: {
    id: number;
    name: string;
  };
  fitting?: Fitting | null;
}

export default function FitScreen({ shipType, fitting }: FitScreenProps) {
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
      </div>
    </div>
  );
}
