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

if [ "$(uname)" = Darwin ]; then
  pids=$(lsof -ti "tcp:$port")
  [ -n "$pids" ] && kill $pids
else
  fuser -ks -n tcp "$port"
fi

# Nothing listening is the normal case, not a failure: `yarn kill` runs before
# `yarn dev` in a chain and must not break it.
exit 0
