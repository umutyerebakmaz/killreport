import FittingItem from './FittingItem';
import { FittingScope, FittingView } from './types';

interface FittingSectionProps {
  title: string;
  items: any[];
  keyPrefix: string;
  hasCharges?: boolean;
  view: FittingView;
  scope: FittingScope;
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
  scope,
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

  // The filter is a predicate applied AFTER grouping: groupItems already
  // splits one item into a destroyed entry and a dropped entry, so asking
  // each entry which it is costs nothing and is exact.
  const keep = (entry: {
    quantityDestroyed: number;
    quantityDropped: number;
  }) =>
    scope === 'all' ||
    (scope === 'destroyed' && entry.quantityDestroyed > 0) ||
    (scope === 'dropped' && entry.quantityDropped > 0);

  const groupedModules = groupItems(modules).filter(keep);
  const groupedCharges = hasCharges ? groupItems(charges).filter(keep) : [];

  // The early return above fires when the section was given no items at all.
  // A section can also end up empty because everything it holds filtered out,
  // and a heading with nothing under it is worse than no heading.
  if (groupedModules.length === 0 && groupedCharges.length === 0) {
    return null;
  }

  // Grid view packs tiles left to right and wraps, the way the client's
  // inventory does; table view keeps one item per line.
  const listClass =
    view === 'grid'
      ? 'flex flex-wrap gap-1 p-2'
      : 'flex flex-col divide-y divide-white/10';

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-bold text-gray-100 uppercase">{title}</h3>
      </div>
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
