/**
 * A two-color horizontal bar showing defender (cyan) vs attacker (red) share of
 * a sovereignty campaign's score. Scores are 0..1 fractions from ESI.
 * Shared across the sovereignty dashboard and campaign participant lists.
 */
export function ScoreBar({
  defender,
  attackers,
}: {
  defender?: number | null;
  attackers?: number | null;
}) {
  const d = defender ?? 0;
  const a = attackers ?? 0;
  const total = d + a || 1;
  const dPct = Math.round((d / total) * 100);
  return (
    <div className="w-40">
      <div className="flex h-2 overflow-hidden rounded bg-neutral-800">
        <div className="bg-cyan-500" style={{ width: `${dPct}%` }} />
        <div className="bg-red-500" style={{ width: `${100 - dPct}%` }} />
      </div>
      <div className="flex justify-between mt-1 text-xs">
        <span className="text-cyan-400">{Math.round(d * 100)}% def</span>
        <span className="text-red-400">{Math.round(a * 100)}% atk</span>
      </div>
    </div>
  );
}
