'use client';

import FactionCard from '@/components/Card/FactionCard';
import Loader from '@/components/Loader';
import { useFactionsQuery } from '@/generated/graphql';

export default function FactionsPage() {
  const { data, loading, error } = useFactionsQuery();

  if (loading)
    return <Loader size="lg" text="Loading factions..." className="p-8" />;
  if (error) return <div className="p-8">Error: {error.message}</div>;

  const factions = data?.factions ?? [];

  return (
    <div>
      <h1 className="sr-only">Factions</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-5">
        {factions.map((faction) => (
          <FactionCard key={faction.id} faction={faction} />
        ))}
      </div>
    </div>
  );
}
