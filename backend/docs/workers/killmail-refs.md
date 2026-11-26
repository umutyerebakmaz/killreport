# Killmail refs: user and corporation killmail sync

Logged-in users' own killmails, and their corporation's when they are a
Director or CEO, are read from ESI with their token. What the syncs find is
recorded in `killmail_refs`, and a separate publisher feeds the detail queue
from that table. RabbitMQ carries the work; the table is the record of it.

Design: [2026-11-26-killmail-refs-sync-design.md](../../../docs/superpowers/specs/2026-11-26-killmail-refs-sync-design.md).

## Flow

```text
killmail-sync-cron (API, every 10 min)
  → esi_user_killmails_queue / esi_corporation_killmails_queue   {userId, fullSync?}
  → worker:user-killmails / worker:corporation-killmails
       ESI /characters|corporations/{id}/killmails/recent/, page by page
       → INSERT INTO killmail_refs … ON CONFLICT DO NOTHING
queue:killmail-refs (systemd, every 5 min)
  → esi_killmail_detail_queue   {killmailId, killmailHash, announce: false}
  → worker:killmail-detail → killmails
```

| Part                  | Node                                | Rust                                   |
| --------------------- | ----------------------------------- | -------------------------------------- |
| Character sync worker | `yarn worker:user-killmails`        | `yarn worker:user-killmails:rs`        |
| Corporation sync      | `yarn worker:corporation-killmails` | `yarn worker:corporation-killmails:rs` |
| Publisher             | `yarn queue:killmail-refs`          | `yarn queue:killmail-refs:rs`          |

Code: [worker-esi-user-killmails.ts](../../src/workers/worker-esi-user-killmails.ts),
[worker-esi-corporation-killmails.ts](../../src/workers/worker-esi-corporation-killmails.ts),
[queue-killmail-refs.ts](../../src/queues/queue-killmail-refs.ts),
[killmail-walk.ts](../../src/services/killmail-walk.ts),
[user-credentials.ts](../../src/services/user-credentials.ts);
Rust [killmail-refs](../../../backend-rs/crates/killmail-refs/src/lib.rs),
[sso](../../../backend-rs/crates/sso/src/lib.rs).

## The sync

- **Who is selected:** users with a refresh token whose last sync of that
  kind is over 15 minutes old. The access token's lifetime does not matter;
  the worker refreshes it. The corporation job also skips users whose
  `corp_killmails_denied_at` is set.
- **Corporation:** read from `characters.corporation_id` at sync time. A
  character not fetched yet, or one in an NPC corporation
  (`1_000_000 ≤ id < 2_000_000`), is stamped and skipped.
- **Pages:** from page 1, stopping on a 404, an empty page, `X-Pages`, 14
  pages (the `char-killmail` / `corp-killmail` groups allow 15 successful
  pages per 15 minutes per character), or a page that added no new ref. A
  user who has never synced, or a `--full` run, does not stop on a known page.
- **403 on the corporation list:** recorded in `corp_killmails_denied_at` and
  not retried until the user logs in again.
- **Token:** refreshed under a row lock (`SELECT … FOR UPDATE`), written as a
  compare-and-swap on the old refresh token. `invalid_grant` clears the
  refresh token (the user has to log in again); any other SSO failure is
  retried.

## The publisher

A ref is **pending** while `killmails` has no row for it. Each run, unless the
detail queue has no consumer or still holds messages, it publishes up to 5000 pending refs, newest
first: never queued ones at once, then at most hourly for five rounds, then
daily. `queued_count` and `last_queued_at` move only after the broker
confirmed the messages.

```sql
-- pending refs, and the ones that keep failing
SELECT count(*) FILTER (WHERE queued_count < 5) AS pending,
       count(*) FILTER (WHERE queued_count >= 5) AS stuck
FROM killmail_refs r
WHERE NOT EXISTS (SELECT 1 FROM killmails k WHERE k.killmail_id = r.killmail_id);
```
