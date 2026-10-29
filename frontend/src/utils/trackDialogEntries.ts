import { TrackedEntityType, type KillmailQuery } from '@/generated/graphql';

export type TrackDialogEntry = {
  type: TrackedEntityType;
  id: number;
  name: string;
  section?: string;
  role?: string;
};

/** Splits entries by type. The first `(type, id)` seen wins; order is kept. */
export function groupTrackDialogEntries(
  entries: TrackDialogEntry[],
): Record<TrackedEntityType, TrackDialogEntry[]> {
  const groups: Record<TrackedEntityType, TrackDialogEntry[]> = {
    [TrackedEntityType.Character]: [],
    [TrackedEntityType.Corporation]: [],
    [TrackedEntityType.Alliance]: [],
  };
  const seen = new Set<string>();
  for (const entry of entries) {
    const key = `${entry.type}:${entry.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    groups[entry.type].push(entry);
  }
  return groups;
}

type Named = { id: number | string; name: string } | null | undefined;

function participants(
  who:
    | { character?: Named; corporation?: Named; alliance?: Named }
    | null
    | undefined,
  section: string,
  role?: string,
): TrackDialogEntry[] {
  const out: TrackDialogEntry[] = [];
  if (!who) return out;
  const add = (type: TrackedEntityType, entity: Named) => {
    if (entity)
      out.push({
        type,
        id: Number(entity.id),
        name: entity.name,
        section,
        role,
      });
  };
  add(TrackedEntityType.Character, who.character);
  add(TrackedEntityType.Corporation, who.corporation);
  add(TrackedEntityType.Alliance, who.alliance);
  return out;
}

/** Victim first, then attackers, tagged with their final blow / top damage role. */
export function killmailTrackEntries(
  km: Pick<NonNullable<KillmailQuery['killmail']>, 'victim' | 'attackers'>,
): TrackDialogEntry[] {
  const entries = participants(km.victim, 'VICTIM');

  let top = -1;
  let topDamage = 0;
  km.attackers.forEach((a, i) => {
    if (a.damageDone > topDamage) {
      topDamage = a.damageDone;
      top = i;
    }
  });

  km.attackers.forEach((a, i) => {
    const role = a.finalBlow
      ? 'final blow'
      : i === top
        ? 'top damage'
        : undefined;
    entries.push(...participants(a, 'ATTACKERS', role));
  });
  return entries;
}
