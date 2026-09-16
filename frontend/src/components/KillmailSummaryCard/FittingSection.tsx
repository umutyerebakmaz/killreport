import FittingItem from './FittingItem';
import { FittingView } from './types';

interface FittingSectionProps {
  title: string;
  items: any[];
  keyPrefix: string;
  hasCharges?: boolean;
  view: FittingView;
}

const groupItems = (items: any[]) => {
  const grouped = new Map<
    string,
    {
      itemType: any;
      singleton: number;
      quantityDestroyed: number;
      quantityDropped: number;
    }
  >();

  items.forEach((item) => {
    const typeId = item.itemType.id;
    const singleton = item.singleton;
    const isDestroyed = (item.quantityDestroyed || 0) > 0;
    const isDropped = (item.quantityDropped || 0) > 0;

    if (isDestroyed) {
      const key = `${typeId}-${singleton}-destroyed`;
      const existing = grouped.get(key);

      if (existing) {
        existing.quantityDestroyed += item.quantityDestroyed || 0;
      } else {
        grouped.set(key, {
          itemType: item.itemType,
          singleton: item.singleton,
          quantityDestroyed: item.quantityDestroyed || 0,
          quantityDropped: 0,
        });
      }
    }

    if (isDropped) {
      const key = `${typeId}-${singleton}-dropped`;
      const existing = grouped.get(key);

      if (existing) {
        existing.quantityDropped += item.quantityDropped || 0;
      } else {
        grouped.set(key, {
          itemType: item.itemType,
          singleton: item.singleton,
          quantityDestroyed: 0,
          quantityDropped: item.quantityDropped || 0,
        });
      }
    }
  });

  return Array.from(grouped.values());
};

export default function FittingSection({
  title,
  items,
  keyPrefix,
  hasCharges = false,
  view,
}: FittingSectionProps) {
  if (!items || items.length === 0) {
    return null;
  }

  const modules: any[] = [];
  const charges: any[] = [];

  // Separate modules and charges if needed
  if (hasCharges) {
    items.forEach((item: any) => {
      modules.push(item);
      if (item.charge) {
        charges.push(item.charge);
      }
    });
  } else {
    modules.push(...items);
  }

  const groupedModules = groupItems(modules);
  const groupedCharges = hasCharges ? groupItems(charges) : [];

  // `gap-px` is the grid's answer to `divide-y`: a hairline between cells,
  // drawn by letting the card's own surface through.
  const listClass =
    view === 'grid'
      ? 'grid grid-cols-1 gap-px sm:grid-cols-2 2xl:grid-cols-3'
      : 'flex flex-col divide-y divide-white/10';

  return (
    <div className="border-b border-white/10">
      <h3 className="py-2 pl-2 font-bold text-gray-400 uppercase">{title}</h3>
      <div className={listClass}>
        {groupedModules.map((item, index) => (
          <FittingItem
            key={`${keyPrefix}-module-${item.itemType.id}-${index}`}
            item={item}
            keyPrefix={`${keyPrefix}-module`}
            index={index}
            view={view}
          />
        ))}

        {groupedCharges.map((item, index) => (
          <FittingItem
            key={`${keyPrefix}-charge-${item.itemType.id}-${index}`}
            item={item}
            keyPrefix={`${keyPrefix}-charge`}
            index={index}
            isCharge={true}
            view={view}
          />
        ))}
      </div>
    </div>
  );
}
