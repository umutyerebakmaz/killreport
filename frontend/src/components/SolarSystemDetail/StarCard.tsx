'use client';

export interface StarSummary {
  id: number;
  name?: string | null;
  spectralClass?: string | null;
  temperature?: number | null;
  radius?: number | null;
  type?: { id: number; name: string } | null;
}

interface StarCardProps {
  star?: StarSummary | null;
  starId?: number | null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-gray-400">{label}</dt>
      <dd className="text-gray-200">{value}</dd>
    </>
  );
}

export default function StarCard({ star, starId }: StarCardProps) {
  if (!star && !starId) return null;

  // The name arrives from a later worker. Until it does, fall back to the raw
  // identifier rather than hiding the card.
  if (!star?.name) {
    return (
      <div className="p-6 border bg-white/5 border-white/10">
        <div className="text-xs tracking-wide text-gray-400 uppercase">
          Star
        </div>
        <div className="mt-2 italic text-gray-500">
          Star {star?.id ?? starId}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 border bg-white/5 border-white/10">
      <div className="text-xs tracking-wide text-gray-400 uppercase">Star</div>
      <div className="mt-2 text-lg font-semibold text-gray-100">
        {star.name}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-sm">
        {star.type?.name && <Row label="Type" value={star.type.name} />}
        {star.spectralClass && (
          <Row label="Spectral class" value={star.spectralClass} />
        )}
        {star.temperature != null && (
          <Row
            label="Temperature"
            value={`${star.temperature.toLocaleString()} K`}
          />
        )}
        {star.radius != null && (
          <Row
            label="Radius"
            value={`${(star.radius / 1000).toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })} km`}
          />
        )}
      </dl>
    </div>
  );
}
