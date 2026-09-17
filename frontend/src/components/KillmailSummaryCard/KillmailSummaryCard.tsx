'use client';

import type { KillmailQuery } from '@/generated/graphql';
import { useTabList } from '@/hooks/useTabList';
import { formatISK } from '@/utils/formatISK';
import { isBlueprint } from '@/utils/itemType';
import { getShipTier } from '@/utils/shipTier';
import { useState, useSyncExternalStore } from 'react';
import RadioGroup from '../RadioGroup/RadioGroup';
import ShipTierBadge from '../ShipTierBadge/ShipTierBadge';
import SummaryRow from '../ui/SummaryRow';
import FittingSection from './FittingSection';
import { FittingScope, FittingView } from './types';

/**
 * One panel whose content swaps, so every tab points at the same id — a
 * per-scope id would leave the inactive tabs' `aria-controls` naming an
 * element that is not in the DOM.
 */
const PANEL_ID = 'killmail-fitting-panel';

const TABS: { scope: FittingScope; label: string }[] = [
  { scope: 'all', label: 'All' },
  { scope: 'destroyed', label: 'Destroyed' },
  { scope: 'dropped', label: 'Dropped' },
];

/** Same order as TABS, derived rather than declared again. */
const TAB_SCOPES: FittingScope[] = TABS.map((tab) => tab.scope);

/** A view preference outlives one killmail, so it is kept in the browser.
 *  snake_case to match the keys the app already writes (`eve_access_token`). */
const VIEW_STORAGE_KEY = 'killmail_fitting_view';

const VIEW_OPTIONS: { value: FittingView; label: string }[] = [
  { value: 'grid', label: 'Grid' },
  { value: 'table', label: 'Table' },
];

/*
 * localStorage read as an external store rather than copied into state inside
 * an effect. Two reasons: an effect that calls setState on mount is a
 * cascading render (and ESLint says so), and useSyncExternalStore is the API
 * React added for exactly this — a mutable source outside React that has to
 * render something definite on the server.
 *
 * `window` fires `storage` only for other tabs, so same-tab writes notify the
 * subscribers here by hand.
 */
const viewListeners = new Set<() => void>();

const subscribeToView = (onStoreChange: () => void) => {
  viewListeners.add(onStoreChange);
  window.addEventListener('storage', onStoreChange);
  return () => {
    viewListeners.delete(onStoreChange);
    window.removeEventListener('storage', onStoreChange);
  };
};

/** Anything that is not the stored 'table' means grid, including a cleared
 *  or unreadable store. */
const readStoredView = (): FittingView =>
  localStorage.getItem(VIEW_STORAGE_KEY) === 'table' ? 'table' : 'grid';

/** The server has no store, so it always renders the default. */
const readServerView = (): FittingView => 'grid';

const writeStoredView = (next: FittingView) => {
  localStorage.setItem(VIEW_STORAGE_KEY, next);
  viewListeners.forEach((notify) => notify());
};

type Killmail = NonNullable<KillmailQuery['killmail']>;

/**
 * The victim's hull as this document selects it, not the schema's `Type`.
 * The query asks for `id`, `jitaPrice` and the `group.category` that
 * `isBlueprint` reads; a wider type would promise fields that never arrive.
 *
 * `shipType` is non-null inside `Victim`, and the one call site sits behind a
 * `victim?.shipType &&` guard, so the parameter takes the object rather than
 * a nullable one — which is what the optional chaining inside was standing in
 * for.
 */
type VictimShipType = NonNullable<Killmail['victim']>['shipType'];

// Special handling for Capsule ship price
const getShipPrice = (shipType: VictimShipType) => {
  // Capsule (type_id: 670) has fixed value of 10 ISK
  if (shipType.id === 670) {
    return 10;
  }
  const jitaPrice = shipType.jitaPrice;
  const blueprint = isBlueprint(shipType);
  const isCopy = blueprint && 2 === 2; // Ships are never copies

  if (isCopy) {
    return 0.01;
  }

  return jitaPrice?.sell || jitaPrice?.average || 0;
};

interface KillmailSummaryCardProps {
  /* Typed from the document rather than the schema: the two are different
     shapes, and `any` here was what forced every slot callback below to
     annotate its parameter by hand. */
  victim: Killmail['victim'];
  fitting: Killmail['fitting'];
  isStructure: boolean;
  destroyedValue: number;
  droppedValue: number;
  totalValue: number;
}

export default function KillmailSummaryCard({
  victim,
  fitting,
  isStructure,
  destroyedValue,
  droppedValue,
  totalValue,
}: KillmailSummaryCardProps) {
  const [scope, setScope] = useState<FittingScope>('all');
  const { onKeyDown } = useTabList(TAB_SCOPES, scope, setScope);
  const tabId = (value: FittingScope) => `killmail-fitting-tab-${value}`;

  const view = useSyncExternalStore(
    subscribeToView,
    readStoredView,
    readServerView,
  );

  return (
    /*
     * A frame, not a leaf. Every group below carries its own `.card`, so this
     * wrapper stays on the page ground — the same shape the solar system,
     * character, alliance and corporation pages use for a tab bar over panels
     * that hold their own surfaces. Inside a card the groups would share its
     * surface and read as one stack, which is what they used to do.
     */
    <div className="space-y-2 tab-shell">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div role="tablist" aria-label="Fitting items" className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.scope}
              id={tabId(tab.scope)}
              role="tab"
              aria-selected={tab.scope === scope}
              aria-controls={PANEL_ID}
              tabIndex={tab.scope === scope ? 0 : -1}
              onClick={() => setScope(tab.scope)}
              onKeyDown={onKeyDown}
              className="button button-secondary button-sm"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* A RadioGroup rather than a second tablist: the band already holds
            one, and a screen reader would announce two sets of tabs where
            this is a preference, not navigation. */}
        <RadioGroup
          name="killmail-fitting-view"
          options={VIEW_OPTIONS}
          value={view}
          onChange={writeStoredView}
        />
      </div>

      {/*
       * Grid view puts the groups side by side — High Slots beside Mid Slots
       * beside Low Slots — and each group wraps its tiles inside its own card.
       * Three across is comfortable here in a way it never was for text rows:
       * a tile is 64px, so a ~260px column still fits three of them, where a
       * named row needed 400px to stay readable.
       *
       * `items-start` lets a short group (Rigs, three tiles) end where it ends
       * instead of stretching to the height of a long one (Cargo).
       */}
      <div
        role="tabpanel"
        id={PANEL_ID}
        aria-labelledby={tabId(scope)}
        className={
          view === 'grid'
            ? 'grid items-start grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3'
            : 'space-y-2'
        }
      >
        {/* Ship spans the whole row — the hull is the headline, not one group
            among many. It is always destroyed and never drops, so the Dropped
            view would be lying if it kept this block. */}
        {victim?.shipType && scope !== 'dropped' && (
          <div className="card col-span-full">
            <div className="card-header">
              <h3 className="font-bold text-gray-100 uppercase">Ship</h3>
            </div>
            <div className="flex items-center gap-3 px-2 py-2 transition-colors hover:bg-destroyed-fill/50 bg-destroyed-fill/40">
              <div className="relative shrink-0">
                {getShipTier(victim.shipType.dogmaAttributes) && (
                  <div className="absolute top-0 left-0 z-20">
                    <ShipTierBadge
                      tier={getShipTier(victim.shipType.dogmaAttributes)}
                      className="size-5"
                    />
                  </div>
                )}
                <img
                  src={`https://images.evetech.net/types/${victim.shipType.id}/render?size=128`}
                  alt={victim.shipType.name}
                  className="border size-16 border-amber-900/80"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (target.src.includes('/render?')) {
                      target.src = `https://images.evetech.net/types/${victim.shipType.id}/icon?size=128`;
                    }
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-orange-400 truncate">
                  {victim.shipType.name}
                </div>
                {victim.shipType.group && (
                  <div className="text-gray-300">
                    {victim.shipType.group.name}
                  </div>
                )}
              </div>
              <div className="flex gap-4 text-right">
                <div className="text-gray-300 tabular-nums">1</div>
                <div className="w-40 text-gray-300 tabular-nums">
                  {formatISK(getShipPrice(victim.shipType))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* High Slots */}
        {fitting?.highSlots &&
          fitting.highSlots.slots.some((slot) => slot.module) && (
            <FittingSection
              view={view}
              scope={scope}
              title="High Slots"
              items={fitting.highSlots.slots
                .filter((slot) => slot.module)
                .map((slot) => slot.module)}
              keyPrefix="high"
              hasCharges={true}
            />
          )}

        {/* Mid Slots */}
        {fitting?.midSlots &&
          fitting.midSlots.slots.some((slot) => slot.module) && (
            <FittingSection
              view={view}
              scope={scope}
              title="Mid Slots"
              items={fitting.midSlots.slots
                .filter((slot) => slot.module)
                .map((slot) => slot.module)}
              keyPrefix="mid"
              hasCharges={true}
            />
          )}

        {/* Low Slots */}
        {fitting?.lowSlots &&
          fitting.lowSlots.slots.some((slot) => slot.module) && (
            <FittingSection
              view={view}
              scope={scope}
              title="Low Slots"
              items={fitting.lowSlots.slots
                .filter((slot) => slot.module)
                .map((slot) => slot.module)}
              keyPrefix="low"
              hasCharges={false}
            />
          )}

        {/* Rigs */}
        {fitting?.rigs && fitting.rigs.slots.length > 0 && (
          <FittingSection
            view={view}
            scope={scope}
            title="Rigs"
            items={fitting.rigs.slots
              .filter((slot) => slot.module)
              .map((slot) => slot.module)}
            keyPrefix="rig"
            hasCharges={false}
          />
        )}

        {/* Subsystems */}
        {fitting?.subsystems && fitting.subsystems.slots.length > 0 && (
          <FittingSection
            view={view}
            scope={scope}
            title="Subsystems"
            items={fitting.subsystems.slots
              .filter((slot) => slot.module)
              .map((slot) => slot.module)}
            keyPrefix="subsystem"
            hasCharges={false}
          />
        )}

        {/* Service Slots */}
        {isStructure &&
          fitting?.serviceSlots &&
          fitting.serviceSlots.slots.some((slot) => slot.module) && (
            <FittingSection
              view={view}
              scope={scope}
              title="Service Slots"
              items={fitting.serviceSlots.slots
                .filter((slot) => slot.module)
                .map((slot) => slot.module)}
              keyPrefix="service"
              hasCharges={false}
            />
          )}

        {/* Drone Bay */}
        {fitting?.droneBay && fitting.droneBay.length > 0 && (
          <FittingSection
            view={view}
            scope={scope}
            title="Drone Bay"
            items={fitting.droneBay}
            keyPrefix="drone"
            hasCharges={false}
          />
        )}

        {/* Implants. There used to be a second block above this one that
            read `fitting.implants.length`, but `implants` is a SlotGroup —
            an object, never an array — so that length was always undefined
            and the block never rendered once. Typing this component's props
            from the query is what surfaced it. */}
        {fitting?.implants &&
          fitting.implants.slots &&
          fitting.implants.slots.some((slot) => slot.module) && (
            <FittingSection
              view={view}
              scope={scope}
              title="Implants"
              items={fitting.implants.slots
                .filter((slot) => slot.module)
                .map((slot) => slot.module)}
              keyPrefix="implant-slot"
              hasCharges={false}
            />
          )}

        {/* Cargo */}
        {fitting?.cargo && fitting.cargo.length > 0 && (
          <FittingSection
            view={view}
            scope={scope}
            title="Cargo"
            items={fitting.cargo}
            keyPrefix="cargo"
            hasCharges={false}
          />
        )}

        {/* Fuel Bay */}
        {fitting?.fuelBay && fitting.fuelBay.length > 0 && (
          <FittingSection
            view={view}
            scope={scope}
            title="Fuel Bay"
            items={fitting.fuelBay}
            keyPrefix="fuel-bay"
            hasCharges={false}
          />
        )}

        {/* Mining Hold */}
        {fitting?.oreHold && fitting.oreHold.length > 0 && (
          <FittingSection
            view={view}
            scope={scope}
            title="Mining Hold"
            items={fitting.oreHold}
            keyPrefix="ore-hold"
            hasCharges={false}
          />
        )}

        {/* Fleet Hangar */}
        {fitting?.fleetHangar && fitting.fleetHangar.length > 0 && (
          <FittingSection
            view={view}
            scope={scope}
            title="Fleet Hangar"
            items={fitting.fleetHangar}
            keyPrefix="fleet-hangar"
            hasCharges={false}
          />
        )}

        {/* Infrastructure Hangar */}
        {fitting?.infrastructureHangar &&
          fitting.infrastructureHangar.length > 0 && (
            <FittingSection
              view={view}
              scope={scope}
              title="Infrastructure Hangar"
              items={fitting.infrastructureHangar}
              keyPrefix="infrastructure-hangar"
              hasCharges={false}
            />
          )}

        {/* Gas Hold */}
        {fitting?.gasHold && fitting.gasHold.length > 0 && (
          <FittingSection
            view={view}
            scope={scope}
            title="Gas Hold"
            items={fitting.gasHold}
            keyPrefix="gas-hold"
            hasCharges={false}
          />
        )}

        {/* Mineral Hold */}
        {fitting?.mineralHold && fitting.mineralHold.length > 0 && (
          <FittingSection
            view={view}
            scope={scope}
            title="Mineral Hold"
            items={fitting.mineralHold}
            keyPrefix="mineral-hold"
            hasCharges={false}
          />
        )}

        {/* Salvage Hold */}
        {fitting?.salvageHold && fitting.salvageHold.length > 0 && (
          <FittingSection
            view={view}
            scope={scope}
            title="Salvage Hold"
            items={fitting.salvageHold}
            keyPrefix="salvage-hold"
            hasCharges={false}
          />
        )}

        {/* Planetary Commodities Hold */}
        {fitting?.planetaryCommoditiesHold &&
          fitting.planetaryCommoditiesHold.length > 0 && (
            <FittingSection
              view={view}
              scope={scope}
              title="Planetary Commodities Hold"
              items={fitting.planetaryCommoditiesHold}
              keyPrefix="planetary-commodities"
              hasCharges={false}
            />
          )}

        {/* Ice Hold */}
        {fitting?.iceHold && fitting.iceHold.length > 0 && (
          <FittingSection
            view={view}
            scope={scope}
            title="Ice Hold"
            items={fitting.iceHold}
            keyPrefix="ice-hold"
            hasCharges={false}
          />
        )}

        {/* Infrastructure Hold */}
        {fitting?.infrastructureHold &&
          fitting.infrastructureHold.length > 0 && (
            <FittingSection
              view={view}
              scope={scope}
              title="Infrastructure Hold"
              items={fitting.infrastructureHold}
              keyPrefix="infrastructure-hold"
              hasCharges={false}
            />
          )}

        {/* Fighter Bay */}
        {fitting?.fighterBay && fitting.fighterBay.length > 0 && (
          <FittingSection
            view={view}
            scope={scope}
            title="Fighter Bay"
            items={fitting.fighterBay}
            keyPrefix="fighter"
            hasCharges={false}
          />
        )}

        {/* Structure Fuel */}
        {isStructure &&
          fitting?.structureFuel &&
          fitting.structureFuel.length > 0 && (
            <FittingSection
              view={view}
              scope={scope}
              title="Structure Fuel"
              items={fitting.structureFuel}
              keyPrefix="fuel"
              hasCharges={false}
            />
          )}

        {/* Core Room */}
        {isStructure && fitting?.coreRoom && fitting.coreRoom.length > 0 && (
          <FittingSection
            view={view}
            scope={scope}
            title="Core Room"
            items={fitting.coreRoom}
            keyPrefix="core"
            hasCharges={false}
          />
        )}
      </div>

      {/* Value Summary. Outside the tab panel on purpose: these are the
          killmail's totals, not the view's. */}
      <div className="px-2 py-2 space-y-1 card">
        <SummaryRow label="Destroyed">
          <span className="text-destroyed tabular-nums">
            {formatISK(destroyedValue)}
          </span>
        </SummaryRow>

        <SummaryRow label="Dropped">
          <span className="text-dropped tabular-nums">
            {formatISK(droppedValue)}
          </span>
        </SummaryRow>

        <SummaryRow label={<span className="font-semibold">Total Value</span>}>
          <span className="font-bold text-isk tabular-nums">
            {formatISK(totalValue)}
          </span>
        </SummaryRow>
      </div>
    </div>
  );
}
