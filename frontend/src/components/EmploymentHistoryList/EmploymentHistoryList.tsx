import Link from 'next/link';

import { CharacterCorporationHistoryQuery } from '@/generated/graphql';
import { formatEveDateTime } from '@/utils/date';
import { employmentDays } from '@/utils/employmentDays';
import Tooltip from '../Tooltip/Tooltip';
import EveImage from '../ui/EveImage';

type Entries = CharacterCorporationHistoryQuery['characterCorporationHistory'];

interface EmploymentHistoryListProps {
  entries: Entries;
  now?: Date;
}

/**
 * A character's corporations, newest first. Each row is the corporation's
 * logo, then its name and ticker over the dates it was held and the length of
 * the stay: "Kenshin. [300M]" / "2022.09.18 09:56 to 2026.01.17 18:13 (1217
 * Days)".
 */
export default function EmploymentHistoryList({
  entries,
  now = new Date(),
}: EmploymentHistoryListProps) {
  if (entries.length === 0) {
    return <p className="text-ink-muted">No employment history yet.</p>;
  }

  return (
    <ul className="divide-y divide-white/5 text-ink-muted">
      {entries.map((entry) => (
        <li
          key={entry.recordId}
          className="flex items-center gap-3 p-3 transition-colors duration-100 hover:bg-surface-inset"
        >
          <EveImage
            kind="corporation"
            id={entry.corporationId}
            name={entry.corporation?.name ?? String(entry.corporationId)}
            size={32}
          />
          <div className="flex-1 min-w-0">
            <div>
              {entry.corporation ? (
                <>
                  <Tooltip content="Show Corporation Info" position="top-start">
                    <Link
                      href={`/corporations/${entry.corporation.id}`}
                      className="transition-colors hover:text-accent-link"
                      prefetch={false}
                    >
                      {entry.corporation.name}
                    </Link>
                  </Tooltip>{' '}
                  <span>[{entry.corporation.ticker}]</span>
                </>
              ) : (
                <span>{entry.corporationId}</span>
              )}
              {entry.isDeleted && ' (Closed)'}
            </div>
            <div className="text-sm">
              {`${formatEveDateTime(entry.startDate)} to ${
                entry.endDate ? formatEveDateTime(entry.endDate) : 'this day'
              } (${employmentDays(entry.startDate, entry.endDate, now)} Days)`}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
