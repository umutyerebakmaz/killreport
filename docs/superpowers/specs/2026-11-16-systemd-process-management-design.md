# PM2'den systemd'ye geçiş — tasarım

Tarih: 2026-11-16

## Amaç ve neden

Droplet'teki bütün süreçler (GraphQL API, Next.js frontend, sürekli çalışan
worker'lar ve zamanlanmış queue/job'lar) PM2 yerine systemd ile yönetilir. PM2
droplet'ten tamamen kalkar; `ecosystem.config.js` silinir.

Neden şimdi: worker'lar Rust'a taşınıyor (`backend-rs/`) ve bir Rust
binary'sinin süreç yöneticisi olarak PM2'ye, dolayısıyla Node'a ihtiyacı yok.
Droplet şu an aktif değil (`2026-11-12-rust-worker-spike-design.md:17`); yönetici
değişikliği, çalışan bir sistemde sonradan yapmaktan droplet yeniden kurulurken
yapmak çok daha ucuz. `2026-11-09-rust-backend-rewrite-analysis.md:473-490`
bu kararı "droplet yeniden kurulurken değerlendirilecek" diye açık bırakmıştı;
bu spec onu kapatır.

## Hedefler

- Her PM2 girdisinin systemd'de bire bir karşılığı olur; davranış (komut,
  ortam değişkenleri, bellek sınırı, zamanlama) değişmez, değiştiği yerde bu
  spec bunu açıkça söyler (_Bilinçli davranış değişiklikleri_).
- Droplet'te **tek** süreç yöneticisi ve **tek** zamanlama mekanizması kalır:
  systemd service ve timer. OS crontab'ı boşalır.
- Unit dosyaları repoda yaşar ve gözden geçirilir; sunucudaki kopya repodan
  kurulur.
- Bir worker Rust'a geçtiğinde değişen tek şey o unit'in `ExecStart` (ve
  gerekirse `KillSignal`) satırıdır; unit adı, timer'ı, logları aynı kalır.

## Hedef olmayanlar

- Worker'ları Rust'a taşımak. Bu spec her unit'i bugünkü **Node** komutuyla
  kurar; Rust'a geçiş worker başına ayrı iştir (bkz. _Rust'a geçiş_).
- Deploy otomasyonu (CI'dan artifact, otomatik dağıtım). Kurulum elle yapılır.
- `OnFailure=` ile çöken worker için bildirim (ör. Discord). Değerli, ayrı iş.
- Yedek saklama politikası (`backup-db.sh` eski yedekleri silmiyor). Ayrı iş.
- Yerel geliştirme. Windows'ta systemd yok ve gerek de yok; yerelde
  `yarn dev:*`, `yarn worker:*` ve `cargo run -p <crate>` aynen kalır.

## Anti-hedefler

Teknik olarak çalışsa bile başarısızlık sayılacaklar:

- Geçiş sırasında bir dönem **iki** yöneticinin (PM2 + systemd) aynı anda canlı
  süreç yönetmesi.
- Aynı işin hem bir timer'da hem başka bir yerde zamanlanması (#316).
- Tek bir unit'in gerçek ayarını görmek için birden fazla dosya okumak
  gerekmesi (template + drop-in dağınıklığı; tek istisna aşağıda).
- Bir worker'ın kapanırken elindeki mesajları bitirmeye fırsat bulamaması
  (bugünkü PM2 davranışından geriye gidiş).

## Kısıtlar

- Droplet: x86_64 Linux, tek makine. RabbitMQ ve Redis droplet'te, PostgreSQL
  managed (uzak). Ubuntu'da unit adları `rabbitmq-server.service` ve
  `redis-server.service`.
- CLAUDE.md "her worker kendi sürecinde": her worker ayrı unit, ayrı süreç.
  systemd bunu cgroup başına zaten sağlar.
- CLAUDE.md "bir job tam olarak bir mekanizmada": geçişten sonra o mekanizma
  systemd timer'ı.
- CLAUDE.md "`scripts/` altına dosya eklemeden önce tek satır yetiyor mu bak":
  kurulum bir `cp` + `systemctl daemon-reload` satırıdır, script dosyası
  gerekmez.
- `.env` ve sırlar düzenlenmez. Rust binary'si `.env`'i **çalışma dizininden**
  okur (`backend-rs/crates/runner/src/run.rs:31-35`), Node tarafı da
  `backend/.env`'i; bu yüzden backend tarafındaki her unit'in
  `WorkingDirectory=/var/www/killreport/backend`'dir ve `EnvironmentFile=`
  kullanılmaz. `dotenv` ve `dotenvy` var olan ortam değişkenini ezmez, yani
  unit'teki `Environment=` satırları bugünkü PM2 `env` bloğuyla aynı önceliğe
  sahiptir.
- Node worker'larının bir kısmı yalnızca `SIGINT` dinliyor (ör.
  `backend/src/workers/worker-backfill-values.ts:218`). PM2 bugün `SIGINT`
  gönderiyor; systemd'nin varsayılanı `SIGTERM`.

## Yaklaşımlar

### Süreç yöneticisi

| Seçenek                                   | Getirisi                                                                        | Bedeli                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Hepsi systemd (seçilen)**               | Tek yönetici, tek log yeri, tek zamanlama; Node'a operasyonel bağımlılık kalkar | API ve frontend için de unit yazılır                                                              |
| Worker'lar systemd, API + frontend PM2'de | `pm2 logs` alışkanlığı iki Node süreci için kalır                               | İki yönetici, iki log yeri; PM2'nin `fork` + `instances: 1` kullanımında kazandırdığı bir şey yok |
| Her şey PM2'de, Rust binary'leri dahil    | Değişiklik yok; PM2 binary'yi `interpreter: 'none'` ile çalıştırır              | Aşağıdaki kazançların hiçbiri gelmez                                                              |

Docker Compose (cron için ek bir container gerekir), kendi yazılacak bir Rust
supervisor (systemd'yi yeniden yazmak) ve Nomad/Kubernetes (tek droplet için
ağır) baştan elendi.

### PM2'den çıkınca ne kaybolur, ne kazanılır

| Kaybolan                                             | systemd'deki karşılığı                                                        |
| ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| `pm2 monit` tek ekran canlı CPU/bellek               | Yok; `systemd-cgtop` en yakını. **Gerçek kayıp.**                             |
| `pm2 ls`                                             | `systemctl list-units 'killreport-*'`, `systemctl list-timers 'killreport-*'` |
| `pm2 logs`                                           | `journalctl -u 'killreport-*' -f`                                             |
| Her şey tek dosyada (`ecosystem.config.js`)          | `deploy/systemd/` dizini                                                      |
| `max_memory_restart` süreci nazikçe yeniden başlatır | `MemoryMax=` sert OOM kill; önüne `MemoryHigh=` konur (bkz. _Bellek_)         |

| Kazanılan                 | Nasıl                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Çakışma yok               | `cron_restart` iş hâlâ çalışıyorsa onu öldürüp yeniden başlatır; timer servis çalışırken yeni koşu başlatmaz |
| Kaçan koşu telafi edilir  | `Persistent=true`: makine o saatte kapalıysa açılınca koşar                                                  |
| Gerçek bellek sınırı      | cgroup, kernel seviyesinde; PM2 aralıklı yoklar                                                              |
| Açılış sırası             | `After=rabbitmq-server.service redis-server.service`                                                         |
| Temiz kapanış             | `TimeoutStopSec=30`; PM2'nin varsayılanı 1,6 s sonra SIGKILL                                                 |
| Log rotasyonu kurulumsuz  | journald; pm2-logrotate ve `/var/www/killreport/logs/*.log` gider                                            |
| Tek zamanlama mekanizması | PM2 cron + crontab yerine yalnızca timer'lar                                                                 |

### Dosya düzeni

| Seçenek                                           | Getirisi                                                                                                        | Bedeli                                                                                   |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Süreç başına bir dosya (seçilen)**              | Bir sürecin tüm ayarı tek dosyada; bir `ecosystem` girdisinin bire bir karşılığı; Rust geçişi tek satırlık diff | Ortak satırlar (`User`, `Restart`, `WorkingDirectory`) her dosyada tekrar eder           |
| Template (`killreport-worker@.service`) + drop-in | Ortak ayar tek yerde                                                                                            | Node/Rust `ExecStart` farkı yüzünden neredeyse her instance'a override; iki dosya okumak |
| Manifest + üretici script                         | Tek kaynak                                                                                                      | Yeni bir script, üretilen dosyalarla senkron sorunu (CLAUDE.md'nin `scripts/` kuralı)    |

Tek istisna `worker-backfill-values`: bugün `instances: 3`. Bu, `@` template
olarak kalır (`killreport-worker-backfill-values@.service`, `@1`, `@2`, `@3`
enable edilir); üç instance aynı komutu çalıştırdığı için override gerekmez.

## Tasarım

### Repodaki yer ve kurulum

```text
deploy/systemd/
├── killreport.target
├── killreport-backend.service
├── killreport-frontend.service
├── killreport-worker-*.service            # sürekli çalışanlar
├── killreport-worker-backfill-values@.service
├── killreport-<job>.service               # Type=oneshot
├── killreport-<job>.timer                 # her zamanlanmış job için bir tane
└── killreport-backup-db.{service,timer}   # crontab'dan taşınan bakım
```

Kurulum ve güncelleme, ops dokümanında tek satır:

```bash
sudo cp /var/www/killreport/deploy/systemd/* /etc/systemd/system/ && sudo systemctl daemon-reload
```

**Etkinleştirme.** `killreport.target`'ı enable etmek altındaki unit'leri
enable etmez: `WantedBy=killreport.target` ancak unit'in kendisi enable
edildiğinde `killreport.target.wants/` altına symlink yazar. Bu yüzden
`[Install]` bölümü olan her unit tek tek enable edilir: `killreport.target`,
16 sürekli service (backfill için `@1`, `@2`, `@3`), 15 job timer'ı ve backup
timer'ı. Oneshot service'ler enable edilmez, onları timer başlatır. Glob
kullanılmaz, çünkü zamanlanmış `killreport-worker-sov-*.service` ve
`killreport-worker-system-activity.service` de `killreport-worker-*` desenine
uyar. `systemd.md` enable komutunu envanterden açıkça listeler; yeni bir unit
eklendiğinde o liste de güncellenir.

Target'ın içine `Wants=` listesi yazmak elendi: her yeni unit için ikinci bir
unit dosyasını düzenlemek gerekirdi. Bu da "süreç başına bir dosya" kararına
aykırı.

`systemctl link` kullanılmaz: unit'ler kopya olur, böylece `git pull` sırasında
yarım kalmış bir dosya çalışan sistemi etkilemez; değişiklik ancak bilinçli
`cp` + `daemon-reload` ile devreye girer.

### İsimlendirme

`killreport-` + bugünkü PM2 `name`'i. `killreport-backend` ve
`killreport-frontend` zaten bu biçimde. Örnek: PM2 `worker-alliances` →
`killreport-worker-alliances.service`. Bugünkü adlar korunur (Rust crate adı
`worker-info-alliances` olsa da), böylece ops dokümanlarındaki ve geçmiş
loglardaki adlar takip edilebilir kalır.

### `killreport.target`

`pm2 stop all` / `pm2 start all` karşılığı. Her service ve timer
`PartOf=killreport.target` ve `WantedBy=killreport.target` taşır; target'ın
kendisi `WantedBy=multi-user.target`.

```bash
systemctl stop killreport.target     # hepsini durdurur, timer'lar dahil
systemctl start killreport.target
```

### Sürekli çalışan bir worker

PM2'de `autorestart: true` olan girdiler. Örnek (bugünkü Node komutu):

```ini
# deploy/systemd/killreport-worker-alliances.service
[Unit]
Description=KillReport worker: alliance info (esi_alliance_info_queue)
Wants=network-online.target rabbitmq-server.service redis-server.service
After=network-online.target rabbitmq-server.service redis-server.service
PartOf=killreport.target
StartLimitIntervalSec=0

[Service]
User=killreport
WorkingDirectory=/var/www/killreport/backend
Environment=NODE_ENV=production
Environment=LOG_LEVEL=debug
ExecStart=/usr/bin/yarn worker:info:alliances
KillSignal=SIGINT
SuccessExitStatus=130
TimeoutStopSec=30
Restart=always
RestartSec=5
MemoryHigh=460M
MemoryMax=512M
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full

[Install]
WantedBy=killreport.target
```

- `Wants=` + `After=`, `Requires=` değil: RabbitMQ yeniden başlatıldığında
  worker'lar systemd tarafından durdurulmaz; kendi yeniden bağlanma / çökme +
  `Restart=always` yolları devreye girer.
- `StartLimitIntervalSec=0`: sınırsız yeniden deneme. Açılışta RabbitMQ geç
  kalkarsa worker vazgeçmez. PM2 bugün 15 kararsız yeniden başlatmadan sonra
  vazgeçiyor; bu bir davranış değişikliği (aşağıda).
- `RestartSec=5` hepsinde aynı. PM2'de bazı girdilerde `restart_delay: 5000`
  vardı, bazılarında hiç yoktu; tekdüzelik tercih edildi.
- `ExecStart` bir `yarn` script'idir; `package.json` komutun tek kaynağı olarak
  kalır. systemd'nin varsayılan `KillMode=control-group`'u sinyali cgroup'taki
  bütün süreçlere (yarn, tsx, node) gönderir, yani sarmalayıcı sinyali yutmaz.

### API ve frontend

Sürekli çalışan worker kalıbının aynısı, farkları:

| Unit                  | `ExecStart`                                                                 | `Environment=`                                                                                                     | `MemoryHigh` / `MemoryMax` | Ek                                                                 |
| --------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------- | ------------------------------------------------------------------ |
| `killreport-backend`  | `yarn start` (`backend/`)                                                   | `NODE_ENV=production`, `PORT=4000`, `LOG_LEVEL=debug`, `USE_REDIS_PUBSUB=true`, `REDIS_URL=redis://localhost:6379` | 900M / 1G                  | —                                                                  |
| `killreport-frontend` | `yarn start` (`frontend/`, `WorkingDirectory=/var/www/killreport/frontend`) | `NODE_ENV=production`, `PORT=3000`                                                                                 | 900M / 1G                  | `ReadWritePaths` gerekmez (`ProtectSystem=full` `/var`'a dokunmaz) |

PM2'deki `wait_ready` / `listen_timeout` taşınmaz: `next start`
`process.send('ready')` göndermiyor, PM2 bugün de 10 s'lik zaman aşımına düşüp
devam ediyor. `Type=simple` aynı sonucu verir.

### Zamanlanmış bir job

PM2'de `autorestart: false` + `cron_restart` olan girdiler. Service:

```ini
# deploy/systemd/killreport-queue-alliances.service
[Unit]
Description=KillReport queue: alliances (ESI root scan)
Wants=network-online.target rabbitmq-server.service redis-server.service
After=network-online.target rabbitmq-server.service redis-server.service
PartOf=killreport.target

[Service]
Type=oneshot
User=killreport
WorkingDirectory=/var/www/killreport/backend
Environment=NODE_ENV=production
Environment=LOG_LEVEL=info
ExecStart=/usr/bin/yarn queue:alliances
KillSignal=SIGINT
SuccessExitStatus=130
TimeoutStopSec=30
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
```

Service'in `[Install]` bölümü yoktur; onu yalnızca timer başlatır. Timer:

```ini
# deploy/systemd/killreport-queue-alliances.timer
[Unit]
Description=KillReport queue: alliances, daily 22:00 UTC
PartOf=killreport.target

[Timer]
OnCalendar=*-*-* 22:00:00 UTC
Persistent=true
AccuracySec=1s

[Install]
WantedBy=killreport.target
```

- Zaman dilimi her timer'da açıkça `UTC` yazılır. `cron_restart` sunucu yerel
  saatini kullanıyordu; CLAUDE.md saatleri UTC olarak veriyor. Yerel saat
  UTC değilse bu fark **kurulumdan önce** droplet'te `timedatectl` ile
  doğrulanır; değilse bu bir davranış değişikliğidir ve PR'da yazılır.
- `AccuracySec=1s`: varsayılan 1 dakikalık birleştirme, birbirine bağlı
  sıralı işleri (`queue-alliances` 22:00, `queue-alliance-corporations` 22:05)
  kaydırmasın.
- Oneshot service'te `Restart=` yoktur; başarısız bir koşu `systemctl --failed`
  ve `journalctl` üzerinden görülür, bir sonraki tetiklemede tekrar denenir.
  Bugünkü PM2 davranışı da bu (`autorestart: false`).

### Envanter

32 PM2 girdisi, kaynak `ecosystem.config.js` (2026-11-16).

**Sürekli çalışan (16 girdi; `worker-backfill-values` 3 instance):**

| Unit (`killreport-…`)                  | `yarn` script                          | `LOG_LEVEL` | Bellek (High / Max) |
| -------------------------------------- | -------------------------------------- | ----------- | ------------------- |
| `backend`                              | `start`                                | debug       | 900M / 1G           |
| `frontend`                             | `start`                                | —           | 900M / 1G           |
| `worker-redisq`                        | `worker:redisq`                        | debug       | 460M / 512M         |
| `worker-alliances`                     | `worker:info:alliances`                | debug       | 460M / 512M         |
| `worker-corporations`                  | `worker:info:corporations`             | debug       | 460M / 512M         |
| `worker-alliance-corporations`         | `worker:alliance-corporations`         | debug       | 460M / 512M         |
| `worker-types`                         | `worker:info:types`                    | debug       | 460M / 512M         |
| `worker-zkillboard`                    | `worker:zkillboard`                    | debug       | 460M / 512M         |
| `worker-user-killmails`                | `worker:user-killmails`                | debug       | 460M / 512M         |
| `worker-corporation-killmails`         | `worker:corporation-killmails`         | debug       | 460M / 512M         |
| `worker-killmail-detail`               | `worker:killmail-detail`               | debug       | 460M / 512M         |
| `worker-discord-webhook`               | `worker:discord-webhook`               | debug       | 460M / 512M         |
| `worker-characters`                    | `worker:info:characters`               | debug       | 460M / 512M         |
| `worker-character-corporation-history` | `worker:character-corporation-history` | debug       | 460M / 512M         |
| `worker-prices`                        | `worker:prices`                        | debug       | 460M / 512M         |
| `worker-backfill-values@{1,2,3}`       | `worker:backfill-values`               | debug       | 460M / 512M         |

**Zamanlanmış (15):**

| Unit (`killreport-…`)                 | `yarn` script                         | `cron_restart`  | `OnCalendar=` (UTC)      | Ek `Environment=`       |
| ------------------------------------- | ------------------------------------- | --------------- | ------------------------ | ----------------------- |
| `queue-characters`                    | `queue:characters`                    | `10 16 * * 1`   | `Mon *-*-* 16:10:00 UTC` |                         |
| `queue-character-corporations`        | `queue:character-corporations`        | `0 17 * * 1`    | `Mon *-*-* 17:00:00 UTC` |                         |
| `queue-character-corporation-history` | `queue:character-corporation-history` | `0 3 * * 1`     | `Mon *-*-* 03:00:00 UTC` |                         |
| `queue-alliances`                     | `queue:alliances`                     | `0 22 * * *`    | `*-*-* 22:00:00 UTC`     |                         |
| `queue-alliance-corporations`         | `queue:alliance-corporations`         | `5 22 * * *`    | `*-*-* 22:05:00 UTC`     |                         |
| `snapshot-alliances`                  | `snapshot:alliances`                  | `0 1 * * *`     | `*-*-* 01:00:00 UTC`     |                         |
| `update-alliance-counts`              | `update:alliance-counts`              | `0 1 * * *`     | `*-*-* 01:00:00 UTC`     |                         |
| `snapshot-corporations`               | `snapshot:corporations`               | `0 1 * * *`     | `*-*-* 01:00:00 UTC`     |                         |
| `worker-system-activity`              | `worker:system-activity`              | `0 * * * *`     | `*-*-* *:00:00 UTC`      |                         |
| `worker-sov-campaigns`                | `worker:sov:campaigns`                | `*/5 * * * *`   | `*-*-* *:00/5:00 UTC`    | `USE_REDIS_PUBSUB=true` |
| `worker-sov-map`                      | `worker:sov:map`                      | `*/30 * * * *`  | `*-*-* *:00/30:00 UTC`   | `USE_REDIS_PUBSUB=true` |
| `worker-sov-structures`               | `worker:sov:structures`               | `15,45 * * * *` | `*-*-* *:15,45:00 UTC`   |                         |
| `worker-sov-snapshot`                 | `worker:sov:snapshot`                 | `0 1 * * *`     | `*-*-* 01:00:00 UTC`     |                         |
| `worker-sov-correlate`                | `worker:sov:correlate`                | `*/10 * * * *`  | `*-*-* *:00/10:00 UTC`   |                         |
| `queue-prices`                        | `queue:prices`                        | `0 6 * * *`     | `*-*-* 06:00:00 UTC`     |                         |

Hepsi `LOG_LEVEL=info`. Her `OnCalendar=` ifadesi kurulumdan önce
`systemd-analyze calendar '<ifade>'` ile doğrulanır.

**Elle çalıştırılan (1):**

| Unit                               | `yarn` script           | Not                                        |
| ---------------------------------- | ----------------------- | ------------------------------------------ |
| `killreport-queue-backfill-values` | `queue:backfill-values` | `Type=oneshot`, timer yok, `[Install]` yok |

**Crontab'dan taşınan bakım (`backend/docs/ops/crontab.md:91-98`):**

| Bugünkü crontab satırı                                  | systemd                                                                                                                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB backup, her gün 04:00                                | `killreport-backup-db.{service,timer}`, `OnCalendar=*-*-* 04:00:00 UTC`, `ExecStart=/bin/bash scripts/backup-db.sh`, `WorkingDirectory=/var/www/killreport/backend` |
| Log temizliği, pazar 02:00 (`/var/www/killreport/logs`) | Kalkar: PM2 log dosyaları yok, loglar journald'da                                                                                                                   |
| `pm2 flush && pm2 reloadLogs`, her gün 05:00            | Kalkar: PM2 yok                                                                                                                                                     |

Backup service'i `PartOf=killreport.target` **taşımaz**: uygulamayı durdurmak
yedeği durdurmamalı. `ProtectSystem=full` ile çalışır; yedekler
`$HOME/backups/killreport_db_backups` altına yazılır (`backup-db.sh`), yani
`killreport` kullanıcısının ev dizini.

### Bellek

PM2'nin `max_memory_restart` değeri `MemoryMax=` olur, bunun yaklaşık %90'ı
`MemoryHigh=`. `MemoryHigh` aşılınca kernel süreci yavaşlatıp belleği geri
almaya çalışır; `MemoryMax`'ta süreç OOM ile öldürülür ve `Restart=always`
onu kaldırır. Ack'lenmemiş mesajlar RabbitMQ'ya geri döner, veri kaybı yok.
Zamanlanmış job'larda PM2'de bellek sınırı yoktu; burada da konmaz.

### Kapanış sinyali

- **Node unit'leri:** `KillSignal=SIGINT`, bugünkü PM2 davranışı. Yalnızca
  `SIGINT` dinleyen worker'lar temiz kapanmaya devam eder. Yarn, SIGINT ile ölen çocuğunu 130 çıkış koduyla bildirir; bu yüzden her yarn unit'inde `SuccessExitStatus=130` vardır, yoksa temiz bir `systemctl stop` unit'i `failed` bırakır (2026-11-16 son inceleme bulgusu).
- **Rust unit'leri:** `KillSignal=SIGTERM` (systemd varsayılanı; runner hem
  `SIGINT` hem `SIGTERM` dinler, `backend-rs/crates/runner/src/shutdown.rs:1-8`).

PM2'nin `kill_signal` varsayılanı `SIGINT`'tir (`shutdown.rs:2` de böyle
yazıyor). `worker-asteroid-belts.ts:207`, `worker-moons.ts:203` ve
`worker-planets.ts:227`'deki yorumlar "PM2 SIGTERM gönderir" diyor; bu yanlış,
ama karar buna bağlı değil: o üç worker iki sinyali de dinliyor ve Node
unit'lerinde `SIGINT` gönderilmesi, yalnızca `SIGINT` dinleyenler için gerekli.
Yorumlar bu işin kapsamında düzeltilmez.

- Hepsinde `TimeoutStopSec=30`, sonra SIGKILL.

### Kullanıcı ve dosya sahipliği

Bütün unit'ler ayrı bir sistem kullanıcısıyla çalışır: `killreport` (giriş
kabuğu yok, ev dizini `/home/killreport`). `/var/www/killreport` bu kullanıcıya
ait olur. Droplet yeniden kurulacağı için bu, kurulum adımlarının bir parçası.

### Loglar

journald. Disk sınırı `/etc/systemd/journald.conf` içinde `SystemMaxUse=`
ile (sunucu ayarı, repoda değil; ops dokümanında yazılı). Günlük kullanım:

```bash
journalctl -u killreport-worker-alliances -f
journalctl -u 'killreport-*' --since today
systemctl list-timers 'killreport-*'
systemctl --failed
```

### Rust'a geçiş

Bir worker veya queue Rust'a geçtiğinde, o unit'in diff'i:

```diff
-ExecStart=/usr/bin/yarn worker:info:alliances
-KillSignal=SIGINT
-SuccessExitStatus=130
+ExecStart=/var/www/killreport/backend-rs/bin/worker-info-alliances
```

Binary'nin yeri spike spec'iyle aynı: yerelde
`x86_64-unknown-linux-musl` için derlenir ve `scp` ile
`/var/www/killreport/backend-rs/bin/<crate>`'e kopyalanır
(`2026-11-12-rust-worker-spike-design.md:367-368`). `ExecStart` `target/`
altını göstermez, çünkü droplet'te Rust araç zinciri yok ve derleme orada
yapılmaz.

`MemoryMax` geçişle birlikte düşürülmez; ölçümden sonra ayrı bir değişiklik.
Bu spec'in kendisi hiçbir unit'i Rust komutuyla kurmaz: bugün Rust karşılığı
olan `queue-alliances`, `queue-characters`, `worker-alliances`,
`worker-corporations` ve `worker-characters` da Node komutuyla kurulur.

Etkilenen spec: `2026-11-12-rust-worker-spike-design.md`, _Aşama 2_. Oradaki
`pm2 stop` / yeni PM2 girdisi / `pm2 start` adımları systemd karşılıklarıyla
okunur: Node tabanı `killreport-worker-alliances` altında ölçülür, geçiş
yukarıdaki diff ile yapılır, geri dönüş diff'in geri alınması +
`daemon-reload` + `systemctl restart`. Ölçülen tek değişken yine
Node'dan Rust'a geçiştir, çünkü taban da systemd altında alınır. Aşama 2'nin
metni bu işin bir parçası olarak güncellenir.

### Geçiş sırası

Droplet aktif olmadığı için canlı bir "PM2'den systemd'ye kesme" yoktur;
geçiş, droplet yeniden kurulurken yapılır:

1. Repo: `deploy/systemd/` eklenir, `ecosystem.config.js` silinir, dokümanlar
   güncellenir (aşağıda). Tek PR.
2. Droplet kurulumu: `killreport` kullanıcısı, `timedatectl` ile saat dilimi
   kontrolü, `journald.conf` `SystemMaxUse=`, unit'lerin kopyalanması,
   _Etkinleştirme_'deki listenin enable edilmesi, ardından
   `systemctl start killreport.target`. PM2 droplet'e hiç kurulmaz; crontab
   boş kalır.
3. Doğrulama: `systemctl list-units 'killreport-*'` her sürekli unit'i
   `active (running)` gösterir; `systemctl list-timers 'killreport-*'` 15 job +
   backup timer'ını beklenen sonraki koşu saatleriyle gösterir;
   `query { workerStatus { queueName consumerCount } }` her kuyrukta beklenen
   consumer sayısını verir (`worker-backfill-values` kuyruğunda 3).

Geri dönüş: `ecosystem.config.js` git geçmişinden geri alınır ve PM2 kurulur.
Droplet zaten yeniden kurulduğu için ara bir karma dönem yoktur.

### Bilinçli davranış değişiklikleri

| Bugün (PM2)                                                                                                                                          | Sonra (systemd)                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cron_restart` çalışan bir koşuyu yarıda öldürüp yeniden başlatır                                                                                    | Timer, servis hâlâ çalışıyorsa yeni koşu başlatmaz                                                                                                                                                                                                                                                                                                       |
| Makine kapalıyken kaçan koşu atlanır                                                                                                                 | `Persistent=true` ile açılışta koşar                                                                                                                                                                                                                                                                                                                     |
| 15 kararsız yeniden başlatmadan sonra PM2 vazgeçer                                                                                                   | `StartLimitIntervalSec=0`, sınırsız, 5 s arayla                                                                                                                                                                                                                                                                                                          |
| `restart_delay` girdiye göre 0 ya da 5 s                                                                                                             | Hepsinde 5 s                                                                                                                                                                                                                                                                                                                                             |
| Durdurmada 1,6 s sonra SIGKILL (`kill_timeout` yoksa)                                                                                                | 30 s sonra SIGKILL                                                                                                                                                                                                                                                                                                                                       |
| `queue-backfill-values` her `pm2 start` / yeniden açılışta bir kez koşar                                                                             | Yalnızca elle: `systemctl start killreport-queue-backfill-values`                                                                                                                                                                                                                                                                                        |
| Zamanlanmış 15 job da her `pm2 start` / yeniden açılışta bir kez koşar                                                                               | Açılışta koşmaz. Yeni kurulumda ilk koşu ilk takvim anını bekler; sonraki yeniden açılışlarda `Persistent=true` yalnızca kaçırılmış koşuyu telafi eder. `OnBootSec=` eklenmez: `sov-*` ve `system-activity` zaten en geç bir saat içinde koşar, günlük ve haftalık işlerin açılışta tekrarlanması ise bugünkü PM2 davranışının istenmeyen bir yan etkisi |
| Backup crontab'da `backend/scripts/` içinden koşar ve `.env`'i orada arar (`backend/scripts/.env` yok, yani büyük olasılıkla bugün başarısız oluyor) | `WorkingDirectory=/var/www/killreport/backend`; `backend/.env` okunur. Bu bir düzeltme                                                                                                                                                                                                                                                                   |
| `cron_restart` sunucu yerel saatini kullanır                                                                                                         | Her timer açıkça UTC                                                                                                                                                                                                                                                                                                                                     |
| Loglar `/var/www/killreport/logs/*.log`                                                                                                              | journald                                                                                                                                                                                                                                                                                                                                                 |
| Süreçler root (ya da PM2'yi başlatan kullanıcı) olarak çalışır                                                                                       | `killreport` kullanıcısı                                                                                                                                                                                                                                                                                                                                 |

### Güncellenecek dokümanlar

- `CLAUDE.md`: _Scheduling is only for mutable data_ (iki mekanizma → tek:
  systemd timer'ları), _File map_ (`ecosystem.config.js` satırı →
  `deploy/systemd/`), PM2'ye değinen diğer yerler.
- `backend/docs/ops/pm2.md` → `backend/docs/ops/systemd.md` olarak yeniden
  yazılır: kurulum satırı, günlük komutlar, Rust geçiş diff'i, `journald.conf`.
- `backend/docs/ops/crontab.md`: crontab'ın artık boş olduğu ve bakımın
  `killreport-backup-db.timer`'da olduğu yazılır, ya da dosya silinip
  `systemd.md`'ye yönlendirilir.
- `pm2` geçen diğer dokümanlar (`grep -rli pm2 --include=*.md backend/docs`,
  2026-11-16'da 29 dosya): `pm2 <komut>` örnekleri systemd karşılıklarıyla
  değiştirilir. `docs/superpowers/` altındaki eski spec ve planlar tarihsel
  kayıttır, değiştirilmez; yalnızca `2026-11-12-rust-worker-spike-design.md`
  _Aşama 2_ güncellenir (yukarıda).

## Uygulayıcıya kalanlar

- `yarn`'ın droplet'teki mutlak yolu (`/usr/bin/yarn` varsayıldı; corepack
  kurulumunda farklı olabilir). Hepsinde aynı yol kullanılır.
- Her unit'in `Description=` metni.
- `pm2` geçen dokümanlarda hangi cümlenin yeniden yazılıp hangisinin
  silineceği.
- `crontab.md`'nin silinmesi mi, kısaltılması mı.
