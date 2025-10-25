"use client";

import { gql, useQuery } from "@apollo/client";

interface Alliance {
  id: number;
  name: string;
  ticker: string;
  date_founded: string;
  creator_corporation_id: number;
  creator_id: number;
  executor_corporation_id: number;
  faction_id?: number;
}

const ALLIANCES_QUERY = gql`
  query Alliances($after: Int, $limit: Int) {
    alliances(after: $after, limit: $limit) {
      id
      name
      ticker
      date_founded
      creator_corporation_id
      creator_id
      executor_corporation_id
      faction_id
    }
  }
`;

export default function AlliancesPage() {
  const { data, loading, error } = useQuery(ALLIANCES_QUERY, {
    variables: { after: null, limit: 20 },
  });

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8">Error: {error.message}</div>;

  const alliances: Alliance[] = data?.alliances || [];

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
            {alliances.map((a) => (
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
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
