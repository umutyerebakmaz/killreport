import { formatISK } from "@/utils/formatISK";
import {
  getItemImageUrl,
  getItemName,
  isBlueprint,
} from "@/utils/itemImageUrl";

interface FittingItemProps {
  item: {
    itemType: any;
    singleton: number;
    quantityDestroyed: number;
    quantityDropped: number;
  };
  keyPrefix: string;
  index: number;
  isCharge?: boolean;
}

const getItemPrice = (itemType: any, singleton: number = 1, jitaPrice: any) => {
  const blueprint = isBlueprint(itemType);
  const isCopy = blueprint && singleton === 2;

  if (isCopy) {
    return 0.01;
  }

  return jitaPrice?.sell || jitaPrice?.average || 0;
};

const renderQuantity = (destroyed: number, dropped: number) => {
  const hasDestroyed = destroyed > 0;
  const hasDropped = dropped > 0;

  if (hasDestroyed && hasDropped) {
    return (
      <div className="flex flex-col w-16 leading-tight">
        <span>{destroyed}</span>
        <span>{dropped}</span>
      </div>
    );
  } else if (hasDestroyed) {
    return <div className="w-16">{destroyed}</div>;
  } else if (hasDropped) {
    return <div className="w-16">{dropped}</div>;
  } else {
    return <div className="w-16">1</div>;
  }
};

export default function FittingItem({
  item,
  keyPrefix,
  index,
  isCharge = false,
}: FittingItemProps) {
  const totalQty = item.quantityDestroyed + item.quantityDropped || 1;
  const isDestroyed = item.quantityDestroyed > 0;
  const isDropped = item.quantityDropped > 0;
  const bgColor = isDestroyed
    ? "hover:bg-red-700/50 bg-red-700/40"
    : isDropped
      ? "hover:bg-green-700/50 bg-green-700/40"
      : "";

  return (
    <div
      key={`${keyPrefix}-${item.itemType.id}-${index}`}
      className={`transition-colors flex items-center ${bgColor}`}
    >
      <img
        src={getItemImageUrl(item.itemType, item.singleton, 64)}
        alt={getItemName(item.itemType, item.singleton)}
        className="bg-white/5 size-8 border-white/10"
        loading="lazy"
        decoding="async"
      />
      <div className="flex-1 min-w-0 pl-2">
        <div className="truncate">
          {getItemName(item.itemType, item.singleton)}
        </div>
      </div>
      <div className="flex items-center gap-4 text-right">
        {renderQuantity(item.quantityDestroyed, item.quantityDropped)}
        <div className="w-40 pr-2 tabular-nums">
          {formatISK(
            getItemPrice(
              item.itemType,
              item.singleton,
              item.itemType.jitaPrice,
            ) * totalQty,
          )}
        </div>
      </div>
    </div>
  );
}
