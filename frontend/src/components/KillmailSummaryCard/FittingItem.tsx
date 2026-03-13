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
        <span className="text-red-400">{destroyed}</span>
        <span className="text-green-500">{dropped}</span>
      </div>
    );
  } else if (hasDestroyed) {
    return <div className="w-16 text-red-400">{destroyed}</div>;
  } else if (hasDropped) {
    return <div className="w-16 text-green-500">{dropped}</div>;
  } else {
    return <div className="w-16 text-white">1</div>;
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
  const textColor =
    isDestroyed || isDropped
      ? "text-gray-300"
      : isCharge
        ? "text-gray-400"
        : "text-white";
  const bgColor = isDestroyed
    ? "transition-colors hover:bg-red-500/20 bg-red-500/15"
    : isDropped
      ? "transition-colors hover:bg-green-500/20 bg-green-500/15"
      : "";

  return (
    <div
      key={`${keyPrefix}-${item.itemType.id}-${index}`}
      className={`flex items-center gap-3 py-2 ${bgColor}`}
    >
      <img
        src={getItemImageUrl(item.itemType, item.singleton, 64)}
        alt={getItemName(item.itemType, item.singleton)}
        className="border bg-white/5 size-16 border-white/10"
        loading="lazy"
        decoding="async"
      />
      <div className="flex-1 min-w-0">
        <div className={`truncate ${textColor}`}>
          {getItemName(item.itemType, item.singleton)}
        </div>
      </div>
      <div className="flex items-center gap-4 text-right">
        {renderQuantity(item.quantityDestroyed, item.quantityDropped)}
        <div className={`w-40 tabular-nums ${textColor}`}>
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
