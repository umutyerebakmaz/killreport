'use client';

import KillmailCard, {
  KillmailCardData,
} from '@/components/KillmailCard/KillmailCard';
import SectionTitle from '@/components/ui/SectionTitle';
import {
  MostValuableScope,
  useMostValuableKillmailsQuery,
} from '@/generated/graphql';
import { useTabList } from '@/hooks/useTabList';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useCallback, useEffect, useRef, useState } from 'react';

const WINDOW_DAYS = 7;
const CARD_COUNT = 20;

/** Card width (w-80 = 320px) plus the flex gap (gap-4 = 16px). */
const CARD_PITCH = 336;

/**
 * One panel element whose content swaps, so every tab points at the same id.
 * A per-scope id would leave the three inactive tabs' `aria-controls` naming an
 * element that is not in the DOM.
 */
const PANEL_ID = 'most-valuable-panel';

interface Tab {
  scope: MostValuableScope;
  label: string;
  emptyText: string;
}

const TABS: Tab[] = [
  {
    scope: MostValuableScope.Ships,
    label: 'Ships',
    emptyText: 'No ship losses in the last 7 days',
  },
  {
    scope: MostValuableScope.Structures,
    label: 'Structures',
    emptyText: 'No structure losses in the last 7 days',
  },
  {
    scope: MostValuableScope.Capitals,
    label: 'Capitals',
    emptyText: 'No capital losses in the last 7 days',
  },
  {
    scope: MostValuableScope.Solo,
    label: 'Solo',
    emptyText: 'No solo kills in the last 7 days',
  },
];

/** Same order as TABS, derived rather than declared again. */
const TAB_SCOPES: MostValuableScope[] = TABS.map((tab) => tab.scope);

/**
 * The Most Valuable shelf on the killmails page. Self-contained: it owns its tab
 * state, its scrolling and its own query, so the page only has to place it.
 *
 * Only the active tab queries. Apollo keeps what previous tabs fetched, so moving
 * back to one is instant.
 */
export default function MostValuableCarousel() {
  const [activeScope, setActiveScope] = useState<MostValuableScope>(
    MostValuableScope.Ships,
  );

  const { onKeyDown } = useTabList(TAB_SCOPES, activeScope, setActiveScope);

  const { data, loading } = useMostValuableKillmailsQuery({
    variables: { scope: activeScope, days: WINDOW_DAYS, limit: CARD_COUNT },
  });

  const killmails: KillmailCardData[] = data?.mostValuableKillmails ?? [];

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // The old carousel assumed it could scroll right and never measured on mount,
  // so the arrow stayed lit even when nothing overflowed.
  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, killmails.length]);

  // A new tab starts at the beginning of its own shelf.
  useEffect(() => {
    scrollRef.current?.scrollTo({ left: 0 });
  }, [activeScope]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    // Move by whole cards so they never come to rest half out of view.
    const cardsPerView = Math.max(1, Math.floor(el.clientWidth / CARD_PITCH));
    const delta = cardsPerView * CARD_PITCH * (direction === 'right' ? 1 : -1);
    el.scrollTo({ left: el.scrollLeft + delta, behavior: 'smooth' });
  };

  const activeTab = TABS.find((t) => t.scope === activeScope)!;

  const tabId = (scope: MostValuableScope) => `most-valuable-tab-${scope}`;

  return (
    <>
      <SectionTitle subtitle="Last 7 days, by ISK destroyed">
        Most Valuable
      </SectionTitle>

      {/*
       * The scroll buttons sit next to the tablist rather than inside it: a
       * tablist that holds anything but tabs stops announcing them correctly.
       */}
      <div className="flex items-center justify-between gap-4 pb-3 mb-4 border-b border-white/5">
        <div
          role="tablist"
          aria-label="Most valuable scope"
          className="flex gap-1"
        >
          {TABS.map((tab) => (
            <button
              key={tab.scope}
              id={tabId(tab.scope)}
              role="tab"
              aria-selected={tab.scope === activeScope}
              aria-controls={PANEL_ID}
              tabIndex={tab.scope === activeScope ? 0 : -1}
              onClick={() => setActiveScope(tab.scope)}
              onKeyDown={onKeyDown}
              className="button button-secondary button-sm"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className="button button-secondary button-icon"
            aria-label="Scroll left"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className="button button-secondary button-icon"
            aria-label="Scroll right"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div role="tabpanel" id={PANEL_ID} aria-labelledby={tabId(activeScope)}>
        {loading ? (
          // Skeletons rather than a centred spinner: the shelf keeps its height, so
          // switching tabs does not make the page jump.
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex-none w-80 h-[420px] bg-white/5 animate-pulse"
              />
            ))}
          </div>
        ) : killmails.length === 0 ? (
          <div className="flex items-center justify-center h-[420px] text-gray-500">
            <p className="text-sm font-medium">{activeTab.emptyText}</p>
          </div>
        ) : (
          <div
            ref={scrollRef}
            onScroll={measure}
            className="flex gap-4 overflow-x-auto hide-scrollbar snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {killmails.map((killmail, index) => (
              <div key={killmail.id} className="flex-none w-80 snap-start">
                <KillmailCard killmail={killmail} rank={index + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
