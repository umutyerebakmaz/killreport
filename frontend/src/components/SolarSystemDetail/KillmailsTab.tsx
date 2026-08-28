"use client";

import KillmailsTable from "@/components/KillmailsTable";
import Paginator from "@/components/Paginator/Paginator";
import TopAllianceCard from "@/components/TopAllianceCard/TopAllianceCard";
import TopCharacterCard from "@/components/TopCharacterCard/TopCharacterCard";
import TopCorporationCard from "@/components/TopCorporationCard/TopCorporationCard";
import TopShipsCard from "@/components/TopShipsCard/TopShipsCard";
import {
  KillmailOrderBy,
  useKillmailsDateCountsQuery,
  useKillmailsQuery,
  useTopLast7DaysAlliancesQuery,
  useTopLast7DaysCorporationsQuery,
  useTopLast7DaysPilotsQuery,
  useTopLast7DaysShipsQuery,
} from "@/generated/graphql";
import { useMemo } from "react";

interface KillmailsTabProps {
  systemId: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const ROLLING_SUBTITLE = (
  <>
    Last 7 days{" "}
    <span className="px-1.5 py-0.5 text-xs font-semibold text-orange-400 bg-orange-400/10 border border-orange-400/20">
      ROLLING
    </span>
  </>
);

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

  const topFilter = { variables: { filter: { limit: 10, systemId } } };
  const { data: weeklyPilotsData, loading: weeklyPilotsLoading } =
    useTopLast7DaysPilotsQuery(topFilter);
  const { data: weeklyCorporationsData, loading: weeklyCorporationsLoading } =
    useTopLast7DaysCorporationsQuery(topFilter);
  const { data: weeklyAlliancesData, loading: weeklyAlliancesLoading } =
    useTopLast7DaysAlliancesQuery(topFilter);
  const { data: weeklyShipsData, loading: weeklyShipsLoading } =
    useTopLast7DaysShipsQuery(topFilter);

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
        <div className="mb-6">
          <h2 className="text-2xl font-bold">Killmails</h2>
          {pageInfo?.totalCount !== undefined && (
            <p className="mt-1 text-sm text-gray-400">
              Total: {pageInfo.totalCount.toLocaleString()} killmails
            </p>
          )}
        </div>

        <KillmailsTable
          killmails={killmails}
          loading={killmailsLoading}
          dateCountsMap={dateCountsMap}
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

      <div className="space-y-6 lg:col-span-1 lg:mt-9">
        <TopCharacterCard
          title="Top Characters"
          subtitle={ROLLING_SUBTITLE}
          characters={
            weeklyPilotsData?.topLast7DaysPilots?.map((pilot) => ({
              id: pilot.character?.id || 0,
              name: pilot.character?.name || "Unknown",
              killCount: pilot.killCount,
              securityStatus: pilot.character?.securityStatus,
              corporation: pilot.character?.corporation
                ? {
                    id: pilot.character.corporation.id,
                    name: pilot.character.corporation.name,
                  }
                : null,
              alliance: pilot.character?.alliance
                ? {
                    id: pilot.character.alliance.id,
                    name: pilot.character.alliance.name,
                  }
                : null,
            })) || []
          }
          loading={weeklyPilotsLoading}
          emptyText="No character activity in the last 7 days"
          variant="detail"
        />
        <TopCorporationCard
          title="Top Corporations"
          subtitle={ROLLING_SUBTITLE}
          corporations={
            weeklyCorporationsData?.topLast7DaysCorporations?.map((corp) => ({
              id: corp.corporation?.id || 0,
              name: corp.corporation?.name || "Unknown",
              ticker: corp.corporation?.ticker,
              killCount: corp.killCount,
            })) || []
          }
          loading={weeklyCorporationsLoading}
          emptyText="No corporation activity in the last 7 days"
          variant="detail"
        />
        <TopAllianceCard
          title="Top Alliances"
          subtitle={ROLLING_SUBTITLE}
          alliances={
            weeklyAlliancesData?.topLast7DaysAlliances?.map((alliance) => ({
              id: alliance.alliance?.id || 0,
              name: alliance.alliance?.name || "Unknown",
              ticker: alliance.alliance?.ticker,
              killCount: alliance.killCount,
            })) || []
          }
          loading={weeklyAlliancesLoading}
          emptyText="No alliance activity in the last 7 days"
          variant="detail"
        />
        <TopShipsCard
          title="Top Ships"
          subtitle={ROLLING_SUBTITLE}
          ships={
            weeklyShipsData?.topLast7DaysShips?.map((ship) => ({
              id: ship.shipType?.id || 0,
              name: ship.shipType?.name || "Unknown",
              killCount: ship.killCount,
              dogmaAttributes: ship.shipType?.dogmaAttributes,
            })) || []
          }
          loading={weeklyShipsLoading}
          emptyText="No ship activity in the last 7 days"
          variant="detail"
        />
      </div>
    </div>
  );
}
