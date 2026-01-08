interface DogmaAttribute {
  attribute_id: number;
  value: number;
  attribute: {
    id: number;
    name: string;
  };
}

interface FitScreenProps {
  dogmaAttributes?: DogmaAttribute[];
}

export default function FitScreen({ dogmaAttributes = [] }: FitScreenProps) {
  // dogmaAttributes'tan slot sayılarını al
  const getSlotCount = (attributeName: string): number => {
    const attr = dogmaAttributes.find(
      (a) => a.attribute.name === attributeName
    );
    return attr ? Math.floor(attr.value) : 0;
  };

  const hiSlots = getSlotCount("hiSlots");
  const medSlots = getSlotCount("medSlots");
  const lowSlots = getSlotCount("loSlots");
  const rigSlots = getSlotCount("rigSlots");

  // Slot karelerini oluştur
  const renderSlots = (count: number, label: string, color: string) => {
    if (count === 0) return null;

    return (
      <div className="mb-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-400">{label}</h3>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: count }).map((_, index) => (
            <div
              key={index}
              className={`w-12 h-12 border ${color} flex items-center justify-center text-xs text-gray-500`}
            >
              {index + 1}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 p-4 border bg-white/5 border-white/10">
      <h2 className="mb-4 text-lg font-bold text-white">Ship Fitting</h2>
      {renderSlots(hiSlots, "High Slots", "border-red-500/50")}
      {renderSlots(medSlots, "Med Slots", "border-yellow-500/50")}
      {renderSlots(lowSlots, "Low Slots", "border-green-500/50")}
      {renderSlots(rigSlots, "Rig Slots", "border-blue-500/50")}
      {hiSlots === 0 && medSlots === 0 && lowSlots === 0 && rigSlots === 0 && (
        <p className="text-sm text-gray-500">No slot data available</p>
      )}
    </div>
  );
}
