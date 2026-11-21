import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

/**
 * Guards the systemd units in deploy/systemd against the inventory in
 * docs/superpowers/specs/2026-11-16-systemd-process-management-design.md.
 * The units replace ecosystem.config.js; a value changed here changes what
 * runs on the droplet.
 */

const REPO = path.resolve(__dirname, '../../..');
const UNITS_DIR = path.join(REPO, 'deploy/systemd');

type Unit = Map<string, Array<[key: string, value: string]>>;

function parseUnit(text: string): Unit {
  const unit: Unit = new Map();
  let section: Array<[string, string]> | undefined;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    const header = /^\[(.+)\]$/.exec(line);
    if (header) {
      section = [];
      unit.set(header[1], section);
      continue;
    }
    const eq = line.indexOf('=');
    if (!section || eq < 0) throw new Error(`unparseable line: ${raw}`);
    section.push([line.slice(0, eq).trim(), line.slice(eq + 1).trim()]);
  }
  return unit;
}

function values(u: Unit, section: string, key: string): string[] {
  return (u.get(section) ?? []).filter(([k]) => k === key).map(([, v]) => v);
}

function value(u: Unit, section: string, key: string): string | undefined {
  const found = values(u, section, key);
  if (found.length > 1) throw new Error(`${section}.${key} is set twice`);
  return found[0];
}

function env(u: Unit): Record<string, string> {
  return Object.fromEntries(
    values(u, 'Service', 'Environment').map((e) => {
      const eq = e.indexOf('=');
      return [e.slice(0, eq), e.slice(eq + 1)];
    }),
  );
}

/** Space-separated list keys (`Wants=a b`) may also repeat; flatten both. */
function list(u: Unit, section: string, key: string): string[] {
  return values(u, section, key).flatMap((v) => v.split(/\s+/));
}

function unitFiles(): string[] {
  return fs.existsSync(UNITS_DIR) ? fs.readdirSync(UNITS_DIR).sort() : [];
}

function serviceFiles(): string[] {
  return unitFiles().filter((f) => f.endsWith('.service'));
}

function loadUnits(): Record<string, Unit> {
  return Object.fromEntries(
    unitFiles().map((f) => [
      f,
      parseUnit(fs.readFileSync(path.join(UNITS_DIR, f), 'utf8')),
    ]),
  );
}

function scripts(workspace: string): Record<string, string> {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(REPO, workspace, 'package.json'), 'utf8'),
  );
  return pkg.scripts;
}

const DEPS = [
  'network-online.target',
  'rabbitmq-server.service',
  'redis-server.service',
];

/** A unit runs either a yarn script (Node) or a backend-rs binary (Rust). */
type Exec = { script: string } | { crate: string };

const RUST_BIN = '/var/www/killreport/backend-rs/bin/';

/**
 * What is wrong with a unit that runs the Rust binary `crate`; empty when
 * nothing is. The binary is installed from the CI artifact (systemd.md,
 * _Moving a unit to Rust_). Rust stops on systemd's default SIGTERM, so the
 * yarn SIGINT lines have no place here, and nothing reads NODE_ENV or
 * LOG_LEVEL. NO_COLOR keeps ANSI escapes out of the journal.
 */
function rustUnitProblems(u: Unit, crate: string): string[] {
  const problems: string[] = [];
  const exec = value(u, 'Service', 'ExecStart');
  if (exec !== `${RUST_BIN}${crate}`) {
    problems.push(`ExecStart is ${exec}, not ${RUST_BIN}${crate}`);
  }
  const exists = ['queues', 'workers'].some((dir) =>
    fs.existsSync(path.join(REPO, 'backend-rs', dir, crate, 'Cargo.toml')),
  );
  if (!exists) problems.push(`no crate backend-rs/{queues,workers}/${crate}`);
  if (
    value(u, 'Service', 'WorkingDirectory') !== '/var/www/killreport/backend'
  ) {
    problems.push('WorkingDirectory must be backend/, where .env is read');
  }
  for (const key of ['KillSignal', 'SuccessExitStatus']) {
    if (value(u, 'Service', key) !== undefined) {
      problems.push(`${key} is a yarn setting`);
    }
  }
  const e = env(u);
  for (const key of ['NODE_ENV', 'LOG_LEVEL']) {
    if (key in e) problems.push(`${key} is not read by Rust`);
  }
  if (e.NO_COLOR !== '1') problems.push('NO_COLOR=1 is missing');
  return problems;
}

function expectExec(u: Unit, e: Exec): void {
  if ('crate' in e) {
    expect(rustUnitProblems(u, e.crate)).toEqual([]);
  } else {
    expect(value(u, 'Service', 'ExecStart')).toBe(`/usr/bin/yarn ${e.script}`);
  }
}

type Continuous = Exec & {
  workspace: 'backend' | 'frontend';
  env: Record<string, string>;
  memory: [high: string, max: string];
};

const worker = (script: string): Continuous => ({
  script,
  workspace: 'backend',
  env: { NODE_ENV: 'production', LOG_LEVEL: 'debug' },
  memory: ['460M', '512M'],
});

const CONTINUOUS: Record<string, Continuous> = {
  'killreport-worker-redisq.service': worker('worker:redisq'),
  'killreport-worker-alliances.service': worker('worker:info:alliances'),
  'killreport-worker-corporations.service': worker('worker:info:corporations'),
  'killreport-worker-alliance-corporations.service': worker(
    'worker:alliance-corporations',
  ),
  'killreport-worker-types.service': worker('worker:info:types'),
  'killreport-worker-zkillboard.service': worker('worker:zkillboard'),
  'killreport-worker-user-killmails.service': worker('worker:user-killmails'),
  'killreport-worker-corporation-killmails.service': worker(
    'worker:corporation-killmails',
  ),
  'killreport-worker-killmail-detail.service': worker('worker:killmail-detail'),
  'killreport-worker-discord-webhook.service': worker('worker:discord-webhook'),
  'killreport-worker-characters.service': worker('worker:info:characters'),
  'killreport-worker-character-corporation-history.service': worker(
    'worker:character-corporation-history',
  ),
  'killreport-worker-prices.service': worker('worker:prices'),
  'killreport-worker-backfill-values@.service': worker(
    'worker:backfill-values',
  ),
  'killreport-backend.service': {
    script: 'start',
    workspace: 'backend',
    env: {
      NODE_ENV: 'production',
      PORT: '4000',
      LOG_LEVEL: 'debug',
      USE_REDIS_PUBSUB: 'true',
      REDIS_URL: 'redis://localhost:6379',
    },
    memory: ['900M', '1G'],
  },
  'killreport-frontend.service': {
    script: 'start',
    workspace: 'frontend',
    env: { NODE_ENV: 'production', PORT: '3000' },
    memory: ['900M', '1G'],
  },
};

type Scheduled = Exec & {
  onCalendar: string;
  env: Record<string, string>;
};

const job = (
  script: string,
  onCalendar: string,
  extra: Record<string, string> = {},
): Scheduled => ({
  script,
  onCalendar,
  env: { NODE_ENV: 'production', LOG_LEVEL: 'info', ...extra },
});

const PUBSUB = { USE_REDIS_PUBSUB: 'true' };

const SCHEDULED: Record<string, Scheduled> = {
  'killreport-queue-characters.service': job(
    'queue:characters',
    'Mon *-*-* 16:10:00 UTC',
  ),
  'killreport-queue-character-corporations.service': job(
    'queue:character-corporations',
    'Mon *-*-* 17:00:00 UTC',
  ),
  'killreport-queue-character-corporation-history.service': job(
    'queue:character-corporation-history',
    'Mon *-*-* 03:00:00 UTC',
  ),
  'killreport-queue-alliances.service': job(
    'queue:alliances',
    '*-*-* 22:00:00 UTC',
  ),
  'killreport-queue-alliance-corporations.service': job(
    'queue:alliance-corporations',
    '*-*-* 22:05:00 UTC',
  ),
  'killreport-snapshot-alliances.service': job(
    'snapshot:alliances',
    '*-*-* 01:00:00 UTC',
  ),
  'killreport-update-alliance-counts.service': job(
    'update:alliance-counts',
    '*-*-* 01:00:00 UTC',
  ),
  'killreport-snapshot-corporations.service': job(
    'snapshot:corporations',
    '*-*-* 01:00:00 UTC',
  ),
  'killreport-worker-system-activity.service': job(
    'worker:system-activity',
    '*-*-* *:00:00 UTC',
  ),
  'killreport-worker-sov-campaigns.service': job(
    'worker:sov:campaigns',
    '*-*-* *:00/5:00 UTC',
    PUBSUB,
  ),
  'killreport-worker-sov-map.service': job(
    'worker:sov:map',
    '*-*-* *:00/30:00 UTC',
    PUBSUB,
  ),
  'killreport-worker-sov-structures.service': job(
    'worker:sov:structures',
    '*-*-* *:15,45:00 UTC',
  ),
  'killreport-worker-sov-snapshot.service': job(
    'worker:sov:snapshot',
    '*-*-* 01:00:00 UTC',
  ),
  'killreport-worker-sov-correlate.service': job(
    'worker:sov:correlate',
    '*-*-* *:00/10:00 UTC',
  ),
  'killreport-queue-prices.service': job('queue:prices', '*-*-* 06:00:00 UTC'),
};

const MANUAL = ['killreport-queue-backfill-values.service'];
const BACKUP = 'killreport-backup-db.service';

/** Units with an [Install] section, the `@` template expanded to its three instances. */
function installedUnits(): string[] {
  return Object.entries(loadUnits())
    .filter(([, u]) => u.has('Install'))
    .flatMap(([file]) =>
      file.includes('@.')
        ? [1, 2, 3].map((i) => file.replace('@.', `@${i}.`))
        : [file],
    )
    .sort();
}

const hasSystemdAnalyze =
  spawnSync('systemd-analyze', ['--version']).status === 0;

describe('systemd units', () => {
  it('every file is a killreport unit with LF endings', () => {
    expect(unitFiles()).not.toEqual([]);
    for (const file of unitFiles()) {
      expect(file).toMatch(
        /^killreport(-[a-z0-9-]+@?)?\.(service|timer|target)$/,
      );
      expect(fs.readFileSync(path.join(UNITS_DIR, file), 'utf8')).not.toContain(
        '\r',
      );
    }
  });

  it('killreport.target is wanted by multi-user.target', () => {
    const t = loadUnits()['killreport.target'];
    expect(t).toBeDefined();
    expect(value(t, 'Install', 'WantedBy')).toBe('multi-user.target');
  });

  it.each(serviceFiles())('%s: shared service rules', (file) => {
    const u = loadUnits()[file];
    expect(value(u, 'Service', 'User')).toBe('killreport');
    expect(value(u, 'Service', 'NoNewPrivileges')).toBe('true');
    expect(value(u, 'Service', 'PrivateTmp')).toBe('true');
    expect(value(u, 'Service', 'ProtectSystem')).toBe('full');
    expect(value(u, 'Service', 'TimeoutStopSec')).toBe('30');
    expect(values(u, 'Unit', 'Requires')).toEqual([]);
    expect(values(u, 'Service', 'EnvironmentFile')).toEqual([]);
    expect([
      '/var/www/killreport/backend',
      '/var/www/killreport/frontend',
    ]).toContain(value(u, 'Service', 'WorkingDirectory'));
  });

  it.each(serviceFiles())(
    '%s: a yarn ExecStart names an existing script and stops with SIGINT',
    (file) => {
      const u = loadUnits()[file];
      const exec = value(u, 'Service', 'ExecStart') ?? '';
      const yarn = /^\/usr\/bin\/yarn (\S+)$/.exec(exec);
      if (!yarn) return;
      const workspace = path.basename(
        value(u, 'Service', 'WorkingDirectory') ?? '',
      );
      expect(Object.keys(scripts(workspace))).toContain(yarn[1]);
      expect(value(u, 'Service', 'KillSignal')).toBe('SIGINT');
      // Yarn turns a child killed by SIGINT into exit 128+2; without this a
      // clean `systemctl stop` would leave the unit `failed`.
      expect(value(u, 'Service', 'SuccessExitStatus')).toBe('130');
    },
  );

  it.each(serviceFiles())(
    '%s: a Rust ExecStart names an existing crate',
    (file) => {
      const u = loadUnits()[file];
      const exec = value(u, 'Service', 'ExecStart') ?? '';
      if (!exec.startsWith(RUST_BIN)) return;
      expect(rustUnitProblems(u, exec.slice(RUST_BIN.length))).toEqual([]);
    },
  );

  it.each(Object.entries(CONTINUOUS))(
    '%s: continuous service matches the inventory',
    (file, c) => {
      const u = loadUnits()[file];
      expect(u).toBeDefined();
      expectExec(u, c);
      expect(value(u, 'Service', 'WorkingDirectory')).toBe(
        `/var/www/killreport/${c.workspace}`,
      );
      expect(env(u)).toEqual(c.env);
      expect([
        value(u, 'Service', 'MemoryHigh'),
        value(u, 'Service', 'MemoryMax'),
      ]).toEqual(c.memory);
      expect(value(u, 'Service', 'Restart')).toBe('always');
      expect(value(u, 'Service', 'RestartSec')).toBe('5');
      expect(value(u, 'Unit', 'StartLimitIntervalSec')).toBe('0');
      expect(value(u, 'Unit', 'PartOf')).toBe('killreport.target');
      expect(value(u, 'Install', 'WantedBy')).toBe('killreport.target');
      for (const dep of DEPS) {
        expect(list(u, 'Unit', 'Wants')).toContain(dep);
        expect(list(u, 'Unit', 'After')).toContain(dep);
      }
    },
  );

  it.each(Object.entries(SCHEDULED))(
    '%s: oneshot job matches the inventory',
    (file, s) => {
      const u = loadUnits()[file];
      expect(u).toBeDefined();
      expect(value(u, 'Service', 'Type')).toBe('oneshot');
      expectExec(u, s);
      expect(value(u, 'Service', 'WorkingDirectory')).toBe(
        '/var/www/killreport/backend',
      );
      expect(env(u)).toEqual(s.env);
      expect(value(u, 'Service', 'Restart')).toBeUndefined();
      expect(value(u, 'Service', 'MemoryMax')).toBeUndefined();
      expect(u.has('Install')).toBe(false);
      expect(value(u, 'Unit', 'PartOf')).toBe('killreport.target');
      for (const dep of DEPS) {
        expect(list(u, 'Unit', 'Wants')).toContain(dep);
        expect(list(u, 'Unit', 'After')).toContain(dep);
      }

      const t = loadUnits()[file.replace(/\.service$/, '.timer')];
      expect(t).toBeDefined();
      expect(value(t, 'Timer', 'OnCalendar')).toBe(s.onCalendar);
      expect(value(t, 'Timer', 'Persistent')).toBe('true');
      expect(value(t, 'Timer', 'AccuracySec')).toBe('1s');
      expect(value(t, 'Unit', 'PartOf')).toBe('killreport.target');
      expect(value(t, 'Install', 'WantedBy')).toBe('killreport.target');
    },
  );

  it('every timer has a service and every oneshot has a timer, except the manual ones', () => {
    const files = unitFiles();
    for (const timer of files.filter((f) => f.endsWith('.timer'))) {
      expect(files).toContain(timer.replace(/\.timer$/, '.service'));
    }
    const units = loadUnits();
    const oneshots = serviceFiles().filter(
      (f) => value(units[f], 'Service', 'Type') === 'oneshot',
    );
    const timed = oneshots.filter(
      (f) => !files.includes(f.replace(/\.service$/, '.timer')),
    );
    expect(timed).toEqual(MANUAL);
  });

  it('the manual backfill queue is a oneshot with no timer and no [Install]', () => {
    const u = loadUnits()[MANUAL[0]];
    expect(u).toBeDefined();
    expect(value(u, 'Service', 'Type')).toBe('oneshot');
    expect(value(u, 'Service', 'ExecStart')).toBe(
      '/usr/bin/yarn queue:backfill-values',
    );
    expect(env(u)).toEqual({ NODE_ENV: 'production', LOG_LEVEL: 'info' });
    expect(value(u, 'Unit', 'PartOf')).toBe('killreport.target');
    expect(u.has('Install')).toBe(false);
  });

  it('backup runs daily at 04:00 UTC from backend/, outside killreport.target', () => {
    const u = loadUnits()[BACKUP];
    expect(u).toBeDefined();
    expect(value(u, 'Service', 'Type')).toBe('oneshot');
    expect(value(u, 'Service', 'ExecStart')).toBe(
      '/bin/bash scripts/backup-db.sh',
    );
    expect(value(u, 'Service', 'WorkingDirectory')).toBe(
      '/var/www/killreport/backend',
    );
    expect(fs.existsSync(path.join(REPO, 'backend/scripts/backup-db.sh'))).toBe(
      true,
    );
    expect(value(u, 'Unit', 'PartOf')).toBeUndefined();
    expect(list(u, 'Unit', 'Wants')).toEqual(['network-online.target']);
    expect(list(u, 'Unit', 'After')).toEqual(['network-online.target']);
    expect(u.has('Install')).toBe(false);

    const t = loadUnits()[BACKUP.replace(/\.service$/, '.timer')];
    expect(t).toBeDefined();
    expect(value(t, 'Timer', 'OnCalendar')).toBe('*-*-* 04:00:00 UTC');
    expect(value(t, 'Timer', 'Persistent')).toBe('true');
    expect(value(t, 'Timer', 'AccuracySec')).toBe('1s');
    expect(value(t, 'Unit', 'PartOf')).toBeUndefined();
    expect(value(t, 'Install', 'WantedBy')).toBe('killreport.target');
  });

  it('only the target, the continuous services and the timers are installable', () => {
    const expected = [
      'killreport.target',
      ...Object.keys(CONTINUOUS).flatMap((f) =>
        f.includes('@.')
          ? [1, 2, 3].map((i) => f.replace('@.', `@${i}.`))
          : [f],
      ),
      ...Object.keys(SCHEDULED).map((f) => f.replace(/\.service$/, '.timer')),
      BACKUP.replace(/\.service$/, '.timer'),
    ].sort();
    expect(installedUnits()).toEqual(expected);
  });

  it('PM2 is gone', () =>
    expect(fs.existsSync(path.join(REPO, 'ecosystem.config.js'))).toBe(false));

  it('systemd.md enables exactly the units that have an [Install] section', () => {
    const doc = fs.readFileSync(
      path.join(REPO, 'backend/docs/ops/systemd.md'),
      'utf8',
    );
    const lines = doc.split('\n').filter((l) => l.includes('systemctl enable'));
    expect(lines).toHaveLength(1);
    const listed = lines[0]
      .split(/\s+/)
      .filter((t) => /\.(service|timer|target)$/.test(t));
    expect(listed.sort()).toEqual(installedUnits());
  });

  it.skipIf(!hasSystemdAnalyze)(
    'every OnCalendar parses with systemd-analyze',
    () => {
      const units = loadUnits();
      for (const timer of unitFiles().filter((f) => f.endsWith('.timer'))) {
        const expr = value(units[timer], 'Timer', 'OnCalendar') ?? '';
        expect(() =>
          execFileSync('systemd-analyze', ['calendar', expr], {
            stdio: 'pipe',
          }),
        ).not.toThrow();
      }
    },
  );
});

describe('rust unit rules', () => {
  const unit = (exec: string, extra: string[] = [], env = ['NO_COLOR=1']) =>
    parseUnit(
      [
        '[Service]',
        `ExecStart=${exec}`,
        'WorkingDirectory=/var/www/killreport/backend',
        ...env.map((e) => `Environment=${e}`),
        ...extra,
      ].join('\n'),
    );
  const good = (extra: string[] = [], env?: string[]) =>
    unit(`${RUST_BIN}worker-sovereignty-map`, extra, env);

  it('accepts a binary path that names an existing crate', () => {
    expect(rustUnitProblems(good(), 'worker-sovereignty-map')).toEqual([]);
  });

  it('rejects a path outside backend-rs/bin', () => {
    const u = unit('/usr/local/bin/worker-sovereignty-map');
    expect(rustUnitProblems(u, 'worker-sovereignty-map')).not.toEqual([]);
  });

  it('rejects a crate that does not exist', () => {
    const u = unit(`${RUST_BIN}worker-nope`);
    expect(rustUnitProblems(u, 'worker-nope')).not.toEqual([]);
  });

  it('rejects SIGINT and exit 130', () => {
    expect(
      rustUnitProblems(good(['KillSignal=SIGINT']), 'worker-sovereignty-map'),
    ).toHaveLength(1);
    expect(
      rustUnitProblems(
        good(['SuccessExitStatus=130']),
        'worker-sovereignty-map',
      ),
    ).toHaveLength(1);
  });

  it('rejects Node environment and colours', () => {
    expect(
      rustUnitProblems(
        good([], ['NO_COLOR=1', 'NODE_ENV=production']),
        'worker-sovereignty-map',
      ),
    ).not.toEqual([]);
    expect(
      rustUnitProblems(good([], []), 'worker-sovereignty-map'),
    ).not.toEqual([]);
  });
});
