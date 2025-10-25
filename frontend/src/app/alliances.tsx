import { useEffect, useState } from "react";

interface Alliance {
  alliance_id: number;
  name: string;
  ticker: string;
  faction_id?: number;
}

export default function AlliancesPage() {
  const [alliances, setAlliances] = useState<Alliance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/alliances")
      .then((res) => res.json())
      .then((data) => {
        setAlliances(data);
        setLoading(false);
      });
  }, []);

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
              <tr key={a.alliance_id}>
                <td className="px-2 py-1 border">
                  <img
                    src={`https://images.evetech.net/alliance/${a.alliance_id}_64.png`}
                    alt={a.name}
                    width={32}
                    height={32}
                  />
                </td>
                <td className="px-2 py-1 border">{a.name}</td>
                <td className="px-2 py-1 border">{a.ticker}</td>
                <td className="px-2 py-1 border">{a.alliance_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
