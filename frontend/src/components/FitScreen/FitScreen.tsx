import Tooltip from "@/components/Tooltip/Tooltip";
import {
  FLAG_CATEGORIES,
  getFlagSlotIndex,
  groupItemsBySlot,
} from "@/utils/inventory-flags";
import { filterModulesOnly } from "../../../../backend/src/utils/item-classifier";

interface DogmaAttribute {
  attribute_id: number;
  value: number;
  attribute: {
    id: number;
    name: string;
  };
}

interface KillmailItem {
  flag: number;
  quantityDropped?: number | null;
  quantityDestroyed?: number | null;
  itemType: {
    id: number;
    name: string;
  };
  charge?: {
    flag: number;
    quantityDropped?: number | null;
    quantityDestroyed?: number | null;
    itemType: {
      id: number;
      name: string;
    };
  } | null;
}

interface FitScreenProps {
  shipType: any;
  dogmaAttributes?: DogmaAttribute[];
  items?: KillmailItem[];
}

export default function FitScreen({
  shipType,
  dogmaAttributes = [],
  items = [],
}: FitScreenProps) {
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

  // Charge'ları filtrele - sadece modülleri al
  const modulesOnly = filterModulesOnly<KillmailItem>(items);

  // Items'ı slot kategorilerine göre grupla
  const groupedItems = groupItemsBySlot<KillmailItem>(modulesOnly);

  return (
    <div className="flex-1 p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Ship Image */}
        <div className="relative flex items-center justify-center">
          <img
            src={`https://images.evetech.net/types/${shipType?.id}/render?size=512`}
            alt={shipType?.name || "Ship"}
            className="object-contain w-64 h-64 drop-shadow-2xl"
            loading="lazy"
          />
        </div>

        {/* Vertical Slot Layout */}
        <SlotGroup
          slots={hiSlots}
          modules={groupedItems.high}
          label="High"
          category={FLAG_CATEGORIES.high}
        />

        <SlotGroup
          slots={medSlots}
          modules={groupedItems.mid}
          label="Mid"
          category={FLAG_CATEGORIES.mid}
        />

        <SlotGroup
          slots={lowSlots}
          modules={groupedItems.low}
          label="Low"
          category={FLAG_CATEGORIES.low}
        />

        <SlotGroup
          slots={rigSlots}
          modules={groupedItems.rig}
          label="Rig"
          category={FLAG_CATEGORIES.rig}
        />

        {groupedItems.subsystem.length > 0 && (
          <SlotGroup
            slots={4}
            modules={groupedItems.subsystem}
            label="Subsystem"
            category={FLAG_CATEGORIES.subsystem}
          />
        )}
      </div>

      {/* Cargo & Drones */}
      {(groupedItems.cargo.length > 0 || groupedItems.droneBay.length > 0) && (
        <div className="grid max-w-3xl grid-cols-2 gap-4 mx-auto mt-6">
          {groupedItems.cargo.length > 0 && (
            <CargoSection items={groupedItems.cargo} label="Cargo Hold" />
          )}
          {groupedItems.droneBay.length > 0 && (
            <CargoSection items={groupedItems.droneBay} label="Drone Bay" />
          )}
        </div>
      )}

      {hiSlots === 0 && medSlots === 0 && lowSlots === 0 && rigSlots === 0 && (
        <p className="mt-4 text-sm text-center text-gray-500">
          No slot data available
        </p>
      )}
    </div>
  );
}

// Slot Group Component
interface SlotGroupProps {
  slots: number;
  modules: KillmailItem[];
  label: string;
  category: { color: string; min: number };
}

function SlotGroup({ slots, modules, label, category }: SlotGroupProps) {
  if (slots === 0) return null;

  // Modülleri flag numarasına göre sırala ve slot pozisyonlarına yerleştir
  const slotModules: (KillmailItem | null)[] = Array(slots).fill(null);

  modules.forEach((module) => {
    const slotIndex = getFlagSlotIndex(module.flag);
    if (slotIndex !== null && slotIndex < slots) {
      slotModules[slotIndex] = module;
    }
  });

  return (
    <div>
      <h3 className="mb-3 text-xs font-bold tracking-wider text-gray-400 uppercase">
        {label}
      </h3>
      <div className="flex flex-wrap gap-2">
        {slotModules.map((module, index) => (
          <ModuleSlot
            key={index}
            module={module}
            color={category.color}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}

// Module Slot Component
interface ModuleSlotProps {
  module: KillmailItem | null;
  color: string;
  index: number;
}

function ModuleSlot({ module, color, index }: ModuleSlotProps) {
  const totalQuantity =
    (module?.quantityDropped || 0) + (module?.quantityDestroyed || 0);

  const chargeQuantity = module?.charge
    ? (module.charge.quantityDropped || 0) +
      (module.charge.quantityDestroyed || 0)
    : 0;

  if (!module) {
    // Boş slot
    return (
      <div className="flex flex-col gap-1">
        <div className="relative w-16 h-16 transition-colors border border-gray-800 bg-gray-900/30 hover:bg-gray-900/50">
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] text-gray-600 font-mono">{index}</span>
          </div>
        </div>
      </div>
    );
  }

  // Dolu slot - modül ikonu göster
  return (
    <div className="flex flex-col gap-1 items-center">
      {/* Module Icon */}
      <Tooltip content={module.itemType.name} position="top">
        <div className="relative w-16 h-16 overflow-hidden transition-transform border border-gray-800 cursor-pointer group">
          <img
            src={`https://images.evetech.net/types/${module.itemType.id}/icon?size=64`}
            alt={module.itemType.name}
            className="object-cover w-full h-full bg-gray-900"
            loading="lazy"
          />

          {/* Module quantity badge */}
          {totalQuantity > 1 && (
            <div className="absolute bottom-0 left-0 bg-black/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {totalQuantity}
            </div>
          )}
        </div>
      </Tooltip>

      {/* Charge Slot - Modülün altında ayrı slot */}
      {module.charge && (
        <Tooltip content={module.charge.itemType.name} position="top">
          <div className="relative w-16 h-16 overflow-hidden border border-gray-800 cursor-pointer transition-transform bg-gray-950">
            <img
              src={`https://images.evetech.net/types/${module.charge.itemType.id}/icon?size=64`}
              alt={module.charge.itemType.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {chargeQuantity > 1 && (
              <div className="absolute bottom-0 left-0 bg-black/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {chargeQuantity}
              </div>
            )}
          </div>
        </Tooltip>
      )}
    </div>
  );
}

// Cargo Section Component
interface CargoSectionProps {
  items: KillmailItem[];
  label: string;
}

function CargoSection({ items, label }: CargoSectionProps) {
  return (
    <div className="p-4 border rounded border-white/10 bg-gray-900/30">
      <h3 className="mb-3 text-xs font-bold tracking-wider text-gray-400 uppercase">
        {label}
      </h3>
      <div className="space-y-1 overflow-y-auto max-h-40">
        {items.map((item, index) => {
          const totalQuantity =
            (item.quantityDropped || 0) + (item.quantityDestroyed || 0);
          return (
            <div
              key={index}
              className="flex items-center gap-2 p-1 text-xs rounded hover:bg-white/5"
            >
              <img
                src={`https://images.evetech.net/types/${item.itemType.id}/icon?size=32`}
                alt={item.itemType.name}
                className="w-6 h-6"
                loading="lazy"
              />
              <span className="flex-1 text-gray-300 truncate">
                {item.itemType.name}
              </span>
              {totalQuantity > 1 && (
                <span className="text-gray-500">x{totalQuantity}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
