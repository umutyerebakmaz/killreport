"use client";

import { Loader } from "@/components/Loader/Loader";
import Tooltip from "@/components/Tooltip/Tooltip";
import { getSecurityStatusColor } from "@/utils/securityStatus";
import Link from "next/link";
import { ReactNode } from "react";

export interface TopCharacter {
  id: number;
  name: string;
  killCount: number;
  securityStatus?: number | null;
  corporation?: {
    id: number;
    name: string;
  } | null;
  alliance?: {
    id: number;
    name: string;
  } | null;
}

export interface TopCharacterCardProps {
  title: string;
  subtitle?: ReactNode;
  characters: TopCharacter[];
  loading?: boolean;
  emptyText?: string;
}

export default function TopCharacterCard({
  title,
  subtitle,
  characters,
  loading = false,
  emptyText = "No characters",
}: TopCharacterCardProps) {
  if (loading) {
    return (
      <div>
        <div className="py-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {subtitle && (
            <p className="flex items-center justify-between text-xs text-gray-500">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="top-character-card">
      <div className="py-4 border-b border-white/10">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {subtitle && (
          <p className="flex items-center justify-between text-xs text-gray-500">
            {subtitle}
          </p>
        )}
      </div>

      {characters.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500">
          <p className="text-sm font-medium text-center">{emptyText}</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-white/5">
          {characters.map((character, index) => {
            const secColor = getSecurityStatusColor(character.securityStatus);
            return (
              <div
                key={character.id}
                className="p-3 transition-colors duration-100 bg-neutral-900 hover:bg-neutral-800"
              >
                <div className="flex items-center gap-3">
                  {/* Rank */}
                  <div className="flex items-center justify-center w-8 shrink-0">
                    <span
                      className={`text-xl font-black tabular-nums ${
                        index === 0
                          ? "text-yellow-400"
                          : index === 1
                            ? "text-gray-300"
                            : index === 2
                              ? "text-amber-600"
                              : "text-gray-600"
                      }`}
                    >
                      #{index + 1}
                    </span>
                  </div>

                  {/* Portrait */}
                  <div className="relative shrink-0">
                    <img
                      src={`https://images.evetech.net/characters/${character.id}/portrait?size=128`}
                      alt={character.name}
                      width={48}
                      height={48}
                      className="shadow-md bg-black/50 ring-1 ring-black/50"
                      loading="lazy"
                    />
                    {character.securityStatus != null && (
                      <div className="absolute bottom-0 left-0 px-1 py-0 text-xs font-semibold bg-black/70 backdrop-blur-sm">
                        <span className={secColor}>
                          {character.securityStatus.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex items-center justify-between flex-1 min-w-0 gap-2">
                    <div className="flex flex-col min-w-0 gap-0.5 leading-tight">
                      <Tooltip
                        content="Show character info"
                        className="w-full! min-w-0"
                      >
                        <Link
                          href={`/characters/${character.id}?tab=killmails`}
                          className="block min-w-0 font-medium leading-tight text-gray-400 truncate hover:text-blue-400"
                          prefetch={false}
                        >
                          {character.name}
                        </Link>
                      </Tooltip>
                      {character.corporation && (
                        <Tooltip
                          content="Show corporation info"
                          className="w-full! min-w-0"
                        >
                          <Link
                            href={`/corporations/${character.corporation.id}?tab=killmails`}
                            className="block text-sm leading-tight text-gray-500 truncate hover:text-blue-400"
                            prefetch={false}
                          >
                            {character.corporation.name}
                          </Link>
                        </Tooltip>
                      )}
                      {character.alliance && (
                        <Tooltip
                          content="Show alliance info"
                          className="w-full! min-w-0"
                        >
                          <Link
                            href={`/alliances/${character.alliance.id}?tab=killmails`}
                            className="block text-sm leading-tight text-gray-500 truncate hover:text-blue-400"
                            prefetch={false}
                          >
                            {character.alliance.name}
                          </Link>
                        </Tooltip>
                      )}
                    </div>

                    {/* Kill Count */}
                    <span className="text-base font-semibold text-gray-400 tabular-nums whitespace-nowrap shrink-0">
                      {character.killCount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
