#!/usr/bin/env bash
# Pre-comparison of the Node and Rust alliance workers on one machine.
# Scratch script for the spike; not part of the repository.
set -u
OUT=/tmp/claude-0/compare
mkdir -p "$OUT"
cd /home/user/killreport/backend
export DATABASE_URL=postgresql://ci:ci@localhost:5432/killreport
export RABBITMQ_URL=amqp://guest:guest@localhost:5672
export REDIS_URL=redis://localhost:6379
export EVE_CLIENT_ID=spike-dummy EVE_CLIENT_SECRET=spike-dummy
export PGPASSWORD=ci

strip() { sed 's/\x1b\[[0-9;]*m//g' "$1"; }
api() { curl -sS --noproxy '*' -u guest:guest "$@"; }
depth() { api "http://localhost:15672/api/queues/%2F/$1" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("messages",0))'; }

run() {
  local name=$1 log="$OUT/$1.log" mem="$OUT/mem-$1.csv"
  for q in esi_alliance_info_queue killreport.wait killreport.parking; do
    docker exec rabbit rabbitmqctl purge_queue "$q" >/dev/null 2>&1
  done
  echo "[$name] starting worker"
  if [ "$name" = node ]; then
    setsid yarn workspace backend worker:info:alliances >"$log" 2>&1 &
  else
    setsid ../backend-rs/target/release/worker-info-alliances >"$log" 2>&1 &
  fi
  local leader=$!
  for _ in $(seq 1 90); do strip "$log" | grep -q "waiting for alliances" && break; sleep 1; done

  # The process that does the work, and every process in its group.
  local main
  if [ "$name" = node ]; then
    main=$(pgrep -g "$leader" -f "preflight.cjs" | head -1)
  else
    main=$leader
  fi
  echo "t,main_rss_kb,group_rss_kb,group_procs" >"$mem"
  (
    start=$(date +%s)
    while kill -0 "$main" 2>/dev/null; do
      m=$(ps -o rss= -p "$main" | tr -d ' ')
      g=$(ps -o rss= -g "$leader" | awk '{s+=$1} END {print s}')
      n=$(ps -o pid= -g "$leader" | wc -l)
      echo "$(( $(date +%s) - start )),$m,$g,$n" >>"$mem"
      sleep 5
    done
  ) &
  local sampler=$!

  echo "[$name] queueing alliances"
  local t0=$(date +%s.%N)
  yarn workspace backend queue:alliances >"$OUT/queue-$name.log" 2>&1
  echo "[$name] queued: $(strip "$OUT/queue-$name.log" | grep -iE "queued|total|alliances" | tail -1)"

  for _ in $(seq 1 1800); do strip "$log" | grep -q "queue completed" && break; sleep 1; done
  local t1=$(date +%s.%N)
  echo "[$name] drained after $(python3 -c "print(round($t1-$t0-5,1))") s (minus the 5 s quiet window)"
  strip "$log" | grep -E "📊 final" | head -1

  kill -INT -- "-$leader" 2>/dev/null
  sleep 4
  kill "$sampler" 2>/dev/null
  psql -h localhost -U ci -d killreport -qc "\copy (SELECT id, name, ticker, date_founded, creator_corporation_id, creator_id, executor_corporation_id, faction_id FROM alliances ORDER BY id) TO '$OUT/alliances-$name.csv' WITH CSV HEADER"
  echo "[$name] rows: $(($(wc -l <"$OUT/alliances-$name.csv") - 1))"
  echo "[$name] queues after: main $(depth esi_alliance_info_queue), wait $(depth killreport.wait), parking $(depth killreport.parking)"
}

run node
run rs
echo "=== CSV diff (node vs rust)"
if diff -q "$OUT/alliances-node.csv" "$OUT/alliances-rs.csv" >/dev/null; then
  echo "identical"
else
  diff "$OUT/alliances-node.csv" "$OUT/alliances-rs.csv" | head -40
fi
echo "DONE"
