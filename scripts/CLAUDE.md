# scripts/

Loaded when working under `scripts/`. The rule this protects, never kill by
process name, is in the root `CLAUDE.md`.

## kill-port.sh

`yarn kill` in both workspaces delegates to `kill-port.sh`, which picks
its tool by platform because **each tool is broken on the other one**, and both
failures are silent — the port stays held and the script exits 0, so you go
looking for the process by name, which is the one thing the rule above forbids:

- **Linux: use `fuser`, not `lsof`.** `next-server` renames itself, the kernel
  truncates `/proc/PID/comm` to 15 characters leaving `next-server (v1` with an
  unbalanced paren, and lsof 4.93.2 parses `/proc/PID/stat` by matching that
  paren. Failing, it drops the process from its output entirely.
- **macOS: use `lsof`, not `fuser`.** BSD fuser has no `-k` and no `-s`. It
  answers `Unknown option: k` and exits 0. macOS lsof never reads `/proc`, so
  the truncation bug cannot reach it.

Two more ways the same silence appeared, both fixed in `kill-port.sh`:

- **A suspended process cannot act on SIGTERM.** Ctrl+Z stops the whole
  foreground process group — nodemon, yarn and the server alike — and a stopped
  process keeps its listening socket. A bare `kill` queues a signal nobody is
  running to receive, so the script must send `SIGCONT` after it, then wait for
  the socket to close and `kill -9` whatever is left.
- **`lsof -ti tcp:3000` is not "who is listening on 3000".** It matches 3000 at
  either end of a socket, so with the app open in a browser it also returns the
  tab's process — Chrome's client socket is `[::1]:55578->[::1]:3000`. Ask with
  `-sTCP:LISTEN`. fuser matches the local port only and needs no equivalent.

`kill $pids` returning 0 means the signal was sent, never that anything acted on
it, so the script waits for the port to actually free and exits **1** if it
could not. Only "nothing was listening" exits 0 without doing anything.

Checking one platform is how this gets broken: the move to `fuser` (087e0214)
and the move back (#215) were each correct on the machine they were tested on.
