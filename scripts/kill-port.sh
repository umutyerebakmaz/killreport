#!/bin/sh
# Frees one dev port. Takes the port as its only argument.
#
# This exists as a file rather than a `package.json` one-liner because the tool
# that works depends on the platform, and each tool is broken on the other one:
#
#   Linux — lsof 4.93.2 drops Next.js's process entirely. next-server renames
#   itself to `next-server (v16.3.3)`, the kernel truncates /proc/PID/comm to 15
#   chars leaving `next-server (v1` with an unbalanced paren, and lsof parses
#   /proc/PID/stat by matching that paren. Failing, it skips the process:
#   `lsof -ti:3000` printed nothing while the port stayed held. See 087e0214.
#
#   macOS — BSD fuser has no -k and no -s. It answers `Unknown option: k` and
#   exits 0, so the port stays held and the caller is told it succeeded.
#
# fuser resolves the port through the socket inode and never reads comm, which
# is why it is the right tool where it exists. macOS lsof does not read /proc at
# all, so the truncation bug cannot reach it; verified against a real
# `next-server (v16.3.3)` holding 3000.
#
# Always by port, never by process name. `pkill -f 'next.*dev'` would reach
# every checkout on the machine, which is the whole reason these scripts exist.
port=$1

[ -n "$port" ] || {
  echo 'kill-port: no port given - nothing killed'
  exit 0
}

# Who is LISTENING on the port — not who is talking to it.
#
# `lsof -ti tcp:3000` matches any socket with 3000 at either end, so with the
# app open in a browser it also returns the tab's process: Chrome's client
# socket is `[::1]:55578->[::1]:3000`. The old script sent that process a
# SIGTERM on every `yarn dev`. `-sTCP:LISTEN` asks the question we mean.
#
# fuser matches the local port only, so a client of ours never matches there
# and the Linux branch needs no equivalent filter.
listeners() {
  if [ "$(uname)" = Darwin ]; then
    lsof -ti "tcp:$port" -sTCP:LISTEN 2>/dev/null
  else
    fuser -n tcp "$port" 2>/dev/null
  fi
}

pids=$(listeners)

# Nothing listening is the normal case, not a failure: `yarn kill` runs before
# `yarn dev` in a chain and must not break it.
[ -n "$pids" ] || exit 0

# SIGCONT after SIGTERM, because a suspended process cannot act on a signal it
# is not running to receive. Ctrl+Z stops the whole foreground process group —
# nodemon, yarn and the server alike — and a stopped process keeps its listening
# socket bound. The old script sent a bare SIGTERM, which queued and was never
# delivered, then exited 0: the port stayed held for four hours while every
# `yarn dev` since either drifted to another port or died on EADDRINUSE.
kill $pids 2>/dev/null
kill -CONT $pids 2>/dev/null

# Wait for the socket to actually close. Exiting the moment the signal is sent
# is what made the old script's success meaningless — `kill` returning 0 says
# the signal was sent, never that anything acted on it.
i=0
while [ "$i" -lt 20 ]; do
  [ -n "$(listeners)" ] || exit 0
  sleep 0.25
  i=$((i + 1))
done

# Five seconds is long enough for a graceful shutdown; what is left is stuck.
kill -9 $(listeners) 2>/dev/null
sleep 1

# And say so if even that failed, rather than reporting the silent success this
# script's whole header is about.
stuck=$(listeners)
[ -n "$stuck" ] || exit 0

echo "kill-port: port $port is still held by $stuck" >&2
exit 1
