"use client";

interface SecurityStats {
  highSec: number;
  lowSec: number;
  nullSec: number;
  wormhole?: number;
}

interface SecurityStatsBarProps {
  stats: SecurityStats;
  showLabels?: boolean;
  compact?: boolean;
}

export default function SecurityStatsBar({
  stats,
  showLabels = true,
  compact = false,
}: SecurityStatsBarProps) {
  const total =
    stats.highSec + stats.lowSec + stats.nullSec + (stats.wormhole || 0);

  if (total === 0) {
    return <span className="text-sm text-gray-500">No data</span>;
  }

  const highSecPercent = (stats.highSec / total) * 100;
  const lowSecPercent = (stats.lowSec / total) * 100;
  const nullSecPercent = (stats.nullSec / total) * 100;
  const wormholePercent = ((stats.wormhole || 0) / total) * 100;

  // Tooltip içeriği
  const tooltipContent = [
    stats.highSec > 0 ? `High: ${stats.highSec}` : null,
    stats.lowSec > 0 ? `Low: ${stats.lowSec}` : null,
    stats.nullSec > 0 ? `Null: ${stats.nullSec}` : null,
    (stats.wormhole || 0) > 0 ? `WH: ${stats.wormhole}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  if (compact) {
    return (
      <div className="flex items-center gap-3 text-xs">
        {stats.highSec > 0 && (
          <span className="text-green-400">{stats.highSec}</span>
        )}
        {stats.lowSec > 0 && (
          <span className="text-yellow-400">{stats.lowSec}</span>
        )}
        {stats.nullSec > 0 && (
          <span className="text-red-400">{stats.nullSec}</span>
        )}
        {(stats.wormhole || 0) > 0 && (
          <span className="text-purple-400">{stats.wormhole}</span>
        )}
      </div>
    );
  }

  return (
    <div className="w-full min-w-[120px]">
      {/* Progress Bar */}
      <div
        className="relative w-full h-4 overflow-hidden bg-gray-700 cursor-pointer"
        title={tooltipContent}
      >
        {/* Stacked bars using absolute positioning */}
        {highSecPercent > 0 && (
          <div
            className="absolute top-0 left-0 h-full bg-green-500"
            style={{ width: `${highSecPercent}%` }}
          />
        )}
        {lowSecPercent > 0 && (
          <div
            className="absolute top-0 h-full bg-yellow-500"
            style={{
              left: `${highSecPercent}%`,
              width: `${lowSecPercent}%`,
            }}
          />
        )}
        {nullSecPercent > 0 && (
          <div
            className="absolute top-0 h-full bg-red-500"
            style={{
              left: `${highSecPercent + lowSecPercent}%`,
              width: `${nullSecPercent}%`,
            }}
          />
        )}
        {wormholePercent > 0 && (
          <div
            className="absolute top-0 h-full bg-purple-500"
            style={{
              left: `${highSecPercent + lowSecPercent + nullSecPercent}%`,
              width: `${wormholePercent}%`,
            }}
          />
        )}
      </div>

      {/* Labels */}
      {showLabels && (
        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
          {stats.highSec > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500" />
              <span className="text-gray-400">{stats.highSec}</span>
            </div>
          )}
          {stats.lowSec > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-yellow-500" />
              <span className="text-gray-400">{stats.lowSec}</span>
            </div>
          )}
          {stats.nullSec > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-red-500" />
              <span className="text-gray-400">{stats.nullSec}</span>
            </div>
          )}
          {(stats.wormhole || 0) > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-purple-500" />
              <span className="text-gray-400">{stats.wormhole}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
