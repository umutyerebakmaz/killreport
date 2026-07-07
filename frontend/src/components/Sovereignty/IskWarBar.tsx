import { formatISK } from "@/utils/formatISK";

/**
 * Two-color bar showing which side is bleeding more ISK in a sovereignty
 * campaign: defender-side losses (cyan) vs attacker/third-party losses (red).
 * The wider segment is the side losing the ISK war.
 */
export function IskWarBar({
  defenderLost,
  attackerLost,
}: {
  defenderLost: number;
  attackerLost: number;
}) {
  const total = defenderLost + attackerLost;
  if (total <= 0) return <span className="text-sm text-gray-600">No ISK destroyed yet</span>;
  const dPct = Math.round((defenderLost / total) * 100);
  return (
    <div className="max-w-md">
      <div className="flex justify-between mb-1 text-xs">
        <span className="text-cyan-400">Defender lost {formatISK(defenderLost)}</span>
        <span className="text-red-400">Attacker lost {formatISK(attackerLost)}</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded bg-neutral-800">
        <div className="bg-cyan-500" style={{ width: `${dPct}%` }} />
        <div className="bg-red-500" style={{ width: `${100 - dPct}%` }} />
      </div>
    </div>
  );
}
