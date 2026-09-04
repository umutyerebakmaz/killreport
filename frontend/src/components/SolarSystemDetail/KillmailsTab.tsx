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

interface KillmailsTabProps {
  systemId: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

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
    kind: 'ships',
    title: 'Top Ships',
    emptyText: 'No ship activity in the last 7 days',
  },
];

export default function KillmailsTab({
  systemId,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: KillmailsTabProps) {
  // No `skip` needed: this component only mounts while its tab is active.
  const { data: killmailsData, loading: killmailsLoading } = useKillmailsQuery({
    variables: {
      filter: {
        systemId,
        page: currentPage,
        limit: pageSize,
        orderBy: KillmailOrderBy.TimeDesc,
      },
    },
  });

  const { data: dateCountsData } = useKillmailsDateCountsQuery({
    variables: { filter: { systemId } },
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
      <div className="lg:col-span-3">
        <h2 className="sr-only">Killmails</h2>

        <KillmailsTable
          killmails={killmails}
          loading={killmailsLoading}
          dateCountsMap={dateCountsMap}
          totalCount={pageInfo?.totalCount}
          variant="detail"
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

      <div className="lg:col-span-1 lg:mt-9">
        <TopEntitySidebar filter={{ systemId }} cards={SIDEBAR_CARDS} />
      </div>
    </div>
  );
}
