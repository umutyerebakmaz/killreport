"use client";

import Tooltip from "@/components/Tooltip/Tooltip";

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
    return <span className="text-gray-500 text-sm">No data</span>;
  }

  const highSecPercent = (stats.highSec / total) * 100;
  const lowSecPercent = (stats.lowSec / total) * 100;
  const nullSecPercent = (stats.nullSec / total) * 100;
  const wormholePercent = ((stats.wormhole || 0) / total) * 100;

  if (compact) {
    return (
      <div className="flex items-center gap-3 text-xs">
        {stats.highSec > 0 && (
          <Tooltip
            content={`High Sec: ${stats.highSec} systems`}
            position="top"
          >
            <span className="text-green-400">{stats.highSec}</span>
          </Tooltip>
        )}
        {stats.lowSec > 0 && (
          <Tooltip content={`Low Sec: ${stats.lowSec} systems`} position="top">
            <span className="text-yellow-400">{stats.lowSec}</span>
          </Tooltip>
        )}
        {stats.nullSec > 0 && (
          <Tooltip
            content={`Null Sec: ${stats.nullSec} systems`}
            position="top"
          >
            <span className="text-red-400">{stats.nullSec}</span>
          </Tooltip>
        )}
        {(stats.wormhole || 0) > 0 && (
          <Tooltip
            content={`Wormhole: ${stats.wormhole} systems`}
            position="top"
          >
            <span className="text-purple-400">{stats.wormhole}</span>
          </Tooltip>
        )}
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Progress Bar with inline numbers */}
      <Tooltip
        content={`High: ${stats.highSec} | Low: ${stats.lowSec} | Null: ${
          stats.nullSec
        }${stats.wormhole ? ` | WH: ${stats.wormhole}` : ""}`}
        position="top"
      >
        <div className="flex h-5 w-full overflow-hidden bg-gray-800 cursor-pointer">
          {highSecPercent > 0 && (
            <div
              className="bg-green-500/80 h-full flex items-center justify-center text-[10px] font-medium text-white overflow-hidden"
              style={{ width: `${highSecPercent}%` }}
            >
              {highSecPercent >= 15 && stats.highSec}
            </div>
          )}
          {lowSecPercent > 0 && (
            <div
              className="bg-yellow-500/80 h-full flex items-center justify-center text-[10px] font-medium text-gray-900 overflow-hidden"
              style={{ width: `${lowSecPercent}%` }}
            >
              {lowSecPercent >= 15 && stats.lowSec}
            </div>
          )}
          {nullSecPercent > 0 && (
            <div
              className="bg-red-500/80 h-full flex items-center justify-center text-[10px] font-medium text-white overflow-hidden"
              style={{ width: `${nullSecPercent}%` }}
            >
              {nullSecPercent >= 15 && stats.nullSec}
            </div>
          )}
          {wormholePercent > 0 && (
            <div
              className="bg-purple-500/80 h-full flex items-center justify-center text-[10px] font-medium text-white overflow-hidden"
              style={{ width: `${wormholePercent}%` }}
            >
              {wormholePercent >= 15 && stats.wormhole}
            </div>
          )}
        </div>
      </Tooltip>

      {/* Labels */}
      {showLabels && (
        <div className="flex items-center gap-4 mt-2 text-xs">
          {stats.highSec > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-gray-400">High: {stats.highSec}</span>
            </div>
          )}
          {stats.lowSec > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-gray-400">Low: {stats.lowSec}</span>
            </div>
          )}
          {stats.nullSec > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-gray-400">Null: {stats.nullSec}</span>
            </div>
          )}
          {(stats.wormhole || 0) > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <span className="text-gray-400">WH: {stats.wormhole}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
