# Alliance Sync - Simplified Workflow

## 🎯 What Does It Do?

1. **Fetches the full alliance list from ESI**
2. **Adds them to a RabbitMQ queue**
3. **Worker reads from the queue**
4. **For each alliance:**
   - Checks if it exists in the database
   - If not, fetches details from ESI
   - Saves to the database
5. **Works without hitting the rate limit**

## 🚀 Usage

### 1. Add Alliances to the Queue

```bash
cd backend && yarn queue:alliances
```

This command:

- Fetches all alliance IDs from ESI (~4000+ alliances)
- Adds them to the RabbitMQ queue
- Exits

### 2. Start the Worker

```bash
yarn worker:alliances
```

This command:

- Reads alliance IDs from RabbitMQ
- Checks each one (does it exist in the database?)
- If not, fetches from ESI and saves
- Respects the rate limit (10 requests per second)
- Runs until you stop it with Ctrl+C

### 3. Monitor Progress

While the worker is running, you'll see in the console:

```terminal
✅ Saved alliance 1234567 - Test Alliance
⏭️  Alliance 7654321 already exists, skipping...
📥 Processing alliance 9999999...
```

### 4. Check the Database

```bash
yarn prisma:studio
```

Opens `http://localhost:5555` in your browser so you can view your tables.

## 📊 Workflow

```terminal
ESI API → queue-alliances.ts → RabbitMQ Queue
                                     ↓
                            worker-alliances.ts
                                     ↓
                              PostgreSQL (Alliance table)
```

## 🔧 Settings

### Rate Limit

In `worker-alliances.ts`:

```typescript
const RATE_LIMIT_DELAY = 100; // 100ms = 10 requests per second
```

To slow down: `200` (5 requests per second)
To speed up: `50` (20 requests per second) - Be careful!

### Batch Size

In `queue-alliances.ts`:

```typescript
const BATCH_SIZE = 100; // Add 100 alliances to the queue at a time
```

## 📝 Notes

- Worker processes **1 message** at a time (prefetch=1)
- Skips if already in the database (avoids unnecessary ESI requests)
- Ignores 404 (not found) errors
- Waits 60 seconds on 420 (error limit) responses
- Graceful shutdown with Ctrl+C
