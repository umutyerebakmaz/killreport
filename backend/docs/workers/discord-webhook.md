# Discord webhook delivery

Posts a freshly saved killmail to every Discord webhook whose watched
character, corporation or alliance took part in it.

## Flow

1. `saveKillmail` ([`killmail-writer.ts`](../../src/services/killmail-writer.ts))
   stores a killmail. Inside its `publish` block, right after `NEW_KILLMAIL`,
   it publishes `{ killmailId }` to `discord_webhook_queue`. A killmail that
   was already stored (existence check or `P2002`) returns earlier and
   publishes nothing, and a backfill (`publish: false`) stays silent.
2. [`worker-discord-webhook.ts`](../../src/workers/worker-discord-webhook.ts)
   consumes the queue (`PREFETCH_COUNT = 5`) and calls `deliverKillmail`
   ([`discord-delivery.ts`](../../src/services/discord-webhook/discord-delivery.ts)).
3. `deliverKillmail` loads the killmail, victim and attackers, finds the
   enabled webhooks that match any party, plans one delivery per distinct URL,
   builds the embed and posts it through
   [`discord-client.ts`](../../src/services/discord-webhook/discord-client.ts).
4. A successful post sets `discord:sent:{killmailId}:{urlHash}` in Redis
   (`SET key 1 EX 86400 NX`, Redis 6.0 has no `GETDEL`), so a retried message
   never posts twice to the same webhook.

Run it with `yarn worker:discord-webhook`. It is a continuously running worker
and has no `cron_restart`.

## The two age rules

A killmail is delivered to a webhook only if both hold:

- `killmail_time >= active_since` of the webhook, so a new webhook never
  replays history;
- `killmail_time >= now - 60 minutes`, so a backlog or a long outage never
  floods a channel with old kills.

## Outcome mapping

| Discord outcome | Meaning                             | What happens                                          |
| --------------- | ----------------------------------- | ----------------------------------------------------- |
| `ok`            | Posted                              | Redis sent marker set                                 |
| `disable`       | The webhook is gone or unauthorised | Every row with that URL gets `disabled_at`            |
| `drop`          | Discord refused this payload        | Logged as an error, not retried                       |
| `transient`     | 5xx, timeout or rate-limit budget   | Counted, then `DiscordDeliveryError` after the others |

`DiscordDeliveryError` goes to `handleWorkerError`, so the message retries
through the shared wait queue and parks after five attempts. Deliveries that
already succeeded are skipped on the retry by the Redis marker.

## Never log the URL

The webhook URL is a credential. It never appears in a GraphQL response, a log
line, an error message, a queue message or a Redis key. Logs name webhooks by
database id, and the Redis key carries a hash of the URL.

## Related

- [PM2 reference](../ops/pm2.md)
- [Worker documentation](worker-documentation.md)
