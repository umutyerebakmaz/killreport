'use client';

import TopAllianceCard from '@/components/TopAllianceCard/TopAllianceCard';
import TopCharacterCard from '@/components/TopCharacterCard/TopCharacterCard';
import TopCorporationCard from '@/components/TopCorporationCard/TopCorporationCard';
import TopShipsCard from '@/components/TopShipsCard/TopShipsCard';
import {
  LeaderboardPeriod,
  useTopPilotsQuery,
  useTopAlliancesQuery,
  useTopAttackerShipsQuery,
  useTopCorporationsQuery,
  useTopDestroyedShipsQuery,
} from '@/generated/graphql';

/**
 * The scope the cards are computed over. Every hook in this file takes a
 * TopFilter, and this is the subset of TopFilter's spatial fields the cards
 * are scoped by — there is no allianceId or corporationId, which is why the
 * alliance and corporation pages have their own entity-scoped sidebars
 * rather than using this one.
 */
export interface TopEntityFilter {
  systemId?: number;
  constellationId?: number;
  regionId?: number;
  limit?: number;
}

export type TopEntityCardKind =
  'characters' | 'corporations' | 'alliances' | 'attackerShips' | 'ships';

export interface TopEntityCardSpec {
  kind: TopEntityCardKind;
  title: string;
  emptyText: string;
}

interface TopEntitySidebarProps {
  filter?: TopEntityFilter;
  /** Cards to render, in order. Each one is a separate query. */
  cards: TopEntityCardSpec[];
}

const LAST_7_DAYS = 'Last 7 days';

export default function TopEntitySidebar({
  filter,
  cards,
}: TopEntitySidebarProps) {
  const { limit = 10, ...scope } = filter ?? {};
  const variables = { filter: { limit, ...scope } };

  // Every hook is called unconditionally and skipped when its card is not
  // requested: hooks cannot be called from inside the cards.map() below.
  const has = (kind: TopEntityCardKind) => cards.some((c) => c.kind === kind);

  const { data: pilots, loading: pilotsLoading } = useTopPilotsQuery({
    variables: {
      filter: { ...variables.filter, period: LeaderboardPeriod.Last_7Days },
    },
    skip: !has('characters'),
  });
  const { data: corporations, loading: corporationsLoading } =
    useTopCorporationsQuery({
      variables: {
        filter: { ...variables.filter, period: LeaderboardPeriod.Last_7Days },
      },
      skip: !has('corporations'),
    });
  const { data: alliances, loading: alliancesLoading } = useTopAlliancesQuery({
    variables: {
      filter: { ...variables.filter, period: LeaderboardPeriod.Last_7Days },
    },
    skip: !has('alliances'),
  });
  const { data: attackerShips, loading: attackerShipsLoading } =
    useTopAttackerShipsQuery({
      variables: {
        filter: { ...variables.filter, period: LeaderboardPeriod.Last_7Days },
      },
      skip: !has('attackerShips'),
    });
  const { data: ships, loading: shipsLoading } = useTopDestroyedShipsQuery({
    variables: {
      filter: { ...variables.filter, period: LeaderboardPeriod.Last_7Days },
    },
    skip: !has('ships'),
  });

  return (
    <div className="space-y-6">
      {cards.map((card) => {
        switch (card.kind) {
          case 'characters':
            return (
              <TopCharacterCard
                key={card.kind}
                title={card.title}
                subtitle={LAST_7_DAYS}
                characters={
                  pilots?.topPilots?.map((pilot) => ({
                    id: pilot.character?.id || 0,
                    name: pilot.character?.name || 'Unknown',
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
                loading={pilotsLoading}
                emptyText={card.emptyText}
              />
            );

          case 'corporations':
            return (
              <TopCorporationCard
                key={card.kind}
                title={card.title}
                subtitle={LAST_7_DAYS}
                corporations={
                  corporations?.topCorporations?.map((corp) => ({
                    id: corp.corporation?.id || 0,
                    name: corp.corporation?.name || 'Unknown',
                    ticker: corp.corporation?.ticker,
                    killCount: corp.killCount,
                  })) || []
                }
                loading={corporationsLoading}
                emptyText={card.emptyText}
              />
            );

          case 'alliances':
            return (
              <TopAllianceCard
                key={card.kind}
                title={card.title}
                subtitle={LAST_7_DAYS}
                alliances={
                  alliances?.topAlliances?.map((alliance) => ({
                    id: alliance.alliance?.id || 0,
                    name: alliance.alliance?.name || 'Unknown',
                    ticker: alliance.alliance?.ticker,
                    killCount: alliance.killCount,
                  })) || []
                }
                loading={alliancesLoading}
                emptyText={card.emptyText}
              />
            );

          // Ships flown by the attackers, as opposed to the ships that died.
          case 'attackerShips':
            return (
              <TopShipsCard
                key={card.kind}
                title={card.title}
                subtitle={LAST_7_DAYS}
                ships={
                  attackerShips?.topAttackerShips?.map((ship) => ({
                    id: ship.shipType?.id || 0,
                    name: ship.shipType?.name || 'Unknown',
                    killCount: ship.killCount,
                    dogmaAttributes: ship.shipType?.dogmaAttributes,
                  })) || []
                }
                loading={attackerShipsLoading}
                emptyText={card.emptyText}
              />
            );

          case 'ships':
            return (
              <TopShipsCard
                key={card.kind}
                title={card.title}
                subtitle={LAST_7_DAYS}
                ships={
                  ships?.topDestroyedShips?.map((ship) => ({
                    id: ship.shipType?.id || 0,
                    name: ship.shipType?.name || 'Unknown',
                    killCount: ship.killCount,
                    dogmaAttributes: ship.shipType?.dogmaAttributes,
                  })) || []
                }
                loading={shipsLoading}
                emptyText={card.emptyText}
              />
            );
        }
      })}
    </div>
  );
}
