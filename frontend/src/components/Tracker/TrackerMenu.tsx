'use client';

import { CloseButton } from '@headlessui/react';
import { LockClosedIcon, XMarkIcon } from '@heroicons/react/20/solid';
import Link from 'next/link';

import { NavPopover } from '@/components/Header/NavPopover';
import EveImage from '@/components/ui/EveImage';
import { TrackedEntityType } from '@/generated/graphql';
import { useTracker } from '@/hooks/useTracker';

type Row = {
  type: TrackedEntityType;
  id: number;
  name: string;
  automatic: boolean;
};

type Group = {
  label: string;
  kind: 'corporation' | 'alliance' | 'character';
  path: string;
  rows: Row[];
};

const EMPTY_NOTE =
  'Add characters, corporations and alliances with the TRACK button on their pages.';

// A row lights up the way NavPopoverLink does, on hover and on keyboard focus
// of the link inside it. The panel's own max-height keeps a long list on screen.
const ROW =
  'relative flex items-center py-2 pl-4 pr-3 group gap-x-3 text-sm/6 hover:bg-cyan-900/50 has-[a:focus-visible]:bg-cyan-900/50 has-[button:focus-visible]:bg-cyan-900/50';

function TrackerRow({
  row,
  group,
  onUntrack,
}: {
  row: Row;
  group: Group;
  onUntrack: (type: TrackedEntityType, id: number) => void;
}) {
  return (
    <div className={ROW}>
      <EveImage kind={group.kind} id={row.id} name={row.name} size={24} />
      <CloseButton
        as={Link}
        href={`/${group.path}/${row.id}?tab=killmails`}
        className="flex-auto font-medium text-white truncate focus:outline-none"
      >
        {row.name}
        <span className="absolute inset-0" />
      </CloseButton>
      {row.automatic ? (
        <LockClosedIcon
          aria-hidden="true"
          className="relative flex-none size-4 text-ink-muted"
        />
      ) : (
        <button
          type="button"
          aria-label={`Untrack ${row.name}`}
          onClick={() => onUntrack(row.type, row.id)}
          className="relative flex-none text-ink-muted hover:text-white focus:outline-none focus-visible:text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
        >
          <XMarkIcon aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  );
}

export default function TrackerMenu({
  variant,
}: {
  variant: 'header' | 'drawer';
}) {
  const { signedIn, data, untrack } = useTracker();
  if (!signedIn) return null;

  const allGroups: Group[] = [
    {
      label: 'CORPORATIONS',
      kind: 'corporation',
      path: 'corporations',
      rows: (data?.corporations ?? []).map((e) => ({
        type: TrackedEntityType.Corporation,
        id: Number(e.corporation.id),
        name: e.corporation.name,
        automatic: e.automatic,
      })),
    },
    {
      label: 'ALLIANCES',
      kind: 'alliance',
      path: 'alliances',
      rows: (data?.alliances ?? []).map((e) => ({
        type: TrackedEntityType.Alliance,
        id: Number(e.alliance.id),
        name: e.alliance.name,
        automatic: e.automatic,
      })),
    },
    {
      label: 'CHARACTERS',
      kind: 'character',
      path: 'characters',
      rows: (data?.characters ?? []).map((e) => ({
        type: TrackedEntityType.Character,
        id: Number(e.character.id),
        name: e.character.name,
        automatic: e.automatic,
      })),
    },
  ];
  const groups = allGroups.filter((g) => g.rows.length > 0);

  const hasManual = groups.some((g) => g.rows.some((r) => !r.automatic));

  const list = (
    <div className="max-h-[70vh] overflow-y-auto">
      {groups.map((group) => (
        <section key={group.label} className="mb-2 last:mb-0">
          <h3 className="px-4 py-1 text-xs font-medium tracking-wider text-ink-muted">
            {group.label}
          </h3>
          {group.rows.map((row) => (
            <TrackerRow
              key={`${row.type}:${row.id}`}
              row={row}
              group={group}
              onUntrack={untrack}
            />
          ))}
        </section>
      ))}
      {!hasManual && (
        <p className="px-4 py-2 text-sm text-ink-muted">{EMPTY_NOTE}</p>
      )}
    </div>
  );

  if (variant === 'drawer') {
    return (
      <div>
        <p className="py-2 font-medium text-white text-base/7">TRACKER</p>
        {list}
      </div>
    );
  }

  // TRACKER owns no route of its own, so it never lights up as the section
  // the page belongs to.
  return (
    <NavPopover label="TRACKER" match={[]}>
      {list}
    </NavPopover>
  );
}
