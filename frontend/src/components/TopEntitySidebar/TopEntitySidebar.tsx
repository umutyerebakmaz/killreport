"use client";

import TopAllianceCard from "@/components/TopAllianceCard/TopAllianceCard";
import TopCharacterCard from "@/components/TopCharacterCard/TopCharacterCard";
import TopCorporationCard from "@/components/TopCorporationCard/TopCorporationCard";
import TopShipsCard from "@/components/TopShipsCard/TopShipsCard";
import {
  useTopLast7DaysAlliancesQuery,
  useTopLast7DaysAttackerShipsQuery,
  useTopLast7DaysCorporationsQuery,
  useTopLast7DaysPilotsQuery,
  useTopLast7DaysShipsQuery,
} from "@/generated/graphql";

/**
 * The scope the cards are computed over. These are exactly the fields the
 * TopLast7Days* filters accept — there is no allianceId or corporationId, which
 * is why the alliance and corporation pages have their own entity-scoped
 * sidebars rather than using this one.
 */
export interface TopEntityFilter {
  systemId?: number;
  constellationId?: number;
  regionId?: number;
  limit?: number;
}

export type TopEntityCardKind =
  | "characters"
  | "corporations"
  | "alliances"
  | "attackerShips"
  | "ships";

export interface TopEntityCardSpec {
  kind: TopEntityCardKind;
  title: string;
  emptyText: string;
}

interface TopEntitySidebarProps {
  filter?: TopEntityFilter;
  /** Cards to render, in order. Each one is a separate query. */
  cards: TopEntityCardSpec[];
  variant?: "detail" | "list";
}

const ROLLING_SUBTITLE = (
  <>
    Last 7 days{" "}
    <span className="px-1.5 py-0.5 text-xs font-semibold text-orange-400 bg-orange-400/10 border border-orange-400/20">
      ROLLING
    </span>
  </>
);

export default function TopEntitySidebar({
  filter,
  cards,
  variant = "detail",
}: TopEntitySidebarProps) {
  const { limit = 10, ...scope } = filter ?? {};
  const variables = { filter: { limit, ...scope } };

  // Every hook is called unconditionally and skipped when its card is not
  // requested: hooks cannot be called from inside the cards.map() below.
  const has = (kind: TopEntityCardKind) => cards.some((c) => c.kind === kind);

  const { data: pilots, loading: pilotsLoading } = useTopLast7DaysPilotsQuery({
    variables,
    skip: !has("characters"),
  });
  const { data: corporations, loading: corporationsLoading } =
    useTopLast7DaysCorporationsQuery({
      variables,
      skip: !has("corporations"),
    });
  const { data: alliances, loading: alliancesLoading } =
    useTopLast7DaysAlliancesQuery({ variables, skip: !has("alliances") });
  const { data: attackerShips, loading: attackerShipsLoading } =
    useTopLast7DaysAttackerShipsQuery({
      variables,
      skip: !has("attackerShips"),
    });
  const { data: ships, loading: shipsLoading } = useTopLast7DaysShipsQuery({
    variables,
    skip: !has("ships"),
  });

  return (
    <div className="space-y-6">
      {cards.map((card) => {
        switch (card.kind) {
          case "characters":
            return (
              <TopCharacterCard
                key={card.kind}
                title={card.title}
                subtitle={ROLLING_SUBTITLE}
                characters={
                  pilots?.topLast7DaysPilots?.map((pilot) => ({
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
                loading={pilotsLoading}
                emptyText={card.emptyText}
                variant={variant}
              />
            );

          case "corporations":
            return (
              <TopCorporationCard
                key={card.kind}
                title={card.title}
                subtitle={ROLLING_SUBTITLE}
                corporations={
                  corporations?.topLast7DaysCorporations?.map((corp) => ({
                    id: corp.corporation?.id || 0,
                    name: corp.corporation?.name || "Unknown",
                    ticker: corp.corporation?.ticker,
                    killCount: corp.killCount,
                  })) || []
                }
                loading={corporationsLoading}
                emptyText={card.emptyText}
                variant={variant}
              />
            );

          case "alliances":
            return (
              <TopAllianceCard
                key={card.kind}
                title={card.title}
                subtitle={ROLLING_SUBTITLE}
                alliances={
                  alliances?.topLast7DaysAlliances?.map((alliance) => ({
                    id: alliance.alliance?.id || 0,
                    name: alliance.alliance?.name || "Unknown",
                    ticker: alliance.alliance?.ticker,
                    killCount: alliance.killCount,
                  })) || []
                }
                loading={alliancesLoading}
                emptyText={card.emptyText}
                variant={variant}
              />
            );

          // Ships flown by the attackers, as opposed to the ships that died.
          case "attackerShips":
            return (
              <TopShipsCard
                key={card.kind}
                title={card.title}
                subtitle={ROLLING_SUBTITLE}
                ships={
                  attackerShips?.topLast7DaysAttackerShips?.map((ship) => ({
                    id: ship.shipType?.id || 0,
                    name: ship.shipType?.name || "Unknown",
                    killCount: ship.killCount,
                    dogmaAttributes: ship.shipType?.dogmaAttributes,
                  })) || []
                }
                loading={attackerShipsLoading}
                emptyText={card.emptyText}
                variant={variant}
              />
            );

          case "ships":
            return (
              <TopShipsCard
                key={card.kind}
                title={card.title}
                subtitle={ROLLING_SUBTITLE}
                ships={
                  ships?.topLast7DaysShips?.map((ship) => ({
                    id: ship.shipType?.id || 0,
                    name: ship.shipType?.name || "Unknown",
                    killCount: ship.killCount,
                    dogmaAttributes: ship.shipType?.dogmaAttributes,
                  })) || []
                }
                loading={shipsLoading}
                emptyText={card.emptyText}
                variant={variant}
              />
            );
        }
      })}
    </div>
  );
}
