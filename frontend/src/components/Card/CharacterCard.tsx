import Tooltip from "@/components/Tooltip/Tooltip";
import { CharactersQuery } from "@/generated/graphql";
import { getSecurityStatusColor } from "@/utils/securityStatus";
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

  const securityStatus = character.security_status?.toFixed(1) ?? "N/A";
  const securityColor = getSecurityStatusColor(character.security_status);

  return (
    <div className="character-card">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-24 h-24">
            {!imageLoaded && (
              <div className="absolute inset-0 animate-pulse bg-gray-800/50">
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
              className={`transition-opacity duration-300 ${
                imageLoaded ? "opacity-100" : "opacity-0"
              }`}
              onLoad={() => setImageLoaded(true)}
              unoptimized
            />
          </div>
          <Link
            href={`/characters/${character.id}`}
            className="character-name"
            prefetch={false}
          >
            {character.name}
          </Link>

          <div className="flex flex-col items-center w-full gap-2 min-h-11">
            {/* Corporation */}
            <div className="h-5">
              {character.corporation && (
                <Tooltip content="Corporation" position="top">
                  <Link
                    href={`/corporations/${character.corporation.id}`}
                    className="flex items-center gap-2 hover:text-cyan-400"
                    prefetch={false}
                  >
                    <span className="text-base text-green-400 line-clamp-1">
                      {character.corporation.name}
                    </span>
                  </Link>
                </Tooltip>
              )}
            </div>

            {/* Alliance */}
            <div className="h-5">
              {character.alliance && (
                <Tooltip content="Alliance" position="top">
                  <Link
                    href={`/alliances/${character.alliance.id}`}
                    className="flex items-center gap-2 hover:text-cyan-400"
                    prefetch={false}
                  >
                    <span className="text-base text-yellow-400 line-clamp-1">
                      {character.alliance.name}
                    </span>
                  </Link>
                </Tooltip>
              )}
            </div>
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
