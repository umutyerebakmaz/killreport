"use client";

import { useWorkerStatusQuery } from "@/generated/graphql";
import { useState } from "react";

interface QueueInfo {
  name: string;
  messageCount: number;
  consumerCount: number;
  active: boolean;
}

export default function WorkersPage() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(2000);

  const { data, loading, error, refetch } = useWorkerStatusQuery({
    pollInterval: autoRefresh ? refreshInterval : 0,
  });

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 rounded-full animate-spin border-t-transparent"></div>
          <p className="mt-4 text-gray-400">Loading worker status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-500">Error loading worker status</p>
          <p className="mt-2 text-sm text-gray-400">{error.message}</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 mt-4 text-white bg-blue-600 rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const workerStatus = data?.workerStatus;
  const queues = workerStatus?.queues || [];

  const esiQueues = queues.filter((q: QueueInfo) => q.name.startsWith("esi_"));
  const zkillQueues = queues.filter((q: QueueInfo) =>
    q.name.startsWith("zkillboard_")
  );
  const otherQueues = queues.filter(
    (q: QueueInfo) =>
      !q.name.startsWith("esi_") && !q.name.startsWith("zkillboard_")
  );

  return (
    <div className="container mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="mb-2 text-4xl font-bold text-white">
            Worker Status Monitor
          </h1>
          <p className="text-gray-400">
            Real-time monitoring of background job queues
          </p>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 rounded cursor-pointer"
            />
            <span className="text-sm text-gray-300">
              {autoRefresh ? "🔴 Auto-refresh" : "⏸️ Paused"}
            </span>
          </label>

          {autoRefresh && (
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="px-3 py-1 text-sm text-white bg-gray-800 border border-gray-700 rounded cursor-pointer hover:bg-gray-700"
            >
              <option value={1000}>1s</option>
              <option value={2000}>2s</option>
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
            </select>
          )}

          <button
            onClick={() => refetch()}
            className="px-4 py-2 text-sm text-white transition-colors bg-blue-600 rounded hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh Now"}
          </button>
        </div>
      </div>

      <div className="p-6 mb-6 border border-gray-800 rounded-lg bg-gray-900/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">System Health</h2>
            <p className="text-sm text-gray-400">
              Last updated:{" "}
              {workerStatus?.timestamp
                ? new Date(workerStatus.timestamp).toLocaleString()
                : "N/A"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`w-4 h-4 rounded-full ${
                workerStatus?.healthy ? "bg-green-500" : "bg-red-500"
              } animate-pulse`}
            ></div>
            <span
              className={`text-lg font-semibold ${
                workerStatus?.healthy ? "text-green-500" : "text-red-500"
              }`}
            >
              {workerStatus?.healthy ? "Healthy" : "Unhealthy"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-6">
          <StatCard label="Total Queues" value={queues.length} color="blue" />
          <StatCard
            label="Active Workers"
            value={queues.filter((q: QueueInfo) => q.active).length}
            color="green"
          />
          <StatCard
            label="Pending Jobs"
            value={queues.reduce(
              (sum: number, q: QueueInfo) => sum + q.messageCount,
              0
            )}
            color="yellow"
          />
          <StatCard
            label="Processing"
            value={queues.reduce(
              (sum: number, q: QueueInfo) => sum + q.consumerCount,
              0
            )}
            color="purple"
          />
        </div>
      </div>

      {esiQueues.length > 0 && (
        <QueueSection title="EVE ESI Queues" queues={esiQueues} />
      )}

      {zkillQueues.length > 0 && (
        <QueueSection title="zKillboard Queues" queues={zkillQueues} />
      )}

      {otherQueues.length > 0 && (
        <QueueSection title="Other Queues" queues={otherQueues} />
      )}

      {queues.length === 0 && (
        <div className="p-12 text-center border border-gray-800 rounded-lg bg-gray-900/50">
          <p className="text-gray-400">No queues found</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: any) {
  const colorClasses: any = {
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-400",
    green: "border-green-500/30 bg-green-500/10 text-green-400",
    yellow: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
    purple: "border-purple-500/30 bg-purple-500/10 text-purple-400",
  };

  return (
    <div className={`p-4 border rounded-lg ${colorClasses[color]}`}>
      <div className="text-sm font-medium text-gray-400">{label}</div>
      <div className="mt-1 text-3xl font-bold">{value.toLocaleString()}</div>
    </div>
  );
}

function QueueSection({ title, queues }: any) {
  return (
    <div className="mb-6">
      <h2 className="mb-4 text-xl font-semibold text-white">{title}</h2>
      <div className="overflow-hidden border border-gray-800 rounded-lg">
        <table className="w-full">
          <thead className="bg-gray-900/50">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">
                Queue Name
              </th>
              <th className="px-4 py-3 text-xs font-semibold tracking-wider text-center text-gray-400 uppercase">
                Pending Jobs
              </th>
              <th className="px-4 py-3 text-xs font-semibold tracking-wider text-center text-gray-400 uppercase">
                Active Workers
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {queues.map((queue: QueueInfo) => (
              <tr key={queue.name} className="transition-colors hover:bg-gray-900/30">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        queue.active ? "bg-green-500" : "bg-gray-500"
                      }`}
                    ></div>
                    <span
                      className={`text-sm font-medium ${
                        queue.active ? "text-green-400" : "text-gray-500"
                      }`}
                    >
                      {queue.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="font-mono text-sm text-gray-300">{queue.name}</div>
                </td>
                <td className="px-4 py-4 text-center">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                      queue.messageCount > 0
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-gray-800 text-gray-400"
                    }`}
                  >
                    {queue.messageCount.toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-4 text-center">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                      queue.consumerCount > 0
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-gray-800 text-gray-400"
                    }`}
                  >
                    {queue.consumerCount}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
