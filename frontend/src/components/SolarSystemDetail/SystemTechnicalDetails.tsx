'use client';

const METRES_PER_AU = 149_597_870_700;

interface SystemTechnicalDetailsProps {
  systemId: number;
  starId?: number | null;
  securityClass?: string | null;
  securityStatus?: number | null;
  position?: { x: number; y: number; z: number } | null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-gray-400">{label}</dt>
      <dd className="font-mono text-gray-200 break-all">{value}</dd>
    </>
  );
}

export default function SystemTechnicalDetails({
  systemId,
  starId,
  securityClass,
  securityStatus,
  position,
}: SystemTechnicalDetailsProps) {
  return (
    <details className="p-6 border bg-white/5 border-white/10">
      <summary className="text-sm font-semibold tracking-wide text-gray-300 uppercase cursor-pointer">
        Technical details
      </summary>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 mt-4 text-sm">
        <Row label="System ID" value={String(systemId)} />
        <Row label="Star ID" value={starId != null ? String(starId) : '—'} />
        {/* Wormhole systems have no security class; the dash is a real case. */}
        <Row label="Security class" value={securityClass ?? '—'} />
        <Row
          label="Security status"
          value={securityStatus != null ? securityStatus.toFixed(10) : '—'}
        />
        {position && (
          <>
            <Row
              label="Position (m)"
              value={`x ${position.x.toExponential(4)}  y ${position.y.toExponential(4)}  z ${position.z.toExponential(4)}`}
            />
            <Row
              label="Position (AU)"
              value={`x ${(position.x / METRES_PER_AU).toFixed(2)}  y ${(position.y / METRES_PER_AU).toFixed(2)}  z ${(position.z / METRES_PER_AU).toFixed(2)}`}
            />
          </>
        )}
      </dl>
    </details>
  );
}
