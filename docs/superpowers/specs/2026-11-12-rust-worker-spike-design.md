# Rust worker denemesi (spike) — tasarım

Tarih: 2026-11-12

## Amaç ve neden

`2026-11-09-rust-backend-rewrite-analysis.md` backend'i parça parça Rust'a
taşımayı (strangler, yol B) öneriyor, ama kararın dayandığı rakamların hepsi
tahmin: Rust worker'ın belleği, geliştirme hızı, derleme döngüsünün Windows'ta
nasıl hissettirdiği, mevcut kuyruk ve hata sözleşmesine ne kadar zahmetle
uyulduğu. Bu iş, o soruları tek bir gerçek worker ile **ölçerek** cevaplar.

Kapsam bilerek dar: tek bir worker, iki aşama.

1. **Aşama 1 — yerel.** Bir haftalık zaman kutusu. Worker yazılır ve aynı
   makinede, aynı iş yükünde Node ile Rust sırayla çalıştırılarak
   karşılaştırılır. Droplet şu an aktif değil; bu aşamanın tamamı yerelde
   (Windows) yapılır.
2. **Aşama 2 — production.** Droplet tekrar aktif olduğunda ve aşama 1
   geçtiyse: Rust worker'ı production'da üç gece boyunca Node worker'ının
   yerine çalışır. Yerel koşuların gösteremediği şeyleri (gerçek sunucuda
   bellek, managed PostgreSQL'e TLS bağlantısı, PM2 altında davranış, günlük
   gerçek yük) burada görürüz.

Her aşamanın sonunda bir "devam / dur" kararı ve bu kararı taşıyan ölçümler
olur. Sonuç "dur" olsa bile Node worker'ına dokunulmaz; geri dönüş her
aşamada tek adımdır.

## Hedefler

- `esi_alliance_info_queue` kuyruğunu tüketen, Node'daki
  `worker-info-alliances.ts` ile **davranışça aynı** bir Rust worker.
- Sonraki worker'ların da kullanacağı üç paylaşılan crate: `esi` (client +
  limiter portu), `mq` (bağlantı, kuyruk tanımı, ortak hata yolu), `db` (havuz).
- Aşama 1: yerelde en az **üç koşu çifti**: aynı `yarn queue:alliances`
  yükünü bir kez Node, bir kez Rust worker'ının tüketmesi (bkz. _Aşama 1_).
- Aşama 2: production'da en az **üç gecelik** `queue-alliances` koşusunda
  (her gün 22:00, `ecosystem.config.js:292`) Node worker'ının yerine
  çalışma (bkz. _Aşama 2_).
- Aşağıda _Ölçümler_ bölümündeki beş ölçümün kayda geçmesi ve bir karar.

## Hedef dışı

- Killmail yazıcısı (`killmail-writer.ts`) ve başka herhangi bir worker.
- API, GraphQL, frontend.
- Ortak bir worker çalıştırıcısı (generic runner) veya tek binary'de birden
  çok worker. Bkz. _Tasarım kararları_, madde 1.
- Mesaj formatında, kuyruk adında veya Prisma şemasında değişiklik.
- Node worker kodunun silinmesi. Geri dönüş yolu olarak yerinde kalır.
- Deploy otomasyonu (CI'dan binary artifact'ı, otomatik dağıtım). Aşama 2'de
  binary yerelde derlenip elle kopyalanır.

## Neden `worker-info-alliances`

| Ölçüt                 | Durum                                                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Tekrarlanabilir yük   | `yarn queue:alliances` ESI'deki bütün alliance ID'lerini filtresiz kuyruğa koyar (root scan); her koşu aynı tam yük.                   |
| Sürekli çalışan süreç | Production'da PM2'de sürekli çalışıyor (`autorestart: true`, `ecosystem.config.js:67-82`); bellek ölçümü gerçek kullanımı temsil eder. |
| Yazdığı yer           | Tek tablo: `alliances`. Tek bir `upsert`.                                                                                              |
| Kimlik doğrulama      | Yok. Public `/alliances/{id}` uç noktası; refresh token yarışı (`user-credentials.ts:66-69`) yok.                                      |
| Yan etki              | Yok. Pub/sub, Discord, başka kuyruğa yayın yok.                                                                                        |
| Hata yolu             | Ortak `handleWorkerError`'ın bütün dalları (throttle, 404, retry, parking) bu worker'da da geçerli.                                    |
| İdempotent mi         | Evet. Aynı ID'yi iki kez işlemek aynı satırı üretir.                                                                                   |
| Kod boyutu (Node)     | 202 satır.                                                                                                                             |

`worker-info-types` de aday olabilirdi, ama yükü `scan:entities`'in o an
veritabanında eksik bulduğu ID'lere bağlı (enrichment); ilk koşudan sonra
eksik kalmayacağı için ikinci koşunun yükü birinciyle aynı olmaz. Root scan
her seferinde aynı yükü verir, karşılaştırma için bu şart.

## Dizin yapısı

```text
backend-rs/
├── Cargo.toml                 # workspace
├── Cargo.lock                 # commit edilir (binary projesi)
├── .sqlx/                     # sqlx offline sorgu önbelleği, commit edilir
├── crates/
│   ├── esi/                   # EsiClient, RateLimiter, EsiThrottled
│   ├── mq/                    # bağlantı, declare, handle_worker_error, death_count
│   └── db/                    # PgPool kurulumu
└── workers/
    └── worker-info-alliances/ # tek bir bin crate
```

Yarn workspace değil; `package.json`'a girmez. `backend-rs/target/`
`.gitignore`'a eklenir. Prettier `.rs` dosyalarına bakmaz, ama `target/`
altında üretilen `.json`/`.md` dosyaları `prettier --check .`'e takılmasın diye
`.gitignore` kaydı şart (Prettier 3 `.gitignore`'u okur).

## Korunacak sözleşme

Rust worker'ı aşağıdakilerin **hepsine** Node worker ile aynı şekilde uyar. Her
madde bir testle sabitlenir (bkz. _Testler_).

### Kuyruk ve mesaj

- Kuyruk: `esi_alliance_info_queue` (`queue-names.ts:16`), `QUEUE_NAME`
  sabiti olarak binary'nin içinde (CLAUDE.md: her worker kuyruk adını
  hardcode eder).
- Mesaj gövdesi JSON: `{ "entityId": number, "queuedAt": string, "source":
string }` (`queue-alliances.ts:32-34`). Yalnızca `entityId` okunur; diğer
  alanlar bilinmeyen alan olarak yok sayılır (`serde` varsayılanı, ama
  `deny_unknown_fields` **kullanılmaz**).
- `prefetch(3)` (`worker-info-alliances.ts:12`). Mesajlar elle ack'lenir.
- Kuyruk tanımı: `durable: true`, `arguments: { "x-max-priority": 10 }`, başka
  argüman **yok**. Özellikle `x-dead-letter-exchange` verilmez: o bağlantı
  RabbitMQ policy'si ile gelir (`backend/docs/ops/rabbitmq.md:11-44`) ve
  argüman olarak verilirse kuyruk 406 `PRECONDITION_FAILED` ile reddedilir.
- Node'un `ensureAllQueuesExist()` ile tanımladığı retry topolojisi
  (`rabbitmq.ts:124-166`) Rust tarafında da açılışta, aynı tip ve
  argümanlarla tanımlanır: `killreport.dlx` (fanout, durable),
  `killreport.retry` (direct, durable), `killreport.wait` (`x-max-priority:
10`, `x-message-ttl: 30000`, `x-dead-letter-exchange: killreport.retry`),
  `killreport.parking` (`x-max-priority: 10`), `wait → dlx` bağlantısı ve
  `esi_alliance_info_queue → killreport.retry` bağlantısı (routing key kuyruk
  adı). Aynı argümanlarla tekrar tanımlamak idempotent; farklı bir argüman
  worker'ı 406 ile düşürür, bu yüzden sabitler tek yerde (`mq` crate) durur.
  Rust worker yalnızca **kendi** kuyruğunu tanımlar, `ALL_QUEUES`'un
  tamamını değil.

### Hata yolu (`worker-error.ts` portu)

`mq::handle_worker_error`, `handleWorkerError` ile dal dal aynıdır ve her yolda
mesajı tam bir kez settle eder:

| Hata                                                        | Davranış                                                                                           |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `EsiThrottled` (esi crate'inden, 420/429)                   | Uyar, `nack(requeue: true)` hemen. Uyku yok, deneme harcanmaz; fren limiter'da.                    |
| ESI dışı 420/429 (status veya ilk satırda `\b(420\|429)\b`) | 60 s bekle, `nack(requeue: true)`. Bu worker'da ulaşılmaz, ama crate paylaşılacağı için portlanır. |
| 404 (status veya ilk satırda `\b404\b`)                     | Uyar, `ack`.                                                                                       |
| Diğer, `x-death[0].count + 1 >= 5` (`MAX_ATTEMPTS`)         | `killreport.parking`'e aynı gövde ve aynı header'larla `persistent` publish, sonra `ack`.          |
| Diğer                                                       | `nack(requeue: false)` → DLX → 30 s wait → retry → aynı kuyruk.                                    |

`death_count`, `x-death` yoksa veya boşsa 0 döner (`worker-error.ts:37-42`).
`isForbidden` portlanır ama yönlendirme yapmaz, Node'daki gibi.

Rust'ta hata tipleri yapısal olduğu için "mesajın ilk satırında status ara"
fallback'i yalnızca dış kaynaklı (`reqwest` olmayan) hatalar için gerekir; ESI
hataları status'u doğrudan taşır. Fallback yine de portlanır, çünkü
`zkillboard` worker'ları taşındığında aynı fonksiyonu kullanacak.

### ESI erişimi (`esi-client.ts` + `rate-limiter.ts` portu)

- Base URL `https://esi.evetech.net`, header'lar `X-Compatibility-Date:
2020-01-01` ve bir `User-Agent`. Timeout 30 s; asılı kalan bir soket limiter
  slotunu sonsuza dek tutmasın (`esi-client.ts:75`).
- `User-Agent` Node'dakinden **ayırt edilebilir** olur:
  `KillReport-rs/<cargo version> (+https://github.com/umutyerebakmaz/killreport)`.
  Böylece ESI tarafındaki ve bizim loglarımızdaki istekler hangi dilden
  geldiğine göre ayrılabilir.
- Her istek `acquire → istek → observe → release` sırasından geçer;
  `release` her yolda çalışır (Rust'ta bir drop guard).
- Limiter `rate-limiter.ts`'in **birebir portu**: route-group token
  bucket'ları, legacy error limit, header'sız 429'da AIMD (×0,75, taban 1
  req/s, en fazla 10 s'de bir; sonra 10 s'de +1), fren üst sınırı 15 dk,
  `routeTemplate`, `ESI_MAX_RPS` (varsayılan 50). Sabitler
  `rate-limiter.ts:60-73` ile aynı adlarla. Spec:
  `2026-10-28-esi-rate-limiter-design.md`.
- Worker'lar freni bekler; `setEsiMaxWait` karşılığı bu worker'da
  kullanılmaz.
- `Authorization` header'ı hata mesajlarına girmez (`esi-client.ts:57-66`).
  Bu worker token kullanmıyor, ama crate paylaşılacak.
- `esi-client.guard.spec.ts` yalnızca `backend/src/**/*.ts`'i tarar; Rust için
  aynı guard bir test olarak `backend-rs/` altında yazılır:
  `esi.evetech.net` yalnızca `crates/esi/src/client.rs`'te geçebilir.

Node ve Rust limiter'ları aynı makinede yan yana çalışabilir (karşılaştırma
koşularında aynı anda çalışmazlar, ama API sunucusu veya başka bir worker
açıksa onlarla birlikte çalışırlar). Bu güvenli, çünkü
iki limiter da kararını ESI'nin IP geneli bucket ve error-limit header'larından
alır (rate limiter spec §4.5); birbirlerinin harcamasını her yanıtta görürler.

### Veritabanı yazımı

Node'daki `findUnique` + `upsert` ikilisi tek bir sorguya iner:

```sql
INSERT INTO alliances (
  id, name, ticker, date_founded, creator_corporation_id, creator_id,
  executor_corporation_id, faction_id, updated_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
ON CONFLICT (id) DO UPDATE SET
  name                    = EXCLUDED.name,
  ticker                  = EXCLUDED.ticker,
  executor_corporation_id = EXCLUDED.executor_corporation_id,
  faction_id              = EXCLUDED.faction_id,
  updated_at              = now()
RETURNING (xmax = 0) AS inserted;
```

Prisma'nın örtük yaptığı ve SQL'de açıkça yazılması gereken üç şey:

1. **`updated_at` Prisma tarafından yönetiliyor**, veritabanında varsayılanı
   yok: `"updated_at" TIMESTAMP(3) NOT NULL`
   (`prisma/migrations/20251207200258_init/migration.sql:24`). `@updatedAt`
   hem insert'te hem her update'te değeri kendisi koyar. SQL'de iki yerde de
   `now()` yazılmazsa insert NOT NULL hatası verir, update ise eski değeri
   bırakır.
2. **Değişmeyen alanlar update'e girmez:** `date_founded`, `creator_*`
   (`worker-info-alliances.ts:122`). `created_at` veritabanı varsayılanına
   bırakılır. `corporation_count` ve `member_count`'a dokunulmaz; onları
   `update-alliance-counts` yazar.
3. **Eksik anahtar `NULL` olur:** ESI alliance'ın executor'ı veya faction'ı
   yoksa anahtarı hiç göndermez. Node update'te `?? null` ile açıkça boşaltır
   (`worker-info-alliances.ts:119-121`); Rust'ta bu alanlar `Option<i32>` ve
   `None` → `NULL`. Aynı davranış.

Tarih: `date_founded` ESI'den ISO 8601 UTC string gelir, kolon `TIMESTAMP(3)`
(zaman dilimsiz). Prisma onu UTC olarak yazar. Rust `chrono::DateTime<Utc>`
olarak parse eder ve `NaiveDateTime` (UTC) olarak bağlar; milisaniye
hassasiyeti korunur. Bu, karşılaştırmada en olası fark noktası; ayrı bir testle
sabitlenir.

`RETURNING (xmax = 0)` yalnızca "created / updated" log satırı için; Node'daki
ek `findUnique` sorgusunu kaldırır, yazılan satırı değiştirmez.

Havuz: `max_connections(2)`, `min_connections(0)`, `idle_timeout(10 s)` —
`prisma-worker.ts:28-32` ile aynı. Bağlantı bütçesi değişmez: Rust worker,
yerine geçtiği Node worker'ının iki bağlantısını kullanır.

Sorgular `sqlx::query!` ile yazılır (derleme zamanı kontrolü). CI ve Windows
geliştirme `SQLX_OFFLINE=true` ve commit edilmiş `.sqlx/` ile derlenir;
`.sqlx/` `cargo sqlx prepare` ile canlı bir veritabanına karşı yenilenir. Bu
döngünün ne kadar sürtünme yarattığı ölçümlerden biri.

### Yapılandırma ve süreç

- Ortam değişkenleri: `DATABASE_URL`, `RABBITMQ_URL`, `ESI_MAX_RPS`
  (opsiyonel). Binary çalışma dizinindeki `.env`'i `dotenvy` ile okur ve
  `backend/` dizininden çalıştırılır; böylece Node worker'ıyla aynı
  `backend/.env`'i kullanır. Yeni bir secret dosyası yok, `.env`'e satır
  eklenmez.
- Çalıştırma: `backend/package.json`'a tek satırlık bir script,
  `"worker:info:alliances:rs": "cargo run --release --manifest-path
../backend-rs/Cargo.toml -p worker-info-alliances"`. Node karşılığı
  `yarn worker:info:alliances` ile yan yana durur.
- Log: `tracing` ile terminale (stdout/stderr), Node worker'ı gibi.
- Kapanış: Ctrl+C'de (`tokio::signal::ctrl_c`; Windows'ta SIGTERM yok, Linux'ta
  ileride SIGTERM de dinlenir) yeni mesaj almayı bırakır, elindeki en fazla 3
  mesajı bitirir, bağlantıları kapatır. Bitirilemeyen mesaj ack'lenmemiş
  kalır ve broker onu tekrar teslim eder; veri kaybı yok.
- Yeniden bağlanma: kanal veya bağlantı düşerse 5 s bekleyip yeniden bağlanır
  (`worker-info-alliances.ts:174-175` ile aynı).
- "Kuyruk bitti" özet satırı (5 s sessizlikten sonra işlenen / oluşturulan /
  güncellenen / hata sayısı) korunur; ölçüm bu satırdan da okunur.

## Tasarım kararları

1. **Paylaşılan crate'ler evet, paylaşılan çalıştırıcı hayır.** CLAUDE.md her
   worker'ın "self-contained — no shared runner" olmasını istiyor. Bu spike
   kuralı değiştirmiyor: `worker-info-alliances` kendi `main`'i, kendi
   consume döngüsü ve kendi `QUEUE_NAME`'i olan bir binary. Paylaşılan şey,
   Node'da da paylaşılan şeyler: ESI client, limiter, `handleWorkerError`,
   havuz. Bu, Node'daki `@services/esi-client` + `./worker-error` ayrımının
   birebir karşılığı.
2. **Worker başına bir binary.** Tek binary + alt komut sorusu analiz
   dokümanında açık. Spike'ta tek worker olduğu için soru doğmuyor; ileride
   production'a alındığında PM2'nin süreç başına `max_memory_restart` ve
   `cron_restart` modeline de birebir uyar.
3. **Limiter tam portlanır, sadeleştirilmez.** Spike için basit bir sabit
   hızlı limiter daha hızlı olurdu, ama hem CLAUDE.md'nin "kendi rate
   limit'ini yazma" kuralını çiğner hem de ölçümü anlamsız kılar: sonraki
   worker'lar bu crate'i kullanacak ve haftanın en büyük işi muhtemelen bu
   port olacak. Bunu görmek, ölçülmek istenen şeyin bir parçası.

## Testler

| Neyi sabitler     | Nasıl                                                                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Limiter davranışı | `rate-limiter.spec.ts`'teki 43 vaka Rust'a taşınır; sanal saatle (`tokio::time::pause`).                                                           |
| Hata yolu dalları | `worker-error.spec.ts` vakaları; kanal bir trait arkasında, test çifti ack/nack/publish kaydeder.                                                  |
| `death_count`     | `x-death` yok, boş dizi, sayı, sayı olmayan değer.                                                                                                 |
| Mesaj parse       | Ek alanlı gövde kabul edilir; `entityId` eksikse hata yolu (parse hatası bir mesaj kusurudur).                                                     |
| ESI yanıtı parse  | `executor_corporation_id` / `faction_id` eksik → `None`; `date_founded` milisaniyeli ve milisaniyesiz.                                             |
| Upsert SQL        | `sqlx::test` ile gerçek Postgres: insert, update, eksik alanın `NULL`'a dönmesi, `updated_at`'in değişmesi, `date_founded`'ın update'te korunması. |
| Kuyruk tanımı     | Yerel RabbitMQ'ya karşı: Node'un tanımladığı kuyruğa Rust'ın tekrar tanımı 406 vermez.                                                             |
| ESI guard         | `esi.evetech.net` yalnızca `crates/esi/src/client.rs`'te.                                                                                          |

CI'a ayrı bir `backend-rs` job'u eklenir: `cargo fmt --check`,
`cargo clippy -- -D warnings`, `cargo test` (`SQLX_OFFLINE=true`; `sqlx::test`
vakaları için job'a bir Postgres servisi). Node job'larına dokunulmaz.

## Derleme

Her iki aşamada da derleme **yerelde** yapılır; droplet'e Rust araç zinciri
kurulmaz.

- **Aşama 1:** Windows'ta `cargo build` / `cargo test`, karşılaştırma
  koşuları için `cargo build --release`. Bu derleme bir Windows `.exe`'si
  üretir; yalnızca yerelde çalışır.
- **Aşama 2:** yine yerelde, Linux hedefi için: `x86_64-unknown-linux-musl`.
  musl hedefi tek parça, statik bir binary üretir; droplet'teki glibc
  sürümüne bağımlılık olmaz. Windows'tan iki yolu var: WSL2 içinde
  `cargo build --release --target x86_64-unknown-linux-musl`, ya da Windows'ta
  `cargo zigbuild` ile aynısı. WSL2 kuruluysa o daha az sürprizli.

İkinci derlemeyi mümkün kılmak için aşama 1'den itibaren tek bir kısıt
uygulanır: **OpenSSL'e bağımlılık yok.** Bütün bağımlılıklar TLS için `rustls`
kullanır: `reqwest` (`rustls-tls`), `sqlx` (`runtime-tokio-rustls`), `lapin`
(TLS gerekirse rustls özelliğiyle). Bu, Windows'ta OpenSSL kurma derdini de
ortadan kaldırır.

## Aşama 1: yerel karşılaştırma koşusu

Gereken yerel servisler: PostgreSQL ve RabbitMQ (`DATABASE_URL` ve
`RABBITMQ_URL` yerel servisleri gösterir). Bu worker Redis kullanmaz. ESI
gerçek; istekler ev bağlantısının IP'sinden gider.

Bir **koşu** şudur:

1. Kuyruk boş, iki worker da kapalı.
2. `yarn queue:alliances` ile bütün alliance ID'leri kuyruğa konur.
3. Worker'lardan biri başlatılır (`yarn worker:info:alliances` veya
   `yarn worker:info:alliances:rs`). Çalıştığı sürece bellek 5 saniyede bir
   örneklenir (bkz. ölçüm 3). "Kuyruk bitti" özet satırı görününce koşu
   biter; özet satırındaki sayılar ve toplam süre not edilir, worker
   kapatılır.
4. `alliances` tablosunun anlık görüntüsü bir CSV dosyasına alınır:

   ```sql
   \copy (SELECT id, name, ticker, date_founded, creator_corporation_id,
          creator_id, executor_corporation_id, faction_id
          FROM alliances ORDER BY id)
     TO 'alliances-<worker>-<n>.csv' WITH CSV HEADER
   ```

   Dosyalar reponun dışında bir ölçüm klasöründe tutulur; veritabanına yeni
   tablo açılmaz.

Bir **koşu çifti**, aynı yükün art arda bir Node, bir Rust koşusudur. İki
koşu arasında yalnızca dakikalar geçtiği için ESI'deki gerçek değişiklik
neredeyse sıfırdır; bu yüzden iki CSV'nin sekiz kolonun **tamamında** aynı
olması beklenir (`git diff --no-index` ile karşılaştırılır). Bir fark ya
Rust'taki bir hatadır ya da o ID'nin ESI'de o dakikalarda gerçekten değiştiği
bir durumdur; ikincisi, o ID ESI'den tekrar çekilerek doğrulanır.

Kurallar:

- İki worker **asla aynı anda** çalışmaz. Güvenli olurdu (rakip tüketiciler,
  idempotent upsert), ama ölçümleri karıştırır.
- Üç koşu çifti yapılır ve sıra değiştirilir (Node→Rust, Rust→Node,
  Node→Rust), sıradan doğan bir etki (ör. ilk koşunun ısınma maliyeti) iki
  tarafa eşit dağılsın.
- Yerel `alliances` tablosu boşsa veya eskiyse, ilk koşu yalnızca tabloyu
  doldurmak içindir ve ölçüme katılmaz.

## Aşama 2: production

Ön koşul: droplet aktif ve aşama 1'in kararı "devam".

1. **Binary:** Linux binary'si yerelde derlenir (bkz. _Derleme_) ve `scp` ile
   droplet'te sabit bir yola kopyalanır (ör.
   `/var/www/killreport/backend-rs/bin/worker-info-alliances`).
2. **Bağlantı kontrolü:** managed PostgreSQL TLS istediği için production
   `DATABASE_URL`'ine (`sslmode` dahil) sqlx'in bağlanabildiği, ilk geceden
   önce binary'yi bir kez elle başlatıp kuyruk boşken bağlantı loglarına
   bakarak doğrulanır.
3. **Taban:** Node worker çalışırken bir gece koşusunun belleği (`ps -o rss`,
   5 s'de bir) kaydedilir ve koşudan sonra `alliances` tablosunun anlık
   görüntüsü aşama 1'deki aynı `\copy` sorgusuyla bir CSV'ye alınır.
4. **Geçiş:** 22:00'den önce `pm2 stop worker-alliances`; yeni bir PM2 girdisi
   (`worker-alliances-rs`, aynı `cwd` — `/var/www/killreport/backend`, böylece
   aynı `.env` okunur —, `script` binary'nin yolu, `max_memory_restart:
512M`, `autorestart: true`) başlatılır. İki worker aynı anda çalışmaz.
   Girdide ayrıca `interpreter: 'none'` (PM2 binary'yi Node ile çalıştırmaya
   kalkmasın) ve `kill_timeout: 10000`. PM2 durdururken varsayılan olarak
   **SIGINT** gönderir ve `kill_timeout` (varsayılan 1600 ms) dolunca SIGKILL
   atar; elindeki en fazla 3 mesajı bitirmeye 1,6 s yetmeyebilir. SIGKILL'de
   bile veri kaybı yok (ack'lenmemiş mesaj tekrar teslim edilir), ama temiz
   kapanış ölçümlerin ve logların okunabilirliği için. Binary SIGINT'i
   (`ctrl_c`) ve SIGTERM'i dinler.
5. **Üç gece:** her koşudan sonra anlık görüntü tekrar alınır ve bir önceki
   gecenin CSV'siyle karşılaştırılır. Geceler arasında ESI'de gerçek
   değişiklikler olur, bu yüzden beklenti aşama 1'den gevşektir:
   `date_founded` ve `creator_*`'da sıfır fark, `name`, `ticker`,
   `executor_corporation_id`, `faction_id`'deki her fark ESI'deki gerçek bir
   değişiklikle açıklanır, satır sayısı düşmez.
6. **Geri dönüş:** `pm2 stop worker-alliances-rs && pm2 start
worker-alliances`. Mesaj formatı ve kuyruk aynı olduğu için kuyrukta
   bekleyen işler Node worker'ına olduğu gibi geçer.

musl'ün varsayılan bellek ayırıcısı glibc'ninkinden farklıdır; aşama 2'nin
bellek rakamı bu binary'nin rakamıdır ve öyle kaydedilir. Aşama 1'in Windows
rakamıyla doğrudan karşılaştırılmaz; her aşamada Node ile Rust kendi
ortamlarında karşılaştırılır.

## Ölçümler ve karar

| #   | Ölçüm               | Nasıl alınır                                                                                                                                                                                                                                                                                             | Geçme koşulu                                                                                                                                                   |
| --- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Doğruluk            | Aşama 1: her koşu çiftinin iki CSV'si arasındaki fark. Aşama 2: ardışık gecelerin CSV'leri (bkz. _Aşama 2_, adım 5)                                                                                                                                                                                      | Sekiz kolonun tamamında fark yok; varsa her biri ESI'deki gerçek bir değişiklikle açıklanır. `date_founded` ve `creator_*`'da hiç fark yok. Satır sayısı aynı. |
| 2   | Sözleşme            | Yerel ortamda: var olmayan bir ID (404 → ack), DB'yi kapatıp bir mesaj (5 denemede parking), throttle                                                                                                                                                                                                    | Her dal Node ile aynı sonucu verir; `killreport.parking`'teki mesaj aynı header'ları taşır.                                                                    |
| 3   | Bellek              | Aşama 1: PowerShell'de `Get-Process -Id <pid>` ile `WorkingSet64` ve `PrivateMemorySize64`, 5 s'de bir; boşta ve koşu boyunca en yüksek değer. Node'da ölçülen süreç worker'ı çalıştıran `node.exe`'dir, `yarn` süreci iki tarafta da sayılmaz. Aşama 2: `ps -o rss`, 5 s'de bir, Node'da `node` süreci. | Rust'ın koşu boyunca en yüksek değeri, Node'unkinin **en fazla %25'i** (en az %75 tasarruf). Gerekçe tablonun altında.                                         |
| 4   | ESI davranışı       | Koşu boyunca 420 sayısı, `X-ESI-Error-Limit-Remain` en düşük değeri, koşu süresi                                                                                                                                                                                                                         | 420 yok; error limit Node koşularından kötü değil; koşu süresi Node'unkinin ±%20'si içinde.                                                                    |
| 5   | Geliştirme deneyimi | Gün gün harcanan saat (crate başına), Windows'ta cold ve incremental build süresi, `.sqlx/` yenileme sayısı                                                                                                                                                                                              | Karar verdiren değil, bilgi; ama analizdeki "3–6 ay" tahmini bu rakamla yeniden hesaplanır.                                                                    |

Beş ölçüm her iki aşamada da alınır; ölçüm 2 (sözleşme) yalnızca aşama 1'de,
yerel ortamda.

**Bellek eşiği neden %25:** sürekli çalışan 14 worker'da süreç başına ~50–60
MB tasarruf, 8 GB'lık droplet'te toplam ~0,7–0,8 GB eder; bu taşımaya değen
bir kazanç. Bu oranı tutturamayan bir kazancın büyük kısmı Node worker'larını
tek süreçte toplayarak (analiz dokümanı, yol A) çok daha ucuza alınabilir.
Eşik, analiz dokümanı §6'nın istediği gibi ölçümden önce sabitlendi
(2026-11-13); ölçüm görüldükten sonra değiştirilmez.

**Aşama 1'in kararı:** 1 ve 2 geçmezse spike başarısızdır; Rust tarafındaki iş durur ya da
neden geçmediği anlaşılana kadar başka worker'a geçilmez. 1 ve 2 geçerse karar
3 ve 5'e bakar: bellek kazancı eşiği aşıyor ve ölçülen geliştirme hızıyla
yeniden hesaplanan toplam süre kabul edilebiliyorsa aşama 2'ye geçilir. Değilse durulur; bu spike'ın çıktısı (crate'ler
ve rakamlar) analiz dokümanına eklenir ve Node'daki A yolu (worker'ları tek
süreçte toplamak) öne alınır.

**Aşama 2'nin kararı:** üç gecenin hepsinde 1, 3 ve 4 geçerse analiz
dokümanındaki yol B'nin bir sonraki adımına geçilir. Bir gece bile 1 geçmezse
geri dönülür (adım 6) ve neden geçmediği anlaşılana kadar aşama 2 tekrar
denenmez.

## Zaman kutusu

**Aşama 1:** beş iş günü, kabaca:

| Gün | İş                                                                    |
| --- | --------------------------------------------------------------------- |
| 1   | Workspace, `db`, `mq` iskeleti; yerel RabbitMQ ve Postgres'e bağlanma |
| 2–3 | `esi` crate: client + limiter portu + 43 test                         |
| 4   | Worker binary'si, hata yolu, upsert, testler, CI job'u                |
| 5   | Yerel karşılaştırma koşuları ve ölçümler                              |

Beşinci günün sonunda üç koşu çifti tamamlanmamışsa bu da bir sonuçtur ve
ölçüm 5'e (geliştirme deneyimi) olduğu gibi yazılır; süre uzatılmaz.

**Aşama 2:** droplet aktif olduktan sonra bir gün (Linux derlemesi, kopyalama,
bağlantı kontrolü, taban ölçümü) ve üç gece.
