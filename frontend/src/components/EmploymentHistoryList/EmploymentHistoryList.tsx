import Link from 'next/link';

import { CharacterCorporationHistoryQuery } from '@/generated/graphql';
import { formatEveDateTime } from '@/utils/date';
import { employmentDays } from '@/utils/employmentDays';
import Tooltip from '../Tooltip/Tooltip';

type Entries = CharacterCorporationHistoryQuery['characterCorporationHistory'];

interface EmploymentHistoryListProps {
  entries: Entries;
  now?: Date;
}

/**
 * A character's corporations, newest first, written the way the game's
 * Employment History does: "Kenshin. 2022.09.18 09:56 to 2026.01.17 18:13
 * (1217 Days)".
 */
export default function EmploymentHistoryList({
  entries,
  now = new Date(),
}: EmploymentHistoryListProps) {
  if (entries.length === 0) {
    return <p className="text-ink-muted">No employment history yet.</p>;
  }

  return (
    <ul className="space-y-1">
      {entries.map((entry) => (
        <li key={entry.recordId}>
          {entry.corporation ? (
            <Tooltip content="Show Corporation Info" position="top-start">
              <Link
                href={`/corporations/${entry.corporation.id}`}
                className="transition-colors hover:text-accent-link"
                prefetch={false}
              >
                {entry.corporation.name}
              </Link>
            </Tooltip>
          ) : (
            entry.corporationId
          )}
          {entry.isDeleted && ' (Closed)'} {formatEveDateTime(entry.startDate)}{' '}
          to {entry.endDate ? formatEveDateTime(entry.endDate) : 'this day'} (
          {employmentDays(entry.startDate, entry.endDate, now)} Days)
        </li>
      ))}
    </ul>
  );
}
