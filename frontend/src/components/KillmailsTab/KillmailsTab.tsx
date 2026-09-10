'use client';

import KillmailsTable from '@/components/KillmailsTable';
import Paginator from '@/components/Paginator/Paginator';
import TopEntitySidebar, {
  TopEntityCardSpec,
} from '@/components/TopEntitySidebar/TopEntitySidebar';
import {
  KillmailOrderBy,
  useKillmailsDateCountsQuery,
  useKillmailsQuery,
} from '@/generated/graphql';
import { useMemo } from 'react';

/**
 * What the tab is scoped to. These three are the fields KillmailFilter and
 * TopEntityFilter have in common, so one of them scopes the table, the date
 * counts and the sidebar together.
 */
export interface KillmailsTabScope {
  systemId?: number;
  constellationId?: number;
  regionId?: number;
}

interface KillmailsTabProps {
  scope: KillmailsTabScope;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

/**
 * Same order as the killmails page's sidebar, Top Ships Used ahead of Top
 * Ships Killed. The used-ships card was missing here because it once rendered
 * empty under a spatial scope: topAttackerShips took its own filter input
 * which did not declare systemId, so that one query failed variable
 * validation while its siblings succeeded. Every top query now takes the one
 * TopFilter, which carries systemId, constellationId and regionId, so the
 * cause is gone.
 */
const SIDEBAR_CARDS: TopEntityCardSpec[] = [
  {
    kind: 'characters',
    title: 'Top Characters',
    emptyText: 'No character activity in the last 7 days',
  },
  {
    kind: 'corporations',
    title: 'Top Corporations',
    emptyText: 'No corporation activity in the last 7 days',
  },
  {
    kind: 'alliances',
    title: 'Top Alliances',
    emptyText: 'No alliance activity in the last 7 days',
  },
  {
    kind: 'factions',
    title: 'Top Factions',
    emptyText: 'No faction activity in the last 7 days',
  },
  {
    kind: 'attackerShips',
    title: 'Top Ships Used',
    emptyText: 'No ship activity in the last 7 days',
  },
  {
    kind: 'ships',
    title: 'Top Ships Killed',
    emptyText: 'No ship activity in the last 7 days',
  },
];

export default function KillmailsTab({
  scope,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: KillmailsTabProps) {
  // No `skip` needed: this component only mounts while its tab is active.
  const { data: killmailsData, loading: killmailsLoading } = useKillmailsQuery({
    variables: {
      filter: {
        ...scope,
        page: currentPage,
        limit: pageSize,
        orderBy: KillmailOrderBy.TimeDesc,
      },
    },
  });

  const { data: dateCountsData } = useKillmailsDateCountsQuery({
    variables: { filter: scope },
  });

  const killmails = useMemo(
    () => killmailsData?.killmails.items || [],
    [killmailsData],
  );

  const dateCountsMap = useMemo(() => {
    const map = new Map<string, number>();
    dateCountsData?.killmailsDateCounts.forEach((dc) => {
      map.set(dc.date, dc.count);
    });
    return map;
  }, [dateCountsData]);

  const pageInfo = killmailsData?.killmails.pageInfo;
  const totalPages = pageInfo?.totalPages || 0;

  return (
    <div className="grid grid-cols-1 gap-6 mt-8 lg:grid-cols-4">
      <div className="lg:col-span-3">
        <h2 className="sr-only">Killmails</h2>

        <KillmailsTable
          killmails={killmails}
          loading={killmailsLoading}
          dateCountsMap={dateCountsMap}
          totalCount={pageInfo?.totalCount}
        />

        {killmails.length > 0 && (
          <div className="mt-6">
            <Paginator
              hasNextPage={pageInfo?.hasNextPage ?? false}
              hasPrevPage={pageInfo?.hasPreviousPage ?? false}
              onNext={() =>
                pageInfo?.hasNextPage && onPageChange(currentPage + 1)
              }
              onPrev={() =>
                pageInfo?.hasPreviousPage && onPageChange(currentPage - 1)
              }
              onFirst={() => onPageChange(1)}
              onLast={() => totalPages > 0 && onPageChange(totalPages)}
              loading={killmailsLoading}
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageSizeChange={onPageSizeChange}
            />
          </div>
        )}
      </div>

      {/*
        lg:mt-10 drops the first card past the table's header row, so it lines
        up with the first killmail rather than with the column titles. The
        killmails page writes this same two-column block out a second time and
        uses 10 there; this copy had drifted to 9. Change both or neither.
      */}
      <div className="lg:col-span-1 lg:mt-10">
        <TopEntitySidebar filter={scope} cards={SIDEBAR_CARDS} />
      </div>
    </div>
  );
}
