# systemd — process management and scheduling

systemd is the only process manager on the droplet. It runs the GraphQL API,
the Next.js frontend, every long-running worker, and every scheduled job,
including the nightly database backup. PM2 was removed on 2026-11-16 and the
OS crontab stays empty. The design is in
[2026-11-16-systemd-process-management-design.md](../../../docs/superpowers/specs/2026-11-16-systemd-process-management-design.md).

The unit files live in the repository under
[`deploy/systemd/`](../../../deploy/systemd/), one file per process.
`backend/src/ops/systemd-units.guard.spec.ts` checks every file against the
inventory below. Change a value in both places, or the test fails.

## Layout and naming

| Kind                  | Files                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------ |
| Everything, as one    | `killreport.target`                                                                        |
| Long-running services | `killreport-backend.service`, `killreport-frontend.service`, `killreport-worker-*.service` |
| Three-instance worker | `killreport-worker-backfill-values@.service` (`@1`, `@2`, `@3`)                            |
| Scheduled jobs        | `killreport-<job>.service` (`Type=oneshot`) + `killreport-<job>.timer`                     |
| Run-by-hand job       | `killreport-queue-backfill-values.service`                                                 |
| Maintenance           | `killreport-backup-db.service` + `.timer`                                                  |

A unit name is `killreport-` plus the name the process had under PM2. Every
service and timer except the backup is `PartOf=killreport.target`, so
stopping the target stops all of them. Stopping the application must not
stop the backup, which is why the backup is the exception.

## Install and update

Copy the files and reload. Run this after every `git pull` that touches
`deploy/systemd/`:

```bash
sudo cp /var/www/killreport/deploy/systemd/* /etc/systemd/system/ && sudo systemctl daemon-reload
```

The units are copied, not linked with `systemctl link`. A pull that is still
in progress cannot change the running system; a change takes effect only on
an explicit copy and reload. `cp` never removes a unit that was deleted from
the repository: disable it and delete it from `/etc/systemd/system/` by hand.

## Deploy an update

The checkout belongs to the `killreport` user. Run everything that writes to
it as that user: its shell is `nologin`, which `sudo -u` does not need. A
`git pull` or `yarn build` as yourself fails with `EACCES`, and one run with
plain `sudo` leaves root-owned files the services cannot write, such as the
frontend's `.next/cache`.

```bash
cd /var/www/killreport
sudo -u killreport git pull origin main
sudo -u killreport yarn install
cd frontend && sudo -u killreport yarn build && cd ..
# only if the pull changed deploy/systemd/
sudo cp deploy/systemd/* /etc/systemd/system/ && sudo systemctl daemon-reload
sudo systemctl restart killreport.target
```

## Enable

Enabling `killreport.target` does not enable the units under it.
`WantedBy=killreport.target` only writes its symlink once the unit itself is
enabled, so every unit that has an `[Install]` section is listed by name. That
means the target, the long-running services, and the timers. The oneshot job
services are never enabled, because their timers start them.

```bash
cd /etc/systemd/system && sudo systemctl enable killreport.target killreport-backend.service killreport-frontend.service killreport-worker-redisq.service killreport-worker-alliances.service killreport-worker-corporations.service killreport-worker-alliance-corporations.service killreport-worker-types.service killreport-worker-zkillboard.service killreport-worker-user-killmails.service killreport-worker-corporation-killmails.service killreport-worker-killmail-detail.service killreport-worker-discord-webhook.service killreport-worker-characters.service killreport-worker-character-corporation-history.service killreport-worker-prices.service killreport-worker-backfill-values@1.service killreport-worker-backfill-values@2.service killreport-worker-backfill-values@3.service killreport-queue-characters.timer killreport-queue-character-corporations.timer killreport-queue-character-corporation-history.timer killreport-queue-alliances.timer killreport-queue-alliance-corporations.timer killreport-snapshot-alliances.timer killreport-update-alliance-counts.timer killreport-snapshot-corporations.timer killreport-worker-system-activity.timer killreport-worker-sov-campaigns.timer killreport-worker-sov-map.timer killreport-worker-sov-structures.timer killreport-worker-sov-snapshot.timer killreport-worker-sov-correlate.timer killreport-queue-prices.timer killreport-backup-db.timer
```

No glob is used: the scheduled `killreport-worker-sov-*.service` and
`killreport-worker-system-activity.service` would match
`killreport-worker-*`. When you add a unit, add it to this line. The guard
spec fails if the line and the files disagree.

## Daily commands

```bash
sudo systemctl start killreport.target       # everything
sudo systemctl stop killreport.target        # everything except the backup timer
systemctl list-units 'killreport-*'          # what is running
systemctl list-timers 'killreport-*'         # next and last run of every job
systemctl --failed                           # anything that exited non-zero

journalctl -u killreport-worker-alliances -f # one unit's log, live
journalctl -u 'killreport-*' --since today   # every unit's log
systemd-cgtop                                # CPU and memory per unit

sudo systemctl restart killreport-backend
sudo systemctl start killreport-queue-alliances         # run a scheduled job now
sudo systemctl start killreport-queue-backfill-values   # the run-by-hand job
```

Logs are kept by journald. Set its disk cap once in
`/etc/systemd/journald.conf`, for example `SystemMaxUse=2G`, then run
`sudo systemctl restart systemd-journald`.

## Inventory

### Long-running

Every backend unit runs from `/var/www/killreport/backend`. The frontend runs
from `/var/www/killreport/frontend`. Both read their `.env` from the working
directory. All of them restart on exit after 5 s, with no limit on attempts
(`StartLimitIntervalSec=0`).

| Unit (`killreport-…`)                  | `yarn` script                          | `LOG_LEVEL` | `MemoryHigh` / `MemoryMax` |
| -------------------------------------- | -------------------------------------- | ----------- | -------------------------- |
| `backend`                              | `start`                                | debug       | 900M / 1G                  |
| `frontend`                             | `start`                                | —           | 900M / 1G                  |
| `worker-redisq`                        | `worker:redisq`                        | debug       | 460M / 512M                |
| `worker-alliances`                     | `worker:info:alliances`                | debug       | 460M / 512M                |
| `worker-corporations`                  | `worker:info:corporations`             | debug       | 460M / 512M                |
| `worker-alliance-corporations`         | `worker:alliance-corporations`         | debug       | 460M / 512M                |
| `worker-types`                         | `worker:info:types`                    | debug       | 460M / 512M                |
| `worker-zkillboard`                    | `worker:zkillboard`                    | debug       | 460M / 512M                |
| `worker-user-killmails`                | `worker:user-killmails`                | debug       | 460M / 512M                |
| `worker-corporation-killmails`         | `worker:corporation-killmails`         | debug       | 460M / 512M                |
| `worker-killmail-detail`               | `worker:killmail-detail`               | debug       | 460M / 512M                |
| `worker-discord-webhook`               | `worker:discord-webhook`               | debug       | 460M / 512M                |
| `worker-characters`                    | `worker:info:characters`               | debug       | 460M / 512M                |
| `worker-character-corporation-history` | `worker:character-corporation-history` | debug       | 460M / 512M                |
| `worker-prices`                        | `worker:prices`                        | debug       | 460M / 512M                |
| `worker-backfill-values@{1,2,3}`       | `worker:backfill-values`               | debug       | 460M / 512M                |

The backend also sets `PORT=4000`, `USE_REDIS_PUBSUB=true` and
`REDIS_URL=redis://localhost:6379`. The frontend sets `PORT=3000`.

### Scheduled

Every time is UTC. Every timer is `Persistent=true`, so a run missed while the
droplet was down happens at the next boot. A timer never starts a job that is
still running. These jobs do not run at boot otherwise.

| Unit (`killreport-…`)                 | `yarn` script                         | `OnCalendar=`            |
| ------------------------------------- | ------------------------------------- | ------------------------ |
| `queue-characters`                    | `queue:characters`                    | `Mon *-*-* 16:10:00 UTC` |
| `queue-character-corporations`        | `queue:character-corporations`        | `Mon *-*-* 17:00:00 UTC` |
| `queue-character-corporation-history` | `queue:character-corporation-history` | `Mon *-*-* 03:00:00 UTC` |
| `queue-alliances`                     | `queue:alliances`                     | `*-*-* 22:00:00 UTC`     |
| `queue-alliance-corporations`         | `queue:alliance-corporations`         | `*-*-* 22:05:00 UTC`     |
| `snapshot-alliances`                  | `snapshot:alliances`                  | `*-*-* 01:00:00 UTC`     |
| `update-alliance-counts`              | `update:alliance-counts`              | `*-*-* 01:00:00 UTC`     |
| `snapshot-corporations`               | `snapshot:corporations`               | `*-*-* 01:00:00 UTC`     |
| `worker-system-activity`              | `worker:system-activity`              | `*-*-* *:00:00 UTC`      |
| `worker-sov-campaigns`                | `worker:sov:campaigns`                | `*-*-* *:00/5:00 UTC`    |
| `worker-sov-map`                      | `worker:sov:map`                      | `*-*-* *:00/30:00 UTC`   |
| `worker-sov-structures`               | `worker:sov:structures`               | `*-*-* *:15,45:00 UTC`   |
| `worker-sov-snapshot`                 | `worker:sov:snapshot`                 | `*-*-* 01:00:00 UTC`     |
| `worker-sov-correlate`                | `worker:sov:correlate`                | `*-*-* *:00/10:00 UTC`   |
| `queue-prices`                        | `queue:prices`                        | `*-*-* 06:00:00 UTC`     |
| `backup-db`                           | `bash scripts/backup-db.sh`           | `*-*-* 04:00:00 UTC`     |

The jobs run with `LOG_LEVEL=info`. `worker-sov-campaigns` and
`worker-sov-map` also set `USE_REDIS_PUBSUB=true`. Check an expression before
changing it with `systemd-analyze calendar '<expression>'`.

Static universe and reference data (`queue:regions`, `queue:types`,
`queue:dogma-*` and their workers) has no unit. It is run by hand, once.

## Memory and shutdown

- **Memory.** `MemoryMax` is the hard cgroup cap: a process that reaches it is
  OOM-killed, and `Restart=always` brings it back. Unacked messages return to
  RabbitMQ, so nothing is lost. `MemoryHigh`, about 90% of the cap, makes the
  kernel throttle and reclaim first. The scheduled jobs have no cap.
- **Shutdown.** Node units stop with `KillSignal=SIGINT`, the signal PM2 sent.
  Some workers only listen for SIGINT. Yarn reports a child killed by SIGINT
  as exit code 130, so every yarn unit sets `SuccessExitStatus=130`;
  otherwise a clean `systemctl stop` would leave it listed by
  `systemctl --failed`. Rust units use systemd's default,
  SIGTERM; the runner handles both
  ([`shutdown.rs`](../../../backend-rs/crates/runner/src/shutdown.rs)). Every
  unit gets `TimeoutStopSec=30` to finish in-flight messages before SIGKILL.

## Moving a unit to Rust

A Rust binary is built locally for `x86_64-unknown-linux-musl` and copied with
`scp` to `/var/www/killreport/backend-rs/bin/<crate>`. The droplet has no Rust
toolchain. The unit keeps its name, its timer and its logs. Only the start
line changes:

```diff
-ExecStart=/usr/bin/yarn worker:info:alliances
-KillSignal=SIGINT
-SuccessExitStatus=130
+ExecStart=/var/www/killreport/backend-rs/bin/worker-info-alliances
```

Then copy the unit, `sudo systemctl daemon-reload` and
`sudo systemctl restart killreport-worker-alliances`. To roll back, revert the
diff and repeat the same three steps. Lower `MemoryMax` in a separate change,
after measuring.

## Server setup (once)

1. Create the service user: `sudo useradd --system --create-home --shell /usr/sbin/nologin killreport`,
   then `sudo chown -R killreport: /var/www/killreport`. Backups are written to
   `/home/killreport/backups/killreport_db_backups`.
2. Check the clock with `timedatectl`. The timers name UTC explicitly, so the
   system time zone does not change when they fire, but logs read more easily
   in UTC.
3. Set `SystemMaxUse=` in `/etc/systemd/journald.conf` (see _Daily commands_).
4. Install, enable and start: run the _Install and update_ line and the
   _Enable_ line, then `sudo systemctl start killreport.target`.
5. Verify. `systemctl list-units 'killreport-*'` shows every long-running unit
   `active (running)`. `systemctl list-timers 'killreport-*'` shows 16 timers.
   `query { workerStatus { queueName consumerCount } }` shows a consumer on
   every queue, three on `backfill_killmail_values_queue`.

Do not install PM2. Do not add crontab entries: a job is scheduled by exactly
one timer.
