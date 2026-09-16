import { formatISK } from '@/utils/formatISK';
import {
  getItemImageUrl,
  getItemName,
  isBlueprint,
} from '@/utils/itemImageUrl';
import { FittingView } from './types';

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
  /** Grid cells are ~400px wide, table rows ~1200px, so the fixed columns
   *  are sized per view rather than once. */
  view: FittingView;
}

const getItemPrice = (itemType: any, singleton: number = 1, jitaPrice: any) => {
  const blueprint = isBlueprint(itemType);
  const isCopy = blueprint && singleton === 2;

  if (isCopy) {
    return 0.01;
  }

  return jitaPrice?.sell || jitaPrice?.average || 0;
};

const renderQuantity = (
  destroyed: number,
  dropped: number,
  widthClass: string,
) => {
  const hasDestroyed = destroyed > 0;
  const hasDropped = dropped > 0;

  if (hasDestroyed && hasDropped) {
    return (
      <div className={`flex flex-col ${widthClass} leading-tight`}>
        <span>{destroyed}</span>
        <span>{dropped}</span>
      </div>
    );
  } else if (hasDestroyed) {
    return <div className={widthClass}>{destroyed}</div>;
  } else if (hasDropped) {
    return <div className={widthClass}>{dropped}</div>;
  } else {
    return <div className={widthClass}>1</div>;
  }
};

export default function FittingItem({
  item,
  keyPrefix,
  index,
  isCharge = false,
  view,
}: FittingItemProps) {
  const totalQty = item.quantityDestroyed + item.quantityDropped || 1;
  const isDestroyed = item.quantityDestroyed > 0;
  const isDropped = item.quantityDropped > 0;
  const bgColor = isDestroyed
    ? 'hover:bg-destroyed-fill/50 bg-destroyed-fill/40'
    : isDropped
      ? 'hover:bg-dropped-fill/50 bg-dropped-fill/40'
      : '';

  // formatISK never prints more than eight characters — `999.99B` is the
  // widest it goes — so 160px is twice what the column needs. The table view
  // keeps it anyway: that width is part of what "classic" means here.
  const priceWidth = view === 'grid' ? 'w-20' : 'w-40';
  const quantityWidth = view === 'grid' ? 'w-10' : 'w-16';
  const itemName = getItemName(item.itemType, item.singleton);

  return (
    <div
      key={`${keyPrefix}-${item.itemType.id}-${index}`}
      className={`transition-colors flex items-center ${bgColor}`}
    >
      <img
        src={getItemImageUrl(item.itemType, item.singleton, 64)}
        alt={itemName}
        className="bg-white/5 size-8 border-white/10"
        loading="lazy"
        decoding="async"
      />
      <div className="flex-1 min-w-0 pl-2">
        {/* The cell is narrow enough to clip a long module name, so the full
            one lives in the title. */}
        <div className="truncate" title={itemName}>
          {itemName}
        </div>
      </div>
      <div className="flex items-center gap-4 text-right">
        {renderQuantity(
          item.quantityDestroyed,
          item.quantityDropped,
          quantityWidth,
        )}
        <div className={`${priceWidth} pr-2 tabular-nums`}>
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
