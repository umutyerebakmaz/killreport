# Backfill Killmail Values - Queue & Worker

## Overview

Recalculates `total_value`, `destroyed_value` and `dropped_value` of
killmails that are already in the database, and the copy of `total_value` in
`killmail_filters`. New killmails get their values when they are saved; this
is for old ones, and for recalculating after market prices change.

There is a Node and a Rust version of both halves. They use the same queue
(`backfill_killmail_values_queue`), the same messages
(`{killmailId, queuedAt, source}`) and the same formula, so either queue can
feed either worker.

| Half   | Node                          | Rust                             |
| ------ | ----------------------------- | -------------------------------- |
| Queue  | `yarn queue:backfill-values`  | `yarn queue:backfill-values:rs`  |
| Worker | `yarn worker:backfill-values` | `yarn worker:backfill-values:rs` |

Code: [queue-backfill-values.ts](../../src/queues/queue-backfill-values.ts),
[worker-backfill-values.ts](../../src/workers/worker-backfill-values.ts),
[queue-backfill-values](../../../backend-rs/queues/queue-backfill-values/),
[worker-backfill-values](../../../backend-rs/workers/worker-backfill-values/),
the formula in
[calculate-killmail-values.ts](../../src/helpers/calculate-killmail-values.ts)
and [killmail-value](../../../backend-rs/crates/killmail-value/).

## Quick start

```bash
# Prices first: without them every value is 0 and the worker skips the row
yarn queue:prices:rs && yarn worker:prices:rs

# Test with the newest 1000 killmails
yarn queue:backfill-values:rs --limit=1000
yarn worker:backfill-values:rs
```

## Queue flags

Every run recalculates every killmail it queues; there is no mode.

| Flag              | Meaning                                                                        |
| ----------------- | ------------------------------------------------------------------------------ |
| (none)            | every killmail                                                                 |
| `--limit=N`       | at most N killmails, newest first                                              |
| `--capsules-only` | only killmails whose victim flew a ship in group 29 (Capsule, Genolution pods) |
| `--id=K`          | only killmail K                                                                |

A value that is not a positive integer, or an unknown flag, stops the script
before it queues anything.

The queue reads killmail IDs newest first, 500 per page, by `killmail_id`
rather than by offset, and never above the largest ID it saw when it
started. Killmails saved while it runs therefore neither shift the pages nor
push older killmails past `--limit`. Each page is published with publisher
confirms, so "successfully queued" means the broker has the messages.

## The worker

For each killmail:

1. A killmail that is gone, or has no victim, is skipped and acked.
2. The values are calculated (see [capsule-value-calculation.md](./capsule-value-calculation.md)).
3. If all three are 0 (no market data), the row is left as it is.
4. Otherwise `killmails` and `killmail_filters` are updated in one
   transaction.

The Rust worker's prefetch follows the runner's rule,
`max(ESI_PREFETCH, ceil(ESI_MAX_RPS / 2))`; the Node worker's is 10. Several
instances may run at once: an update is idempotent.

On the server systemd runs the Node worker as
`killreport-worker-backfill-values@{1,2,3}` and the queue as the run-by-hand
`killreport-queue-backfill-values` (see [systemd.md](../ops/systemd.md)).

## Checking progress

```graphql
query {
  workerStatus {
    queueName
    messageCount
    consumerCount
  }
}
```

```sql
-- killmails that never got a value
SELECT COUNT(*) FROM killmails WHERE total_value IS NULL;
```
