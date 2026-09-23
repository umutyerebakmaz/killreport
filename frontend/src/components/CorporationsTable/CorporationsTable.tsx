import { AllianceCorporationsQuery } from '@/generated/graphql';
import Link from 'next/link';
import Loader from '../Loader';
import TotalMemberBadge from '../TotalMemberBadge/TotalMemberBadge';
import EveImage from '../ui/EveImage';

// Extract the Killmail type from the GraphQL query result
export type Corporation = NonNullable<
  AllianceCorporationsQuery['corporations']['items'][number]
>;

interface CorporationsTableProps {
  corporations: Corporation[];
  loading: boolean;
}

export default function CorporationsTable({
  corporations,
  loading,
}: CorporationsTableProps) {
  if (loading) {
    return (
      <Loader size="md" text="Loading corporations..." className="py-12" />
    );
  }

  if (corporations.length === 0) {
    return (
      <div className="py-12 text-center text-ink-muted">
        No corporation found
      </div>
    );
  }

  return (
    <div className="mt-6 overflow-hidden border border-white/10">
      <table className="table">
        <thead className="bg-surface-inset">
          <tr>
            <th className="text-left th-cell">Corporation</th>
            <th className="text-left th-cell">Ticker</th>
            <th className="text-left th-cell">Members</th>
            <th className="text-left th-cell">CEO</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {corporations.map((corp) => (
            <tr key={corp.id} className="tr-row">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <EveImage
                    kind="corporation"
                    id={corp.id}
                    name={corp.name}
                    size={32}
                  />
                  <Link
                    href={`/corporations/${corp.id}`}
                    prefetch={false}
                    className="text-ink-muted hover:text-accent-link"
                  >
                    {corp.name}
                  </Link>
                </div>
              </td>
              {/* corp.ticker, not isk's — a ticker label, same as the other ticker sites */}
              <td className="px-6 py-4 text-sm text-yellow-400 whitespace-nowrap">
                [{corp.ticker}]
              </td>
              <td className="px-6 py-4 text-sm text-gray-300 whitespace-nowrap">
                <TotalMemberBadge count={corp.member_count} />
              </td>
              <td className="px-6 py-4 text-sm whitespace-nowrap">
                {corp.ceo ? (
                  <Link
                    href={`/characters/${corp.ceo.id}`}
                    prefetch={false}
                    className="text-ink-muted hover:text-accent-link"
                  >
                    {corp.ceo.name}
                  </Link>
                ) : (
                  <span className="text-ink-faint">N/A</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
