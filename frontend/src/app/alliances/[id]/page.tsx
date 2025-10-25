"use client";

import { gql, useQuery } from "@apollo/client";

const ALLIANCE_QUERY = gql`
  query Alliance($id: Int!) {
    alliance(id: $id) {
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

interface AllianceDetailPageProps {
  params: { id: string };
}

export default function AllianceDetailPage({
  params,
}: AllianceDetailPageProps) {
  const { data, loading, error } = useQuery(ALLIANCE_QUERY, {
    variables: { id: parseInt(params.id) },
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-600">Error: {error.message}</div>
      </div>
    );
  }

  const alliance = data?.alliance;

  if (!alliance) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Alliance not found</div>
      </div>
    );
  }

  return (
    <main className="container p-8 mx-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header with logo and basic info */}
        <div className="flex items-start gap-6 mb-8">
          <img
            src={`https://images.evetech.net/Alliance/${alliance.id}_128.png`}
            alt={alliance.name}
            width={128}
            height={128}
            className="rounded-lg shadow-md"
          />
          <div className="flex-1">
            <h1 className="mb-2 text-4xl font-bold">{alliance.name}</h1>
            <p className="mb-4 text-2xl text-gray-600">[{alliance.ticker}]</p>
            <div className="text-sm text-gray-500">
              Alliance ID: {alliance.id}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="p-6 bg-white rounded-lg shadow">
            <h2 className="mb-4 text-xl font-semibold">Basic Information</h2>
            <dl className="space-y-2">
              <div>
                <dt className="font-medium text-gray-600">Date Founded</dt>
                <dd className="text-gray-900">
                  {new Date(alliance.date_founded).toLocaleDateString()}
                </dd>
              </div>
              {alliance.faction_id && (
                <div>
                  <dt className="font-medium text-gray-600">Faction ID</dt>
                  <dd className="text-gray-900">{alliance.faction_id}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="p-6 bg-white rounded-lg shadow">
            <h2 className="mb-4 text-xl font-semibold">Leadership</h2>
            <dl className="space-y-2">
              <div>
                <dt className="font-medium text-gray-600">Creator ID</dt>
                <dd className="text-gray-900">{alliance.creator_id}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-600">
                  Creator Corporation ID
                </dt>
                <dd className="text-gray-900">
                  {alliance.creator_corporation_id}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-600">
                  Executor Corporation ID
                </dt>
                <dd className="text-gray-900">
                  {alliance.executor_corporation_id}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </main>
  );
}
