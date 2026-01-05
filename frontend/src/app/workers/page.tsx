"use client";

import Loader from "@/components/Loader";
import { useWorkerStatusSubscriptionSubscription } from "@/generated/graphql";
import { useState } from "react";

interface QueueInfo {
  name: string;
  messageCount: number;
  consumerCount: number;
  active: boolean;
  workerRunning: boolean;
  workerPid?: number | null;
  workerName?: string | null;
}

// Format queue name for display
function formatQueueName(name: string): string {
  return name
    .replace(/_queue$/, "") // Remove _queue suffix
    .replace(/^(esi|zkillboard|redisq)_/, "") // Remove prefix
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function WorkersPage() {
  const [isConnected, setIsConnected] = useState(false);

  // GraphQL Yoga SSE subscription - real-time updates
  const { data, loading, error } = useWorkerStatusSubscriptionSubscription({
    onData: () => {
      if (!isConnected) {
        setIsConnected(true);
        console.log("✅ SSE connected - receiving real-time updates");
      }
    },
    onError: (err: any) => {
      setIsConnected(false);
      console.error("❌ SSE error:", err);
    },
  });

  if (loading && !data) {
    return (
      <Loader
        size="lg"
        text="Connecting to SSE stream..."
        className="min-h-100"
      />
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <div className="text-center">
          <p className="text-red-500">Error connecting to SSE stream</p>
          <p className="mt-2 text-sm text-gray-400">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 mt-4 text-white bg-blue-600 hover:bg-blue-700"
          >
            Reconnect
          </button>
        </div>
      </div>
    );
  }

  const workerStatus = data?.workerStatusUpdates;
  const queues = workerStatus?.queues || [];
  const standaloneWorkers = workerStatus?.standaloneWorkers || [];

  // Group queues by type
  const esiInfoQueues = queues.filter(
    (q: QueueInfo) =>
      q.name.includes("_info_queue") && q.name.startsWith("esi_")
  );

  const esiBulkQueues = queues.filter(
    (q: QueueInfo) =>
      (q.name.includes("_all_") ||
        q.name.includes("_alliance_corporations_")) &&
      q.name.startsWith("esi_")
  );

  const esiUniverseQueues = queues.filter(
    (q: QueueInfo) =>
      (q.name.includes("_regions_") ||
        q.name.includes("_constellations_") ||
        q.name.includes("_systems_")) &&
      q.name.startsWith("esi_")
  );

  const zkillQueues = queues.filter(
    (q: QueueInfo) =>
      q.name.startsWith("zkillboard_") || q.name.startsWith("redisq_")
  );

  const otherQueues = queues.filter(
    (q: QueueInfo) =>
      !q.name.startsWith("esi_") &&
      !q.name.startsWith("zkillboard_") &&
      !q.name.startsWith("redisq_")
  );

  return (
    <div className="container mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="mb-2 text-4xl font-bold text-white">
            Worker Status Monitor
          </h1>
          <p className="text-gray-400">
            Real-time monitoring via SSE (Server-Sent Events)
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700">
            <div
              className={`w-3 h-3 rounded-full ${
                isConnected ? "bg-green-500 animate-pulse" : "bg-yellow-500"
              }`}
            ></div>
            <span className="text-sm text-gray-300">
              {isConnected ? "🔴 Live" : "🔄 Connecting..."}
            </span>
          </div>
        </div>
      </div>

      <div className="p-6 mb-6 border border-gray-800 bg-gray-900/50">
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

      {esiInfoQueues.length > 0 && (
        <QueueSection
          title="ESI Info Workers"
          subtitle="Entity enrichment (characters, corporations, alliances, types)"
          queues={esiInfoQueues}
        />
      )}

      {esiBulkQueues.length > 0 && (
        <QueueSection
          title="ESI Bulk Sync Workers"
          subtitle="Full alliance/corporation synchronization"
          queues={esiBulkQueues}
        />
      )}

      {esiUniverseQueues.length > 0 && (
        <QueueSection
          title="ESI Universe Workers"
          subtitle="Regions, constellations, solar systems"
          queues={esiUniverseQueues}
        />
      )}

      {zkillQueues.length > 0 && (
        <QueueSection
          title="zKillboard Workers"
          subtitle="Killmail streaming and historical sync"
          queues={zkillQueues}
        />
      )}

      {otherQueues.length > 0 && (
        <QueueSection title="Other Workers" queues={otherQueues} />
      )}

      {standaloneWorkers.length > 0 && (
        <StandaloneWorkerSection workers={standaloneWorkers} />
      )}

      {queues.length === 0 && standaloneWorkers.length === 0 && (
        <div className="p-12 text-center border border-gray-800 bg-gray-900/50">
          <p className="text-gray-400">No workers found</p>
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
    <div className={`p-4 border  ${colorClasses[color]}`}>
      <div className="text-sm font-medium text-gray-400">{label}</div>
      <div className="mt-1 text-3xl font-bold">{value.toLocaleString()}</div>
    </div>
  );
}

function StandaloneWorkerSection({ workers }: any) {
  return (
    <div className="mb-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-white">Standalone Workers</h2>
        <p className="mt-1 text-sm text-gray-400">
          Long-running processes (not RabbitMQ-based)
        </p>
      </div>
      <div className="overflow-hidden border border-gray-800 ">
        <table className="w-full">
          <thead className="bg-gray-900/50">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">
                Worker Name
              </th>
              <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-400 uppercase">
                Description
              </th>
              <th className="px-4 py-3 text-xs font-semibold tracking-wider text-center text-gray-400 uppercase">
                Process ID
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {workers.map((worker: any) => (
              <tr
                key={worker.name}
                className="transition-colors hover:bg-gray-900/30"
              >
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        worker.running ? "bg-green-500" : "bg-gray-500"
                      }`}
                    ></div>
                    <span
                      className={`text-sm font-medium ${
                        worker.running ? "text-green-400" : "text-gray-500"
                      }`}
                    >
                      {worker.running ? "Running" : "Stopped"}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="text-sm font-medium text-gray-300">
                    {worker.name}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className="text-sm text-gray-400">
                    {worker.description}
                  </span>
                </td>
                <td className="px-4 py-4 text-center">
                  {worker.pid ? (
                    <span className="inline-flex items-center px-3 py-1 font-mono text-sm font-semibold text-blue-400 rounded-full bg-blue-500/20">
                      {worker.pid}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-500">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QueueSection({ title, subtitle, queues }: any) {
  return (
    <div className="mb-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-gray-400">{subtitle}</p>}
      </div>
      <div className="overflow-hidden border border-gray-800 ">
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
              <tr
                key={queue.name}
                className="transition-colors hover:bg-gray-900/30"
              >
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
                  <div className="text-sm font-medium text-gray-300">
                    {formatQueueName(queue.name)}
                  </div>
                  <div className="mt-0.5 text-xs font-mono text-gray-500">
                    {queue.name}
                  </div>
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
