import EveImage from '@/components/ui/EveImage';
import { MapOwnerKind } from '@/generated/graphql';
import { ownerKindOf } from '@/utils/map/sovColors';
import Link from 'next/link';

/**
 * Renders a link to an alliance page — its logo, its name and an optional
 * ticker — falling back to "#id" when the name hasn't been resolved yet and
 * "Unknown" when there's no id. Shared across the sovereignty dashboard,
 * history and structures pages.
 *
 * The logo follows MembershipLink: 20px beside the name, inside the one link,
 * with the name as the link's label so it is not announced twice. An NPC
 * faction — a territory change can name one — gets its crest down the
 * corporation path, as the image server serves it.
 */
export function AllianceLink({
  id,
  name,
  ticker,
}: {
  id?: number | null;
  name?: string | null;
  ticker?: string | null;
}) {
  if (!id) return <span className="text-ink-faint">Unknown</span>;
  const label = name ?? `#${id}`;
  return (
    <span className="inline-flex items-center min-w-0">
      <Link
        href={`/alliances/${id}`}
        prefetch={false}
        aria-label={label}
        className="inline-flex items-center min-w-0 gap-2 text-ink-muted hover:text-accent-link"
      >
        <EveImage
          kind={
            ownerKindOf(id) === MapOwnerKind.Faction
              ? 'corporation'
              : 'alliance'
          }
          id={id}
          name={label}
          size={20}
          className="flex-none"
        />
        <span className="truncate">{label}</span>
      </Link>
      {ticker && (
        <span className="ml-2 text-sm text-yellow-400">[{ticker}]</span>
      )}
    </span>
  );
}
