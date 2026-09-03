'use client';

import { Loader } from '@/components/Loader/Loader';
import { useSolarSystemOrbitalBodiesQuery } from '@/generated/graphql';

interface OrbitalBodiesTabProps {
  systemId: number;
}

/**
 * The name workers fill in later; until they have, a row still has correct
 * topology and is shown by its ID rather than hidden.
 */
function BodyLabel({
  name,
  id,
  kind,
}: {
  name?: string | null;
  id: number;
  kind: string;
}) {
  if (name) return <span className="text-gray-200">{name}</span>;
  return (
    <span className="italic text-gray-500">
      {kind} {id}
    </span>
  );
}

export default function OrbitalBodiesTab({ systemId }: OrbitalBodiesTabProps) {
  const { data, loading, error } = useSolarSystemOrbitalBodiesQuery({
    variables: { id: systemId },
  });

  if (loading) return <Loader size="md" text="Loading orbital bodies..." />;

  if (error) {
    return (
      <div className="p-6 border bg-white/5 border-white/10 text-red-400">
        Could not load orbital bodies: {error.message}
      </div>
    );
  }

  const planets = data?.solarSystem?.planets ?? [];

  if (planets.length === 0) {
    return (
      <div className="p-6 text-gray-400 border bg-white/5 border-white/10">
        This system has no planets.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {planets.map((planet) => {
        const moons = planet.moons ?? [];
        const belts = planet.asteroidBelts ?? [];
        const hasSatellites = moons.length > 0 || belts.length > 0;

        return (
          <details
            key={planet.id}
            className="border bg-white/5 border-white/10"
          >
            <summary
              className={`flex items-center justify-between gap-4 px-6 py-4 ${
                // A planet with nothing under it must not look like a broken
                // toggle.
                hasSatellites ? 'cursor-pointer' : 'cursor-default list-none'
              }`}
            >
              <span className="flex items-center gap-3">
                <span className="w-8 text-xs text-gray-500">
                  {planet.orbitIndex ?? '—'}
                </span>
                <BodyLabel name={planet.name} id={planet.id} kind="Planet" />
                {planet.type?.name && (
                  <span className="px-2 py-0.5 text-xs text-cyan-400 bg-cyan-400/10 border border-cyan-400/20">
                    {planet.type.name}
                  </span>
                )}
              </span>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {moons.length} moons · {belts.length} belts
              </span>
            </summary>

            {hasSatellites && (
              <div className="grid gap-6 px-6 pt-2 pb-6 border-t md:grid-cols-2 border-white/10">
                <div>
                  <h4 className="mt-4 mb-2 text-xs tracking-wide text-gray-400 uppercase">
                    Moons
                  </h4>
                  {moons.length === 0 ? (
                    <p className="text-sm text-gray-500">No moons.</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {moons.map((moon) => (
                        <li key={moon.id} className="flex gap-3">
                          <span className="w-6 text-xs text-gray-600">
                            {moon.orbitIndex ?? '—'}
                          </span>
                          <BodyLabel
                            name={moon.name}
                            id={moon.id}
                            kind="Moon"
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h4 className="mt-4 mb-2 text-xs tracking-wide text-gray-400 uppercase">
                    Asteroid belts
                  </h4>
                  {belts.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      No asteroid belts around this planet.
                    </p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {belts.map((belt) => (
                        <li key={belt.id} className="flex gap-3">
                          <span className="w-6 text-xs text-gray-600">
                            {belt.orbitIndex ?? '—'}
                          </span>
                          <BodyLabel
                            name={belt.name}
                            id={belt.id}
                            kind="Asteroid belt"
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
}
