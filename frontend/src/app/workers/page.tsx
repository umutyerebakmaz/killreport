'use client';

import Loader from '@/components/Loader';
import { useWorkerStatusSubscriptionSubscription } from '@/generated/graphql';
import { useState } from 'react';

interface QueueInfo {
  name: string;
  messageCount: number;
  consumerCount: number;
  active: boolean;
  health: 'OK' | 'STALLED';
  workerRunning: boolean;
  workerPid?: number | null;
  workerName?: string | null;
}

// Format queue name for display
function formatQueueName(name: string): string {
  return name
    .replace(/_queue$/, '') // Remove _queue suffix
    .replace(/^(esi|zkillboard|redisq)_/, '') // Remove prefix
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Format uptime in seconds to human readable format
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

// Format large numbers (e.g., 593100 -> "593.1K")
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

export default function WorkersPage() {
  const [isConnected, setIsConnected] = useState(false);

  // GraphQL Yoga SSE subscription - real-time updates
  const { data, loading, error } = useWorkerStatusSubscriptionSubscription({
    onData: () => {
      if (!isConnected) {
        setIsConnected(true);
        console.log('✅ SSE connected - receiving real-time updates');
      }
    },
    onError: (err: any) => {
      setIsConnected(false);
      console.error('❌ SSE error:', err);
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
          <p className="text-danger">Error connecting to SSE stream</p>
          <p className="mt-2 text-sm text-ink-muted">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="button button-primary mt-4"
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
      (q.name.includes('_info_queue') || q.name.includes('_price_queue')) &&
      q.name.startsWith('esi_'),
  );

  const esiSyncQueues = queues.filter(
    (q: QueueInfo) =>
      q.name.includes('_alliance_corporations_') && q.name.startsWith('esi_'),
  );

  const esiUniverseQueues = queues.filter(
    (q: QueueInfo) =>
      (q.name.includes('_regions_') ||
        q.name.includes('_constellations_') ||
        q.name.includes('_solar_systems_')) &&
      q.name.startsWith('esi_'),
  );

  const zkillQueues = queues.filter(
    (q: QueueInfo) =>
      q.name.startsWith('zkillboard_') || q.name.startsWith('redisq_'),
  );

  const backfillQueues = queues.filter((q: QueueInfo) =>
    q.name.includes('backfill_'),
  );

  const otherQueues = queues.filter(
    (q: QueueInfo) =>
      !q.name.startsWith('esi_') &&
      !q.name.startsWith('zkillboard_') &&
      !q.name.startsWith('redisq_') &&
      !q.name.includes('backfill_'),
  );

  return (
    <div>
      <h1 className="sr-only">Worker Status Monitor</h1>
      <div className="flex items-center justify-end mb-8">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-surface-inset border border-white/10">
            <div
              className={`w-3 h-3 rounded-full ${
                isConnected ? 'bg-success animate-pulse' : 'bg-caution'
              }`}
            ></div>
            <span className="text-sm text-gray-300">
              {isConnected ? 'Live' : 'Connecting...'}
            </span>
          </div>
        </div>
      </div>

      <div className="p-6 mb-6 border border-white/5 bg-surface">
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-lg font-medium text-white">System Health</h2>
            <p className="text-sm text-ink-muted">
              Last updated:{' '}
              {workerStatus?.timestamp
                ? new Date(workerStatus.timestamp).toLocaleString()
                : 'N/A'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`w-4 h-4 rounded-full ${
                workerStatus?.healthy ? 'bg-success' : 'bg-danger'
              } animate-pulse`}
            ></div>
            {/* This panel is bg-surface, where EVE's red measures 3.93:1 —
                under the 4.5 floor this text needs (18px/500 isn't
                large-bold) — accepted per the spec's contrast trade-off. */}
            <span
              className={`text-lg font-medium ${
                workerStatus?.healthy ? 'text-success' : 'text-danger'
              }`}
            >
              {workerStatus?.healthy ? 'Healthy' : 'Unhealthy'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 mt-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
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
              0,
            )}
            color="yellow"
          />
          <StatCard
            label="Processing"
            value={queues.reduce(
              (sum: number, q: QueueInfo) => sum + q.consumerCount,
              0,
            )}
            color="purple"
          />
          <StatCard
            label="Database Size"
            value={
              workerStatus?.databaseSizeMB
                ? workerStatus.databaseSizeMB >= 1024
                  ? `${(workerStatus.databaseSizeMB / 1024).toFixed(2)} GB`
                  : `${workerStatus.databaseSizeMB.toFixed(2)} MB`
                : '0.00 MB'
            }
            color="cyan"
          />
        </div>
      </div>

      {/* Redis Cache Status */}
      {workerStatus?.redis && (
        <div className="p-6 mb-6 border border-white/5 bg-surface">
          <div className="flex flex-col items-start justify-between gap-4 mb-6 lg:flex-row lg:items-center">
            <div className="flex items-center gap-3">
              <div
                className={`w-4 h-4 rounded-full ${
                  workerStatus.redis.connected
                    ? 'bg-success animate-pulse'
                    : 'bg-danger'
                }`}
              ></div>
              <h2 className="text-lg font-medium text-white">
                Redis Cache Status
              </h2>
            </div>
            {/* bg-surface again — same 3.93:1 floor as System Health above */}
            <span
              className={`text-sm font-medium ${
                workerStatus.redis.connected ? 'text-success' : 'text-red-400'
              }`}
            >
              {workerStatus.redis.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <StatCard
              label="Cached Keys"
              value={workerStatus.redis.totalKeys}
              color="blue"
            />
            <StatCard
              label="Connected Clients"
              value={workerStatus.redis.connectedClients}
              color="green"
            />
            <StatCard
              label="Total Commands"
              value={formatNumber(workerStatus.redis.totalCommandsProcessed)}
              color="yellow"
            />
            <StatCard
              label="Commands/sec"
              value={workerStatus.redis.commandsPerSecond}
              color="purple"
            />
            <StatCard
              label="Memory Used"
              value={workerStatus.redis.memoryUsage}
              color="cyan"
            />
          </div>
        </div>
      )}

      {standaloneWorkers.length > 0 && (
        <StandaloneWorkerSection workers={standaloneWorkers} />
      )}

      {zkillQueues.length > 0 && (
        <QueueSection
          title="zKillboard Workers"
          subtitle="Killmail streaming and historical sync"
          queues={zkillQueues}
        />
      )}

      {esiInfoQueues.length > 0 && (
        <QueueSection
          title="ESI Info Workers"
          subtitle="Entity enrichment (characters, corporations, alliances, types)"
          queues={esiInfoQueues}
        />
      )}

      {esiSyncQueues.length > 0 && (
        <QueueSection
          title="ESI Sync Workers"
          subtitle="Alliance corporation synchronization"
          queues={esiSyncQueues}
        />
      )}

      {esiUniverseQueues.length > 0 && (
        <QueueSection
          title="ESI Universe Workers"
          subtitle="Regions, constellations, solar systems"
          queues={esiUniverseQueues}
        />
      )}

      {backfillQueues.length > 0 && (
        <QueueSection
          title="Maintenance & Backfill Workers"
          subtitle="Historical data processing and value recalculation"
          queues={backfillQueues}
        />
      )}

      {otherQueues.length > 0 && (
        <QueueSection title="Other Workers" queues={otherQueues} />
      )}

      {queues.length === 0 && standaloneWorkers.length === 0 && (
        <div className="p-12 text-center border border-white/5 bg-surface/50">
          <p className="text-ink-muted">No workers found</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: any) {
  const colorClasses: any = {
    blue: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
    green: 'border-green-500/30 bg-green-500/10 text-green-400',
    yellow: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
    purple: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
    cyan: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400',
    orange: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
    pink: 'border-pink-500/30 bg-pink-500/10 text-pink-400',
    indigo: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400',
    teal: 'border-teal-500/30 bg-teal-500/10 text-teal-400',
  };

  return (
    <div className={`p-4 border  ${colorClasses[color]}`}>
      <div className="text-sm font-medium text-ink-muted">{label}</div>
      <div className="mt-1 text-3xl font-bold">
        {typeof value === 'string' ? value : value.toLocaleString()}
      </div>
    </div>
  );
}

function StandaloneWorkerSection({ workers }: any) {
  return (
    <div className="mb-6">
      <div className="mb-4">
        <h2 className="text-xl font-medium text-white">Standalone Workers</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Long-running processes (not RabbitMQ-based)
        </p>
      </div>
      <div className="overflow-x-auto border border-white/5">
        <table className="w-full min-w-max">
          <thead className="bg-surface-inset">
            <tr>
              <th className="px-2 py-3 text-xs font-medium tracking-wider text-left text-ink-muted uppercase md:px-4">
                Status
              </th>
              <th className="px-2 py-3 text-xs font-medium tracking-wider text-left text-ink-muted uppercase md:px-4">
                Worker Name
              </th>
              <th className="px-2 py-3 text-xs font-medium tracking-wider text-left text-ink-muted uppercase md:px-4">
                Description
              </th>
              <th className="px-2 py-3 text-xs font-medium tracking-wider text-center text-ink-muted uppercase md:px-4">
                Process ID
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {workers.map((worker: any) => (
              <tr key={worker.name} className="tr-row">
                <td className="px-2 py-4 md:px-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        worker.running ? 'bg-success' : 'bg-ink-faint'
                      }`}
                    ></div>
                    <span
                      className={`text-xs md:text-sm font-medium ${
                        worker.running ? 'text-success' : 'text-ink-faint'
                      }`}
                    >
                      {worker.running ? 'Running' : 'Stopped'}
                    </span>
                  </div>
                </td>
                <td className="px-2 py-4 md:px-4">
                  <div className="text-xs font-medium text-gray-300 md:text-sm">
                    {worker.name}
                  </div>
                </td>
                <td className="px-2 py-4 md:px-4">
                  <span className="text-xs text-ink-muted md:text-sm">
                    {worker.description}
                  </span>
                </td>
                <td className="px-2 py-4 text-center md:px-4">
                  {worker.pid ? (
                    <span className="inline-flex items-center px-2 py-1 font-mono text-xs font-medium text-blue-400 rounded-full md:px-3 md:text-sm bg-blue-500/20">
                      {worker.pid}
                    </span>
                  ) : (
                    <span className="text-xs text-ink-faint md:text-sm">-</span>
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
        <h2 className="text-xl font-medium text-white">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      <div className="overflow-x-auto border border-white/5">
        <table className="w-full min-w-max">
          <thead className="bg-surface-inset">
            <tr>
              <th className="px-2 py-3 text-xs font-medium tracking-wider text-left text-ink-muted uppercase md:px-4">
                Queue Status
              </th>
              <th className="px-2 py-3 text-xs font-medium tracking-wider text-left text-ink-muted uppercase md:px-4">
                Worker Process
              </th>
              <th className="px-2 py-3 text-xs font-medium tracking-wider text-left text-ink-muted uppercase md:px-4">
                Queue Name
              </th>
              <th className="px-2 py-3 text-xs font-medium tracking-wider text-center text-ink-muted uppercase md:px-4">
                Pending Jobs
              </th>
              <th className="px-2 py-3 text-xs font-medium tracking-wider text-center text-ink-muted uppercase md:px-4">
                Consumers
              </th>
              <th className="px-2 py-3 text-xs font-medium tracking-wider text-center text-ink-muted uppercase md:px-4">
                PID
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {queues.map((queue: QueueInfo) => (
              <tr
                key={queue.name}
                className={`tr-row ${queue.health === 'STALLED' ? 'bg-danger/10' : ''}`}
              >
                <td className="px-2 py-4 md:px-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        queue.active ? 'bg-success' : 'bg-ink-faint'
                      }`}
                    ></div>
                    <span
                      className={`text-xs md:text-sm font-medium ${
                        queue.active ? 'text-success' : 'text-ink-faint'
                      }`}
                    >
                      {queue.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </td>
                <td className="px-2 py-4 md:px-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        queue.workerRunning ? 'bg-blue-500' : 'bg-gray-600'
                      }`}
                    ></div>
                    <span
                      className={`text-xs md:text-sm font-medium ${
                        queue.workerRunning ? 'text-blue-400' : 'text-ink-faint'
                      }`}
                    >
                      {queue.workerRunning ? 'Running' : 'Stopped'}
                    </span>
                  </div>
                  {queue.workerName && (
                    <div className="mt-0.5 text-xs font-mono text-ink-faint">
                      {queue.workerName}
                    </div>
                  )}
                </td>
                <td className="px-2 py-4 md:px-4">
                  <div className="text-xs font-medium text-gray-300 md:text-sm">
                    {formatQueueName(queue.name)}
                  </div>
                  <div className="mt-0.5 text-xs font-mono text-ink-faint">
                    {queue.name}
                  </div>
                </td>
                <td className="px-2 py-4 text-center md:px-4">
                  <span
                    className={`inline-flex items-center px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-medium ${
                      queue.messageCount > 0
                        ? 'bg-caution/20 text-caution'
                        : 'bg-surface-inset text-ink-muted'
                    }`}
                  >
                    {queue.messageCount.toLocaleString()}
                  </span>
                  {queue.health === 'STALLED' && (
                    <span
                      className="ml-2 text-xs text-danger"
                      title="Messages waiting, no consumer"
                    >
                      stalled
                    </span>
                  )}
                </td>
                <td className="px-2 py-4 text-center md:px-4">
                  <span
                    className={`inline-flex items-center px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-medium ${
                      queue.consumerCount > 0
                        ? 'bg-success/20 text-success'
                        : 'bg-surface-inset text-ink-muted'
                    }`}
                  >
                    {queue.consumerCount}
                  </span>
                </td>
                <td className="px-2 py-4 text-center md:px-4">
                  {queue.workerPid ? (
                    <span className="inline-flex items-center px-2 py-1 font-mono text-xs font-medium text-blue-400 rounded-full md:px-3 md:text-sm bg-blue-500/20">
                      {queue.workerPid}
                    </span>
                  ) : (
                    <span className="text-xs text-ink-faint md:text-sm">-</span>
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
