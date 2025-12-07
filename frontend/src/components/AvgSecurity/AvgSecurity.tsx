export default function AvgSecurity({
  avgSecurity,
}: {
  avgSecurity: number | null;
}) {
  return avgSecurity !== null && avgSecurity !== undefined ? (
    <span
      className={`${
        avgSecurity >= 0.5
          ? "text-green-400"
          : avgSecurity > 0
          ? "text-yellow-400"
          : "text-red-400"
      }`}
    >
      {avgSecurity.toFixed(2)}
    </span>
  ) : (
    <span className="text-purple-400">W-Space</span>
  );
}
