import Tooltip from "@/components/Tooltip/Tooltip";
import { CharactersQuery } from "@/generated/graphql";
import { ShieldCheckIcon, UserIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

// useCharactersQuery'nin döndüğü Character type'ını extract et
type Character = CharactersQuery["characters"]["edges"][number]["node"];

type CharacterCardProps = {
  character: Character;
};

export default function CharacterCard({ character }: CharacterCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  // Security status rengi belirle
  const getSecurityStatusColor = (status: number | null | undefined) => {
    if (status === null || status === undefined) return "text-gray-400";
    if (status >= 5) return "text-blue-400";
    if (status >= 0) return "text-green-400";
    if (status >= -2) return "text-yellow-400";
    if (status >= -5) return "text-orange-400";
    return "text-red-400";
  };

  const securityStatus = character.security_status?.toFixed(1) ?? "N/A";
  const securityColor = getSecurityStatusColor(character.security_status);

  return (
    <div className="alliance-card">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-24 h-24">
            {!imageLoaded && (
              <div className="absolute inset-0 rounded animate-pulse bg-gray-800/50">
                <div className="flex items-center justify-center w-full h-full">
                  <UserIcon className="w-12 h-12 text-gray-700" />
                </div>
              </div>
            )}
            <Image
              src={`https://images.evetech.net/characters/${character.id}/portrait?size=128`}
              alt={character.name}
              width={96}
              height={96}
              className={`rounded transition-opacity duration-300 ${
                imageLoaded ? "opacity-100" : "opacity-0"
              }`}
              onLoad={() => setImageLoaded(true)}
              unoptimized
            />
          </div>
          <Link
            href={`/characters/${character.id}`}
            className="flex items-center justify-center h-12 text-sm font-semibold text-center text-gray-200 hover:text-cyan-400 line-clamp-2"
          >
            {character.name}
          </Link>

          <div className="flex flex-col items-center w-full gap-2">
            {/* Corporation */}
            {character.corporation && (
              <Tooltip content="Corporation" position="top">
                <Link
                  href={`/corporations/${character.corporation.id}`}
                  className="flex items-center gap-2 hover:text-cyan-400"
                >
                  <span className="text-xs text-gray-300 line-clamp-1">
                    {character.corporation.name}
                  </span>
                </Link>
              </Tooltip>
            )}

            {/* Alliance */}
            {character.alliance && (
              <Tooltip content="Alliance" position="top">
                <Link
                  href={`/alliances/${character.alliance.id}`}
                  className="flex items-center gap-2 hover:text-cyan-400"
                >
                  <span className="text-xs font-bold text-yellow-400 line-clamp-1">
                    [{character.alliance.ticker}]
                  </span>
                </Link>
              </Tooltip>
            )}
          </div>

          <div className="flex items-center justify-center w-full pt-3 border-t border-white/10">
            {/* Security Status */}
            <Tooltip content="Security Status" position="top">
              <div className="flex items-center gap-2">
                <ShieldCheckIcon className={`w-5 h-5 ${securityColor}`} />
                <span className={`text-sm font-medium ${securityColor}`}>
                  {securityStatus}
                </span>
              </div>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
