"use client";

import { useCorporationsQuery } from "@/generated/graphql";
import Link from "next/link";

export default function CorporationsPage() {
  const { data, loading, error } = useCorporationsQuery({
    variables: {
      first: 20,
    },
  });

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Corporations</h1>
          <div className="animate-pulse">Loading corporations...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Corporations</h1>
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
            Error: {error.message}
          </div>
        </div>
      </div>
    );
  }

  const corporations = data?.corporations.edges || [];

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Corporations</h1>

        <div className="bg-blue-50 border border-blue-200 text-blue-700 p-4 rounded mb-6">
          <p className="font-semibold">💡 DataLoader Test</p>
          <p className="text-sm mt-1">
            Bu sayfa {corporations.length} corporation'ı alliance bilgileri ile
            birlikte gösteriyor. Backend console'da "🔄 DataLoader: Batching X
            alliance queries" mesajını göreceksin!
          </p>
        </div>

        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Corporation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ticker
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Members
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Alliance
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {corporations.map((corp) => (
                <tr key={corp.node.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {corp.node.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {corp.node.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      {corp.node.ticker}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {corp.node.member_count?.toLocaleString() || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {corp.node.alliance ? (
                      <Link
                        href={`/alliances/${corp.node.alliance.id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        [{corp.node.alliance.ticker}] {corp.node.alliance.name}
                      </Link>
                    ) : (
                      <span className="text-gray-400">No Alliance</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
