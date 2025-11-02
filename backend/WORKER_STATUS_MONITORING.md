# Worker Status Monitoring

Real-time monitoring for background workers and RabbitMQ queues.

## Features

- 📊 **Queue Statistics**: Message count, consumer count per queue
- 🔄 **Real-time Updates**: GraphQL subscriptions every 5 seconds
- ✅ **Health Check**: Overall system health status
- 🎯 **Multiple Queues**: Monitor alliance, corporation, and zkillboard queues

## GraphQL API

### Query: Get Current Status

```graphql
query GetWorkerStatus {
  workerStatus {
    timestamp
    healthy
    queues {
      name
      messageCount
      consumerCount
      active
    }
  }
}
```

**Example Response:**

```json
{
  "data": {
    "workerStatus": {
      "timestamp": "2025-11-02T22:45:00.000Z",
      "healthy": true,
      "queues": [
        {
          "name": "killmail_sync_queue",
          "messageCount": 5,
          "consumerCount": 1,
          "active": true
        },
        {
          "name": "alliance_sync_queue",
          "messageCount": 0,
          "consumerCount": 0,
          "active": false
        },
        {
          "name": "corporation_sync_queue",
          "messageCount": 0,
          "consumerCount": 0,
          "active": false
        }
      ]
    }
  }
}
```

### Subscription: Real-time Updates

```graphql
subscription WatchWorkerStatus {
  workerStatusUpdates {
    timestamp
    healthy
    queues {
      name
      messageCount
      consumerCount
      active
    }
  }
}
```

This subscription emits updates every 5 seconds with current queue statistics.

## Testing

### 1. Using GraphQL Playground

Visit: http://localhost:4000/graphql

**Query Tab:**

```graphql
query {
  workerStatus {
    timestamp
    healthy
    queues {
      name
      messageCount
      active
    }
  }
}
```

**Subscription Tab:**

```graphql
subscription {
  workerStatusUpdates {
    timestamp
    healthy
    queues {
      name
      messageCount
      consumerCount
      active
    }
  }
}
```

### 2. Using curl

```bash
# Get current status
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ workerStatus { timestamp healthy queues { name messageCount consumerCount active } } }"}'
```

### 3. Frontend Integration

```typescript
// Query
const GET_WORKER_STATUS = gql`
  query GetWorkerStatus {
    workerStatus {
      timestamp
      healthy
      queues {
        name
        messageCount
        consumerCount
        active
      }
    }
  }
`;

// Subscription
const WORKER_STATUS_SUBSCRIPTION = gql`
  subscription WatchWorkerStatus {
    workerStatusUpdates {
      timestamp
      healthy
      queues {
        name
        messageCount
        consumerCount
        active
      }
    }
  }
`;

// React Component
function WorkerMonitor() {
  const { data } = useSubscription(WORKER_STATUS_SUBSCRIPTION);

  return (
    <div>
      <h2>
        Worker Status:{" "}
        {data?.workerStatusUpdates.healthy ? "✅ Healthy" : "❌ Down"}
      </h2>
      {data?.workerStatusUpdates.queues.map((queue) => (
        <div key={queue.name}>
          <strong>{queue.name}</strong>: {queue.messageCount} messages,{" "}
          {queue.consumerCount} workers
        </div>
      ))}
    </div>
  );
}
```

## Queue Names

| Queue Name               | Purpose                  | Worker Command             |
| ------------------------ | ------------------------ | -------------------------- |
| `killmail_sync_queue`    | zKillboard killmail sync | `yarn worker:zkillboard`   |
| `alliance_sync_queue`    | Alliance data sync       | `yarn worker:alliances`    |
| `corporation_sync_queue` | Corporation data sync    | `yarn worker:corporations` |

## Monitoring Dashboard Ideas

- **Traffic Light**: Green/Yellow/Red based on queue depth
- **Graph**: Message count over time
- **Alerts**: Notification when workers go offline
- **Load**: Avg processing time per queue

## Implementation Details

- **Polling Interval**: 5 seconds
- **Health Check**: At least one active consumer = healthy
- **Auto-reconnect**: Subscription reconnects on disconnect
- **No Auth Required**: Public monitoring endpoint (add auth if needed)
