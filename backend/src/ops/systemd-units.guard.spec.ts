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

type Continuous = {
  script: string;
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
    },
  );

  it.each(Object.entries(CONTINUOUS))(
    '%s: continuous service matches the inventory',
    (file, c) => {
      const u = loadUnits()[file];
      expect(u).toBeDefined();
      expect(value(u, 'Service', 'ExecStart')).toBe(
        `/usr/bin/yarn ${c.script}`,
      );
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
});
