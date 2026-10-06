import Tooltip from '@/components/Tooltip/Tooltip';
import Card from '@/components/ui/Card';
import MembershipLink from '@/components/ui/MembershipLink';
import { CharactersQuery } from '@/generated/graphql';
import Link from 'next/link';
import EveImage from '../ui/EveImage';

// Extract the Character type returned by useCharactersQuery
type Character = CharactersQuery['characters']['items'][number];

type CharacterCardProps = {
  character: Character;
};

export default function CharacterCard({ character }: CharacterCardProps) {
  return (
    // The killmail's victim card: the portrait as wide as the card and
    // square, the name and memberships over its darkened bottom band.
    <Card className="overflow-hidden">
      <div className="relative w-full overflow-hidden aspect-square bg-surface-inset">
        {/* tooltip.css is unlayered, so its fit-content width beats a plain
            utility; the ! is what lets the trigger fill the portrait. */}
        <Tooltip
          content="Show Character Info"
          position="top-right"
          className="block! size-full!"
        >
          <Link
            href={`/characters/${character.id}`}
            className="block size-full"
            prefetch={false}
          >
            <EveImage
              kind="character"
              id={character.id}
              name={character.name}
              size={256}
              className="object-cover size-full"
            />
          </Link>
        </Tooltip>
        <div className="absolute inset-x-0 bottom-0 h-24 pointer-events-none bg-linear-to-t from-black/95 via-black/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-3 space-y-1.5">
          {/* The trigger is inline-block and as wide as its content; max-w-full
              keeps it inside the card so truncate still has an edge to cut at. */}
          <Tooltip content="Show Character Info" className="max-w-full">
            <Link
              href={`/characters/${character.id}`}
              className="block text-[2rem] font-medium text-white truncate transition-colors hover:text-accent-link"
              prefetch={false}
            >
              {character.name}
            </Link>
          </Tooltip>
          {(character.corporation || character.alliance) && (
            <div className="flex items-center gap-3">
              {character.corporation && (
                <Tooltip content="Show Corporation Info" className="min-w-0">
                  <MembershipLink
                    kind="corporation"
                    logoSize={32}
                    entity={character.corporation}
                    prefetch={false}
                  />
                </Tooltip>
              )}
              {character.alliance && (
                <Tooltip content="Show Alliance Info" className="min-w-0">
                  <MembershipLink
                    kind="alliance"
                    logoSize={32}
                    entity={character.alliance}
                    prefetch={false}
                  />
                </Tooltip>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
