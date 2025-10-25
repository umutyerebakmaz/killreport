"use client";

import { useAlliancesQuery } from "@/generated/graphql";
import Link from "next/link";

export default function AlliancesPage() {
  const { data, loading, error } = useAlliancesQuery({
    variables: { limit: 20 },
  });

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8">Error: {error.message}</div>;

  const alliances = data?.alliances || [];

  return (
    <main className="p-8">
      <h1 className="mb-4 text-2xl font-bold">Alliances</h1>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <table className="min-w-full border">
          <thead>
            <tr>
              <th className="px-2 py-1 border">Logo</th>
              <th className="px-2 py-1 border">Name</th>
              <th className="px-2 py-1 border">Ticker</th>
              <th className="px-2 py-1 border">Alliance ID</th>
            </tr>
          </thead>
          <tbody>
            {alliances.map((a) =>
              a ? (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-2 py-1 border">
                    <img
                      src={`https://images.evetech.net/Alliance/${a.id}_64.png`}
                      alt={a.name}
                      width={32}
                      height={32}
                    />
                  </td>
                  <td className="px-2 py-1 border">
                    <Link
                      href={`/alliances/${a.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {a.name}
                    </Link>
                  </td>
                  <td className="px-2 py-1 border">{a.ticker}</td>
                  <td className="px-2 py-1 border">{a.id}</td>
                </tr>
              ) : null
            )}
          </tbody>
        </table>
      )}
    </main>
  );
}
