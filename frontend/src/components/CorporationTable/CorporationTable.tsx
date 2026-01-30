import { AllianceCorporationsQuery, Corporation } from "@/generated/graphql";
import Loader from "../Loader";
import Link from "next/link";
import TotalMemberBadge from "../TotalMemberBadge/TotalMemberBadge";

interface CorporationTableProps {
  corporations: AllianceCorporationsQuery["corporations"];
  loading: boolean;
}

export default function CorporationTable({
  corporations,
  loading,
}: CorporationTableProps) {
  if (loading) {
    return (
      <Loader size="md" text="Loading corporations..." className="py-12" />
    );
  }

  if (corporations?.length) {
    return (
      <div className="py-12 text-center text-gray-400">
        No corporation found
      </div>
    );
  }

  return (
    <div className="mt-6 overflow-hidden border border-white/10">
      <table className="table">
        <thead className="bg-white/5">
          <tr>
            <th className="th-cell">Corporation</th>
            <th className="th-cell">Ticker</th>
            <th className="th-cell">Members</th>
            <th className="th-cell">CEO</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {corporations.map((corp) => (
            <tr key={corp.id} className="transition-colors hover:bg-white/5">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <img
                    src={`https://images.evetech.net/Corporation/${corp.id}_64.png`}
                    alt={corp.name}
                    width={32}
                    height={32}
                  />
                  <Link
                    href={`/corporations/${corp.id}`}
                    prefetch={false}
                    className="text-cyan-400 hover:text-cyan-300"
                  >
                    {corp.name}
                  </Link>
                </div>
              </td>
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
                    className="text-cyan-400 hover:text-cyan-300"
                  >
                    {corp.ceo.name}
                  </Link>
                ) : (
                  <span className="text-gray-500">N/A</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
