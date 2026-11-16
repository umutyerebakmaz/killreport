# PM2'den systemd'ye geçiş — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `ecosystem.config.js`'teki 32 PM2 girdisini ve crontab'daki DB
backup'ını `deploy/systemd/` altında süreç başına birer systemd unit'ine
çevirmek, PM2'yi repodan kaldırmak ve dokümanları buna göre yeniden yazmak.

**Architecture:** Süreç başına bir `.service` dosyası (tek istisna:
`worker-backfill-values@.service` template'i), her zamanlanmış job için bir
`.timer`, hepsini toplayan `killreport.target`. Spec'teki değerler
(komut, ortam, bellek, takvim) bir vitest guard spec'inde envanter tablosu
olarak sabitlenir; guard her unit'i parse edip tabloya ve ortak kurallara
karşı denetler.

**Tech Stack:** systemd unit dosyaları (INI), vitest (backend workspace),
Markdown.

**Spec:** `docs/superpowers/specs/2026-11-16-systemd-process-management-design.md`

## Global Constraints

- Branch: `chore/systemd-process-management`. Commit mesajları, PR ve repodaki
  bütün dosyalar (unit'ler, `backend/docs/`, `CLAUDE.md`) **İngilizce**.
  Yalnızca `docs/superpowers/` altındaki spec/plan metinleri Türkçe.
- Commit'lerde Claude atfı yok (`Co-Authored-By` yok, footer yok).
- Unit adı: `killreport-` + bugünkü PM2 `name`'i.
- Her backend unit'i: `WorkingDirectory=/var/www/killreport/backend`;
  frontend: `WorkingDirectory=/var/www/killreport/frontend`.
  `EnvironmentFile=` kullanılmaz.
- Her service: `User=killreport`, `NoNewPrivileges=true`, `PrivateTmp=true`,
  `ProtectSystem=full`, `TimeoutStopSec=30`.
- Node `ExecStart`: `/usr/bin/yarn <script>` ve `KillSignal=SIGINT`. Bu iş
  hiçbir unit'i Rust komutuyla kurmaz.
- Sürekli service: `Restart=always`, `RestartSec=5`,
  `StartLimitIntervalSec=0` (`[Unit]`), `MemoryHigh` + `MemoryMax`,
  `[Install] WantedBy=killreport.target`.
- Zamanlanmış service: `Type=oneshot`, `Restart=` yok, `[Install]` yok, bellek
  sınırı yok.
- Timer: `OnCalendar=… UTC`, `Persistent=true`, `AccuracySec=1s`,
  `[Install] WantedBy=killreport.target`.
- Backup dışındaki her service ve timer: `PartOf=killreport.target`.
- Bağımlılıklar `Wants=` + `After=`, asla `Requires=`:
  `network-online.target rabbitmq-server.service redis-server.service`
  (backup: yalnızca `network-online.target`).
- `.env` ve sırlar düzenlenmez. Yarn, npm değil.

## Review Focus

1. **`package.json`'da bir script yeniden adlandırılırsa** unit sessizce
   kırılır (droplet'te `yarn` "command not found" ile çıkar, kimse fark
   etmez) — guard, her `ExecStart` script'inin ilgili workspace'in
   `package.json`'ında var olduğunu denetler (Task 1).
2. **Bir `OnCalendar=` ifadesi sözdizimsel olarak geçersiz ya da yanlış
   saatte** — guard ifadeleri spec tablosuna karşı sabitler ve
   `systemd-analyze` olan makinede (CI, ubuntu) her birini
   `systemd-analyze calendar` ile doğrular (Task 3).
3. **`systemd.md`'deki enable listesi bir unit'i atlarsa** o unit droplet'te
   hiç başlamaz — guard, dokümandaki `systemctl enable` satırını `[Install]`
   bölümü olan unit kümesiyle karşılaştırır (Task 4).
4. **PM2 geri sızarsa** (yeni bir `ecosystem.config.js` ya da dokümanda `pm2`
   komutu) iki yönetici dönemi geri gelir — guard dosyanın yokluğunu, Task 5
   de `grep` ile doküman temizliğini denetler.
5. **Yalnızca `SIGINT` dinleyen bir Node worker'ına `SIGTERM` gider** ve temiz
   kapanmaz — guard, `yarn` ile başlayan her service'te `KillSignal=SIGINT`
   arar (Task 1).

---

### Task 1: Guard spec, target, API ve frontend

**Files:**

- Create: `backend/src/ops/systemd-units.guard.spec.ts`
- Create: `deploy/systemd/killreport.target`
- Create: `deploy/systemd/killreport-backend.service`
- Create: `deploy/systemd/killreport-frontend.service`

**Interfaces:**

- Produces (guard spec içinde, sonraki task'lar genişletir):
  - `const REPO = path.resolve(__dirname, '../../..')`,
    `const UNITS_DIR = path.join(REPO, 'deploy/systemd')`
  - `type Unit = Map<string, Array<[key: string, value: string]>>` (bölüm adı →
    sıralı anahtar/değer; `Environment`, `Wants` gibi tekrarlı anahtarlar
    korunur)
  - `parseUnit(text: string): Unit` — `#`/`;` yorumları ve boş satırlar
    atlanır.
  - `values(u: Unit, section: string, key: string): string[]`,
    `value(u: Unit, section: string, key: string): string | undefined`
    (birden fazla varsa test hata verir)
  - `loadUnits(): Record<string, Unit>` — dosya adı → parse edilmiş unit.
  - `serviceFiles(): string[]` — `UNITS_DIR` altındaki `.service` dosya adları, sıralı.
  - `env(u: Unit): Record<string, string>` — `Environment=KEY=VALUE` satırları nesne olarak.
  - `type Continuous = { script: string; workspace: 'backend' | 'frontend'; env: Record<string, string>; memory: [high: string, max: string] }`
  - `const CONTINUOUS: Record<string, Continuous>` — anahtar unit dosya adı.
    Bu task'ta yalnızca `killreport-backend.service` ve
    `killreport-frontend.service`.

- [ ] **Step 1: Branch'i aç ve spec'i commit et**

```bash
git switch -c chore/systemd-process-management
git add docs/superpowers/specs/2026-11-16-systemd-process-management-design.md docs/superpowers/plans/2026-11-16-systemd-process-management.md
git commit -m "docs: design and plan for moving process management from PM2 to systemd"
```

- [ ] **Step 2: Guard spec'i yaz (başarısız olacak)**

`describe('systemd units', …)` altında şu testler. Ortak kurallar her service
için `it.each` ile çalışır, böylece sonraki task'larda eklenen dosyalar
kendiliğinden denetlenir.

```ts
it('every file is a killreport unit with LF endings', () => {
  for (const file of fs.readdirSync(UNITS_DIR)) {
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
  expect(value(t, 'Install', 'WantedBy')).toBe('multi-user.target');
});

// her .service için:
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
    // ExecStart `/usr/bin/yarn <script>` ise: WorkingDirectory'nin package.json'ında
    // scripts[<script>] tanımlı, KillSignal === 'SIGINT'.
  },
);

it.each(Object.entries(CONTINUOUS))(
  '%s: continuous service matches the inventory',
  (file, c) => {
    const u = loadUnits()[file];
    expect(value(u, 'Service', 'ExecStart')).toBe(`/usr/bin/yarn ${c.script}`);
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
    for (const dep of [
      'network-online.target',
      'rabbitmq-server.service',
      'redis-server.service',
    ]) {
      expect(values(u, 'Unit', 'Wants').join(' ').split(/\s+/)).toContain(dep);
      expect(values(u, 'Unit', 'After').join(' ').split(/\s+/)).toContain(dep);
    }
  },
);
```

`CONTINUOUS` başlangıç değerleri (spec, _API ve frontend_):

| Dosya                         | `script` | `workspace` | `env`                                                                                                              | `memory`         |
| ----------------------------- | -------- | ----------- | ------------------------------------------------------------------------------------------------------------------ | ---------------- |
| `killreport-backend.service`  | `start`  | `backend`   | `NODE_ENV=production`, `PORT=4000`, `LOG_LEVEL=debug`, `USE_REDIS_PUBSUB=true`, `REDIS_URL=redis://localhost:6379` | `['900M', '1G']` |
| `killreport-frontend.service` | `start`  | `frontend`  | `NODE_ENV=production`, `PORT=3000`                                                                                 | `['900M', '1G']` |

- [ ] **Step 3: Çalıştır, başarısız olduğunu gör**

Run: `yarn workspace backend test src/ops/systemd-units.guard.spec.ts`
Expected: FAIL, `ENOENT … deploy/systemd`.

- [ ] **Step 4: `killreport.target`, `killreport-backend.service`, `killreport-frontend.service`'i yaz**

Biçim spec'teki _Sürekli çalışan bir worker_ örneğiyle aynı; değerler
yukarıdaki tablodan. Target: `[Unit] Description=KillReport (all services and timers)`,
`[Install] WantedBy=multi-user.target`. Ortam satırları tek tek
`Environment=KEY=VALUE`.

- [ ] **Step 5: Çalıştır, geçtiğini gör**

Run: `yarn workspace backend test src/ops/systemd-units.guard.spec.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `yarn workspace backend build`
Expected: hatasız çıkış.

- [ ] **Step 7: Commit**

```bash
git add backend/src/ops/systemd-units.guard.spec.ts deploy/systemd
git commit -m "chore(deploy): add systemd target and units for the API and frontend"
```

---

### Task 2: Sürekli çalışan worker'lar

**Files:**

- Create: `deploy/systemd/killreport-worker-*.service` (13 dosya, aşağıdaki tablo)
- Create: `deploy/systemd/killreport-worker-backfill-values@.service`
- Modify: `backend/src/ops/systemd-units.guard.spec.ts` (`CONTINUOUS`'a 14 satır)

**Interfaces:**

- Consumes: Task 1'deki `CONTINUOUS`, `loadUnits`, ortak kurallar.

- [ ] **Step 1: `CONTINUOUS`'a 14 satırı ekle**

Hepsi `workspace: 'backend'`, `env: { NODE_ENV: 'production', LOG_LEVEL: 'debug' }`,
`memory: ['460M', '512M']`:

| Dosya                                                     | `script`                               |
| --------------------------------------------------------- | -------------------------------------- |
| `killreport-worker-redisq.service`                        | `worker:redisq`                        |
| `killreport-worker-alliances.service`                     | `worker:info:alliances`                |
| `killreport-worker-corporations.service`                  | `worker:info:corporations`             |
| `killreport-worker-alliance-corporations.service`         | `worker:alliance-corporations`         |
| `killreport-worker-types.service`                         | `worker:info:types`                    |
| `killreport-worker-zkillboard.service`                    | `worker:zkillboard`                    |
| `killreport-worker-user-killmails.service`                | `worker:user-killmails`                |
| `killreport-worker-corporation-killmails.service`         | `worker:corporation-killmails`         |
| `killreport-worker-killmail-detail.service`               | `worker:killmail-detail`               |
| `killreport-worker-discord-webhook.service`               | `worker:discord-webhook`               |
| `killreport-worker-characters.service`                    | `worker:info:characters`               |
| `killreport-worker-character-corporation-history.service` | `worker:character-corporation-history` |
| `killreport-worker-prices.service`                        | `worker:prices`                        |
| `killreport-worker-backfill-values@.service`              | `worker:backfill-values`               |

- [ ] **Step 2: Çalıştır, 14 dosya için başarısız olduğunu gör**

Run: `yarn workspace backend test src/ops/systemd-units.guard.spec.ts`
Expected: FAIL, 14 `continuous service matches the inventory` vakası.

- [ ] **Step 3: 14 unit dosyasını yaz**

Spec'teki `killreport-worker-alliances.service` örneği kalıp. Her birinin
`Description=` satırı tükettiği kuyruğu adlandırır (kuyruk adı worker
dosyasındaki `QUEUE_NAME`). Template'te `Description=… (instance %i)`.

- [ ] **Step 4: Çalıştır, geçtiğini gör**

Run: `yarn workspace backend test src/ops/systemd-units.guard.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/ops/systemd-units.guard.spec.ts deploy/systemd
git commit -m "chore(deploy): add systemd units for the long-running workers"
```

---

### Task 3: Zamanlanmış job'lar, elle çalışan job ve backup

**Files:**

- Create: `deploy/systemd/killreport-<job>.service` ve `.timer` (15 çift)
- Create: `deploy/systemd/killreport-queue-backfill-values.service`
- Create: `deploy/systemd/killreport-backup-db.service`, `killreport-backup-db.timer`
- Modify: `backend/src/ops/systemd-units.guard.spec.ts`

**Interfaces:**

- Consumes: Task 1'in yardımcıları ve ortak kuralları.
- Produces: `type Scheduled = { script: string; onCalendar: string; env: Record<string, string> }`,
  `const SCHEDULED: Record<string, Scheduled>` (anahtar: `.service` dosya adı),
  `const MANUAL = ['killreport-queue-backfill-values.service']`,
  `installedUnits(): string[]` — `[Install]` bölümü olan unit adları,
  template `@` için `@1`, `@2`, `@3`'e açılmış. Task 4 bunu kullanır.

- [ ] **Step 1: `SCHEDULED`, `MANUAL` ve testleri ekle**

`SCHEDULED` değerleri spec'in _Envanter → Zamanlanmış_ tablosundan **aynen**
(`script`, `onCalendar`). Hepsinde `env` `NODE_ENV=production`,
`LOG_LEVEL=info`; `worker-sov-campaigns` ve `worker-sov-map` ek olarak
`USE_REDIS_PUBSUB=true`. Backup `SCHEDULED`'da değil, kendi testinde.

Testler:

```ts
it.each(Object.entries(SCHEDULED))('%s: oneshot job matches the inventory', (file, s) => {
  const u = loadUnits()[file];
  expect(value(u, 'Service', 'Type')).toBe('oneshot');
  expect(value(u, 'Service', 'ExecStart')).toBe(`/usr/bin/yarn ${s.script}`);
  expect(env(u)).toEqual(s.env);
  expect(value(u, 'Service', 'Restart')).toBeUndefined();
  expect(value(u, 'Service', 'MemoryMax')).toBeUndefined();
  expect(u.has('Install')).toBe(false);
  expect(value(u, 'Unit', 'PartOf')).toBe('killreport.target');

  const t = loadUnits()[file.replace(/\.service$/, '.timer')];
  expect(value(t, 'Timer', 'OnCalendar')).toBe(s.onCalendar);
  expect(value(t, 'Timer', 'Persistent')).toBe('true');
  expect(value(t, 'Timer', 'AccuracySec')).toBe('1s');
  expect(value(t, 'Unit', 'PartOf')).toBe('killreport.target');
  expect(value(t, 'Install', 'WantedBy')).toBe('killreport.target');
});

it('every timer has a service and every oneshot has a timer, except the manual ones', …);
it('the manual backfill queue is a oneshot with no timer and no [Install]', …);

it('backup runs daily at 04:00 UTC from backend/, outside killreport.target', () => {
  // service: Type=oneshot, ExecStart='/bin/bash scripts/backup-db.sh',
  //   WorkingDirectory=/var/www/killreport/backend, PartOf yok,
  //   Wants/After yalnızca network-online.target,
  //   fs.existsSync(REPO/backend/scripts/backup-db.sh)
  // timer: OnCalendar='*-*-* 04:00:00 UTC', Persistent, AccuracySec=1s, PartOf yok
});

it.skipIf(!hasSystemdAnalyze)('every OnCalendar parses with systemd-analyze', () => {
  // her timer için execFileSync('systemd-analyze', ['calendar', expr]) hata atmaz
});
```

`hasSystemdAnalyze`: `spawnSync('systemd-analyze', ['--version']).status === 0`.
Yerelde (Windows) atlanır, CI'da (ubuntu-latest) koşar.

`env(u)` Task 1'de tanımlı; Task 1'in envanter testi de onu kullanır.

- [ ] **Step 2: Çalıştır, başarısız olduğunu gör**

Run: `yarn workspace backend test src/ops/systemd-units.guard.spec.ts`
Expected: FAIL, eksik dosyalar.

- [ ] **Step 3: 33 unit dosyasını yaz**

Kalıp spec'teki `killreport-queue-alliances.{service,timer}` örneği. Backup
service'inde `[Unit]` `PartOf` taşımaz; timer'ı da taşımaz. Timer
`Description=` satırı takvimi insan diliyle söyler
("daily 22:00 UTC").

- [ ] **Step 4: Çalıştır, geçtiğini gör**

Run: `yarn workspace backend test src/ops/systemd-units.guard.spec.ts`
Expected: PASS (`systemd-analyze` testi yerelde `skipped`).

- [ ] **Step 5: Commit**

```bash
git add backend/src/ops/systemd-units.guard.spec.ts deploy/systemd
git commit -m "chore(deploy): add systemd timers for the scheduled jobs and the database backup"
```

---

### Task 4: PM2'yi kaldır, ops dokümanı ve CLAUDE.md

**Files:**

- Delete: `ecosystem.config.js`
- Delete: `backend/docs/ops/pm2.md`
- Create: `backend/docs/ops/systemd.md` (İngilizce)
- Modify: `backend/docs/ops/crontab.md`
- Modify: `CLAUDE.md` — _Scheduling is only for mutable data_ (`:582-592`),
  _File map_ satırı (`:707`), `pm2` geçen diğer satırlar
- Modify: `docs/superpowers/specs/2026-11-12-rust-worker-spike-design.md`,
  _Aşama 2_ (`:363-402`, Türkçe)
- Modify: `backend/src/ops/systemd-units.guard.spec.ts`

**Interfaces:**

- Consumes: Task 3'teki `installedUnits()`.

- [ ] **Step 1: İki testi ekle**

```ts
it('PM2 is gone', () =>
  expect(fs.existsSync(path.join(REPO, 'ecosystem.config.js'))).toBe(false));

it('systemd.md enables exactly the units that have an [Install] section', () => {
  const doc = fs.readFileSync(
    path.join(REPO, 'backend/docs/ops/systemd.md'),
    'utf8',
  );
  const line = doc.split('\n').find((l) => l.includes('systemctl enable'))!;
  const listed = line
    .split(/\s+/)
    .filter((t) => /\.(service|timer|target)$/.test(t));
  expect(listed.sort()).toEqual(
    [...installedUnits(), 'killreport.target'].sort(),
  );
});
```

`systemd.md`'de `systemctl enable` geçen **tek** satır bu olur (diğer
örneklerde `systemctl start`, `restart` vb.).

- [ ] **Step 2: Çalıştır, başarısız olduğunu gör**

Run: `yarn workspace backend test src/ops/systemd-units.guard.spec.ts`
Expected: FAIL, iki yeni test.

- [ ] **Step 3: `ecosystem.config.js` ve `pm2.md`'yi sil, `systemd.md`'yi yaz**

`systemd.md` bölümleri (spec'ten, İngilizce):

1. Overview: tek yönetici, `deploy/systemd/` dosya düzeni, isimlendirme.
2. Install and update: spec'teki `cp` + `daemon-reload` satırı; neden
   `systemctl link` değil.
3. Enable: tek satır, bütün `installedUnits()` + `killreport.target`
   açıkça yazılı; glob neden yok; yeni unit eklenince bu satır da güncellenir
   (guard denetler).
4. Daily commands: spec _Loglar_'daki komutlar, `systemctl stop/start killreport.target`,
   tek job'u elle çalıştırma (`systemctl start killreport-queue-alliances`),
   `systemctl start killreport-queue-backfill-values`.
5. Inventory: spec'in üç envanter tablosu ve backup.
6. Memory and shutdown: `MemoryHigh`/`MemoryMax`, `KillSignal`, 30 s.
7. Moving a unit to Rust: spec'teki diff, binary yolu
   `/var/www/killreport/backend-rs/bin/<crate>`, geri dönüş.
8. Server setup (once): `killreport` kullanıcısı, `/var/www/killreport`
   sahipliği, `timedatectl` kontrolü, `journald.conf` `SystemMaxUse=`.

Markdown linkleri dosyaya göreli (CLAUDE.md, _Markdown links_).

- [ ] **Step 4: `crontab.md`, `CLAUDE.md` ve spike spec'ini güncelle**

- `crontab.md`: kısalt. Crontab'ın boş olduğu, backup'ın
  `killreport-backup-db.timer`'da olduğu, log temizliği ve `pm2 flush`
  satırlarının neden kalktığı; `systemd.md`'ye link. Cron sözdizimi
  anlatımı kalkar.
- `CLAUDE.md` _Scheduling_: "There is **one** scheduling mechanism: systemd
  timers in `deploy/systemd/` …"; iki-mekanizma paragrafı ve #316 cümlesi,
  "a job is scheduled in exactly one timer; the crontab stays empty" olarak.
  _File map_: `| systemd units | deploy/systemd/ |`. Statik veri cümlesi
  ("appears in **neither**") "has no timer" olur.
- Spike spec _Aşama 2_: adım 4 ve 6'daki PM2 girdisi / `pm2 stop|start`,
  spec'in _Rust'a geçiş_ bölümündeki diff + `daemon-reload` +
  `systemctl restart killreport-worker-alliances` ile değişir; `kill_timeout`
  paragrafı `TimeoutStopSec=30` ve `KillSignal`'a dönüşür. Ölçüm adımları
  (3, 5) değişmez, yalnızca `ps -o rss` hedefi
  `systemctl show -p MainPID killreport-worker-alliances` ile bulunur.

- [ ] **Step 5: Çalıştır, geçtiğini gör; link ve format kontrolü**

```bash
yarn workspace backend test src/ops/systemd-units.guard.spec.ts
yarn docs:check-links
npx prettier --check CLAUDE.md backend/docs/ops docs/superpowers/specs/2026-11-12-rust-worker-spike-design.md
```

Expected: PASS; link kontrolü kırık link raporlamaz; prettier temiz.

- [ ] **Step 6: Commit**

```bash
git add -A ecosystem.config.js backend/docs/ops CLAUDE.md docs/superpowers/specs/2026-11-12-rust-worker-spike-design.md backend/src/ops/systemd-units.guard.spec.ts
git commit -m "chore: remove PM2 and document systemd as the only process manager"
```

---

### Task 5: Diğer dokümanlardaki PM2 izleri

**Files:**

- Modify: `pm2` geçen `backend/docs/**/*.md` dosyaları (2026-11-16'da,
  `ops/pm2.md` ve `ops/crontab.md` hariç 27 dosya) ve
  `backend/docs/README.md`.

`docs/superpowers/` ve `.superpowers/` altındaki eski spec/plan/arşivler
tarihsel kayıttır, **değiştirilmez**.

- [ ] **Step 1: Listeyi çıkar**

Run: `grep -rlin "pm2\|ecosystem.config" --include=*.md backend/docs CLAUDE.md`
Expected: `systemd.md` dışında güncellenecek dosyaların listesi.

- [ ] **Step 2: Her dosyada PM2 komutlarını karşılığıyla değiştir**

Eşleme: `pm2 logs X` → `journalctl -u killreport-X -f`;
`pm2 restart X` → `sudo systemctl restart killreport-X`;
`pm2 start ecosystem.config.js [--only X]` → `sudo systemctl start killreport.target` /
`killreport-X`; `pm2 ls|status|monit` → `systemctl list-units 'killreport-*'`;
`pm2 stop X` → `sudo systemctl stop killreport-X`. Bir job'un PM2
`cron_restart` saatine değinen cümle timer'ı ve `systemd.md`'yi gösterir.
Artık anlamı kalmayan cümle (ör. `pm2 save`, `pm2 startup`) silinir.
`systemd.md` içindeki "PM2'den geçildi" gibi tarihsel bir cümle kalabilir.

- [ ] **Step 3: Kalan izleri doğrula**

Run: `grep -rin "pm2\|ecosystem.config" --include=*.md backend/docs CLAUDE.md`
Expected: yalnızca `backend/docs/ops/systemd.md`'deki tarihsel cümle(ler).

- [ ] **Step 4: Link ve format**

```bash
yarn docs:check-links
npx prettier --check backend/docs CLAUDE.md
```

Expected: kırık link yok, prettier temiz.

- [ ] **Step 5: Commit**

```bash
git add backend/docs CLAUDE.md
git commit -m "docs: replace PM2 commands with their systemd equivalents"
```

---

### Task 6: Son doğrulama ve PR

- [ ] **Step 1: Değişikliğin dokunabileceği kontroller**

```bash
yarn workspace backend test
yarn workspace backend build
npx prettier --check .
```

Expected: test PASS (yalnızca `systemd-analyze` testi yerelde skipped),
build hatasız, prettier temiz. Frontend'e dokunulmadığı için frontend
kontrolleri CI'a kalır.

- [ ] **Step 2: PR'ı aç** (kullanıcı onayıyla)

Başlık: `chore: replace PM2 with systemd units and timers`. Gövde (İngilizce):
özet, spec linki, _Bilinçli davranış değişiklikleri_ tablosu, "droplet
kurulumu bu PR'ın kapsamı dışında; `backend/docs/ops/systemd.md` adımları",
CI'da `systemd-analyze` testinin koştuğu. Claude atfı yok.
