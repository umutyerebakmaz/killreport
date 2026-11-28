# zKillboard R2Z2 real-time stream

`worker:redisq` writes every new killmail the moment zKillboard publishes it.
It feeds the live killmail list (`NEW_KILLMAIL`) and the Discord notifications.

The old RedisQ service (`zkillredisq.stream/listen.php`) was shut down on
2026-05-31. The worker reads its replacement, **R2Z2**
(<https://github.com/zKillboard/zKillboard/wiki/API-(R2Z2)>). The name
`redisq` is historical.

Two implementations exist, and they behave the same:

| Script                  | Code                                                                             |
| ----------------------- | -------------------------------------------------------------------------------- |
| `yarn worker:redisq`    | [`worker-redisq-stream.ts`](../../src/workers/worker-redisq-stream.ts)           |
| `yarn worker:redisq:rs` | [`backend-rs/workers/worker-redisq`](../../../backend-rs/workers/worker-redisq/) |

Run only one at a time: both read and write the same `stream_cursors` row.
Run either from `backend/`, so it reads `backend/.env`.

## How it works

1. **Start.** The worker reads its position from `stream_cursors`
   (`stream = 'r2z2'`, the next sequence to read). With no row, it reads
   `https://r2z2.zkillboard.com/ephemeral/sequence.json` and starts at the
   head.
2. **Read.** It fetches `/ephemeral/{sequence}.json`:
   - **200:** a killmail; it is processed (below), then the sequence advances
     and is saved. The next read follows 100 ms later, about 10 requests a
     second, under R2Z2's 15.
   - **404:** the worker reads `sequence.json` again.
     - Head not past us: nothing new yet. It waits 6 s and tries the same
       number again.
     - Head past us: the file is a gap, expired, or not readable yet. The
       number is skipped after **3** such 404s in a row.
     - **10** skips in a row mean the saved position has fallen out of what
       R2Z2 keeps, and the worker jumps to the head.
   - **403/429:** it waits 5 s and does not advance.
   - **Network error or 5xx:** it does not advance. It waits 100 ms, and 5 s
     on every fifth error in a row.
   - **200 with no killmail ID or hash:** it is logged and skipped.
3. **Process.**
   - The payload carries the full ESI killmail. If that copy is malformed, the
     worker fetches the killmail from `/killmails/{id}/{hash}/` instead.
   - **Enrichment:** before the save, every character, corporation, alliance
     and type the killmail names that the database lacks is fetched from ESI
     and written. That way no killmail reaches the live list with an
     "Unknown" name. An entity ESI will not give is queued to its
     `esi_<entity>_info_queue`, and the killmail is saved anyway.
     `REDISQ_ENABLE_ENRICHMENT=false` turns enrichment off.
   - **Save:** the shared killmail writer writes the killmail, victim,
     attackers, items, daily stats and filter row in one transaction.
   - **Announce:** a new killmail is published on `NEW_KILLMAIL` and queued
     to `discord_webhook_queue`. An already stored one is not.
4. **Failures.** A killmail that cannot be written (ESI down, a save error)
   goes to `killmail_refs` with `source = 'redisq'`. The detail pipeline
   (`queue:killmail-refs` → `worker:killmail-detail`) retries it, without an
   announcement. If even that row cannot be written, the sequence stays and
   the killmail is read again.

So a restart, a crash or a database outage loses no killmail. The only
exception is one R2Z2 itself no longer has.

### What is shared with other workers

| Part                                                              | Rust                                              | Node                               |
| ----------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------- |
| Killmail write                                                    | `crates/killmail-writer` (also the detail worker) | `services/killmail-writer.ts`      |
| Entity writes (the same functions as the `worker-info-*` workers) | `crates/entity-info`                              | its own upserts in the worker      |
| Position and 404 rule                                             | `src/cursor.rs`, `src/stream.rs`                  | `services/redisq/stream-cursor.ts` |

## ESI

The worker is **live** traffic. Every ESI request asks the shared Redis
budget with `live` priority, which keeps a reserve that bulk workers cannot
take. It also gives up rather than wait out a brake longer than 10 s:

- Node: `setEsiPriority('live')`, `setEsiMaxWait(10_000)`
- Rust: `EsiClient::live(10 s)`

A killmail whose ESI fetch gives up goes to `killmail_refs`. See
[`backend/CLAUDE.md`](../../CLAUDE.md), "ESI rate limiting".

## Running

```bash
cd backend
yarn worker:redisq       # Node
yarn worker:redisq:rs    # Rust (cargo run --release)
```

On SIGINT or SIGTERM, the Rust worker finishes the killmail in hand, saves
its position and exits.

In production it runs under systemd as
[`killreport-worker-redisq.service`](../../../deploy/systemd/killreport-worker-redisq.service);
see [systemd.md](../ops/systemd.md).

`workerStatus` lists it among the standalone workers and finds it with `ps`,
either the Node file or the Rust binary (`target/<profile>/worker-redisq`).

## Checking on it

```sql
-- Where the stream is
SELECT sequence, updated_at FROM stream_cursors WHERE stream = 'r2z2';

-- Killmails it could not write, still waiting for the detail pipeline
SELECT r.killmail_id, r.discovered_at, r.queued_count
FROM killmail_refs r
LEFT JOIN killmails k ON k.killmail_id = r.killmail_id
WHERE r.source = 'redisq' AND k.killmail_id IS NULL;
```

## Related

- [Killmail refs](../workers/killmail-refs.md): the retry path for killmails
  that could not be written
- [Discord webhook](../workers/discord-webhook.md)
- Design: [`2026-11-28-rust-redisq-design.md`](../../../docs/superpowers/specs/2026-11-28-rust-redisq-design.md)
