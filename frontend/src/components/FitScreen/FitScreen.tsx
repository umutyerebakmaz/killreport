import {
  FLAG_CATEGORIES,
  getFlagSlotIndex,
  groupItemsBySlot,
} from "@/utils/inventory-flags";
import { filterModulesOnly } from "@/utils/item-classifier";

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
      <div className="grid grid-cols-[180px_1fr_180px] gap-4 max-w-5xl mx-auto">
        {/* Left Column: Med & Low Slots */}
        <div className="space-y-6">
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
        </div>

        {/* Center: Ship Image & High Slots */}
        <div className="flex flex-col items-center space-y-6">
          <SlotGroup
            slots={hiSlots}
            modules={groupedItems.high}
            label="High"
            category={FLAG_CATEGORIES.high}
            horizontal
          />

          <div className="relative flex items-center justify-center flex-1">
            <img
              src={`https://images.evetech.net/types/${shipType?.id}/render?size=512`}
              alt={shipType?.name || "Ship"}
              className="object-contain w-64 h-64 drop-shadow-2xl"
              loading="lazy"
            />
          </div>
        </div>

        {/* Right Column: Rigs */}
        <div className="space-y-6">
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
              label="Sub"
              category={FLAG_CATEGORIES.subsystem}
            />
          )}
        </div>
      </div>

      {/* Cargo & Drones */}
      {(groupedItems.cargo.length > 0 || groupedItems.droneBay.length > 0) && (
        <div className="grid max-w-5xl grid-cols-2 gap-4 mx-auto mt-6">
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
  horizontal?: boolean;
}

function SlotGroup({
  slots,
  modules,
  label,
  category,
  horizontal,
}: SlotGroupProps) {
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
      <div
        className={
          horizontal
            ? "flex gap-2 justify-center flex-wrap"
            : "space-y-2 flex flex-col"
        }
      >
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
      <div
        className="relative w-16 h-16 transition-colors border rounded bg-gray-900/30 hover:bg-gray-900/50"
        style={{ borderColor: `${color}40` }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] text-gray-600 font-mono">{index}</span>
        </div>
      </div>
    );
  }

  // Dolu slot - modül ikonu göster
  return (
    <div
      className="relative w-16 h-16 overflow-hidden transition-transform border-2 rounded cursor-pointer group hover:scale-105"
      style={{ borderColor: color }}
      title={module.itemType.name}
    >
      <img
        src={`https://images.evetech.net/types/${module.itemType.id}/icon?size=64`}
        alt={module.itemType.name}
        className="object-cover w-full h-full bg-gray-900"
        loading="lazy"
      />

      {/* Charge indicator - sağ alt köşede küçük ikon */}
      {module.charge && (
        <div
          className="absolute -bottom-1.5 -right-1.5 w-8 h-8 border-2 rounded-md bg-gray-950 overflow-hidden shadow-lg ring-1 ring-black/50"
          style={{ borderColor: color }}
          title={`${module.charge.itemType.name} (${chargeQuantity})`}
        >
          <img
            src={`https://images.evetech.net/types/${module.charge.itemType.id}/icon?size=64`}
            alt={module.charge.itemType.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {chargeQuantity > 1 && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black to-transparent px-0.5 pt-2 pb-0.5 text-[9px] font-bold text-white text-center leading-none">
              {chargeQuantity}
            </div>
          )}
        </div>
      )}

      {/* Module quantity badge */}
      {totalQuantity > 1 && (
        <div className="absolute bottom-0 left-0 bg-black/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {totalQuantity}
        </div>
      )}

      {/* Destroyed/Dropped indicator */}
      {module.quantityDestroyed && module.quantityDestroyed > 0 && (
        <div className="absolute top-0 left-0 w-2 h-2 bg-red-500 rounded-br"></div>
      )}

      {/* Hover tooltip */}
      <div className="absolute inset-0 flex flex-col justify-center p-2 transition-opacity opacity-0 pointer-events-none bg-black/95 group-hover:opacity-100">
        <p className="text-[10px] font-semibold text-white leading-tight line-clamp-2 text-center">
          {module.itemType.name}
        </p>
        {totalQuantity > 1 && (
          <p className="text-[9px] text-gray-400 text-center mt-0.5">
            x{totalQuantity}
          </p>
        )}
        {module.charge && (
          <>
            <div className="w-full h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent my-1.5"></div>
            <div className="flex items-center justify-center gap-1">
              <img
                src={`https://images.evetech.net/types/${module.charge.itemType.id}/icon?size=32`}
                alt={module.charge.itemType.name}
                className="w-4 h-4"
                loading="lazy"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-semibold text-cyan-400 text-left leading-tight truncate">
                  {module.charge.itemType.name}
                </p>
                {chargeQuantity > 1 && (
                  <p className="text-[8px] text-gray-500 text-left leading-none mt-0.5">
                    Quantity: {chargeQuantity.toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
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
