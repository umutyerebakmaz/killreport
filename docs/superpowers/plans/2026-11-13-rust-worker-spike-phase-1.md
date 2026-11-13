# Rust worker denemesi, aşama 1 (yerel) — implementasyon planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Amaç:** `worker-info-alliances`'ı Rust'ta, Node versiyonuyla davranışça aynı
yazmak ve yerelde aynı yük altında Node ile karşılaştırıp aşama 1'in
"devam / dur" kararını vermek.

**Mimari:** `backend-rs/` Cargo workspace'i. Üç kütüphane crate'i (`db`,
`esi`, `mq`) ve tek bir bin crate (`worker-info-alliances`). `esi`,
`esi-client.ts` + `rate-limiter.ts`'in; `mq`, `rabbitmq.ts`'in retry
topolojisi kısmı + `worker-error.ts`'in birebir portu. Worker, Node'daki
gibi kendi `main`'i ve consume döngüsü olan bağımsız bir binary; ortak
çalıştırıcı yok.

**Teknoloji:** Rust stable, tokio, reqwest (rustls), sqlx (Postgres,
rustls, `query!`), lapin, serde, chrono, tracing, thiserror / anyhow,
dotenvy. Testler: `#[tokio::test(start_paused = true)]`, `sqlx::test`,
wiremock.

**Spec:** `docs/superpowers/specs/2026-11-12-rust-worker-spike-design.md`

## Genel kısıtlar

- Branch: `feat/rust-worker-spike`.
- **OpenSSL yok.** Her görevin sonunda `cargo tree -i openssl-sys` "did not match any packages" demeli. TLS isteyen her bağımlılık rustls özelliğiyle.
- `esi.evetech.net` yalnızca `backend-rs/crates/esi/src/client.rs`'te geçer.
- Kendi rate limit'i, error-limit kontrolü veya retry uykusu yazılmaz; hepsi `esi` ve `mq` crate'lerinden gelir (CLAUDE.md, "Rate limiting").
- Kuyruk tanımlarında `x-max-priority: 10`, `x-dead-letter-exchange` **yok** (policy ile gelir).
- Node tarafında tek değişiklik: `backend/package.json`'a bir script satırı. Node worker'ına, `.env`'e, Prisma şemasına ve migration'lara dokunulmaz.
- `.env` düzenlenmez. Yerel servisleri göstermiyorsa kullanıcıya hangi satırın değişeceği söylenir.
- Yarn, asla npm. Commit mesajları İngilizce, Claude attribution satırı yok.
- Her görevin sonunda: `cargo fmt --check`, `cargo clippy --all-targets --
-D warnings`, `cargo test` (o görevin crate'i). Düzenlenen her `.md`,
  `.yml`, `.json` için `npx prettier --check <dosya>`.
- Log metinleri Node worker'ınkilerle aynı (emoji dahil); karşılaştırma koşularında loglar yan yana okunacak.

## İnceleme odağı

1. **`updated_at` hem insert'te hem update'te `now()`.** Prisma `@updatedAt` bunu örtük yapıyordu; kolonun veritabanı varsayılanı yok. Test: Görev 7.
2. **Değişmeyen kolonlar update'e girmiyor** (`date_founded`, `creator_*`), `created_at`, `corporation_count`, `member_count`'a hiç dokunulmuyor. Test: Görev 7.
3. **ESI'nin göndermediği `executor_corporation_id` / `faction_id` `NULL` yazılıyor**, eski değer kalmıyor. Test: Görev 7.
4. **Throttle deneme harcamıyor:** `EsiThrottled` → hemen `nack(requeue: true)`, `x-death` artmaz. Yanlış sınıflanırsa mesaj ya sonsuza döner ya da parking'e düşer. Test: Görev 6.
5. **Status yalnızca hatanın ilk satırından okunuyor.** `\b404\b`, `\b(420|429)\b`; "4040" veya alt satırdaki bir kod çerçevesi eşleşmemeli (#235). Test: Görev 6.
6. **Limiter'da sıfırdan büyük olmayan fren süreleri yok sayılıyor**, kısa bir fren uzun olanı kısaltmıyor, her fren 15 dk ile sınırlı. Test: Görev 4.
7. **`date_founded` milisaniye kaybı veya saat dilimi kayması olmadan yazılıyor.** Test: Görev 7 ve koşu çiftlerinin CSV farkı (Görev 10).

---

### Görev 0: Ön koşullar

**Dosyalar:** yok.

- [ ] **Adım 1:** Rust araç zinciri: `rustup` ile stable, Windows'ta MSVC hedefi (`x86_64-pc-windows-msvc`) ve Visual Studio Build Tools'un C++ bileşeni. `cargo --version` çıktısını not et; Görev 1'de `rust-toolchain.toml`'a bu sürüm yazılır.
- [ ] **Adım 2:** `cargo install sqlx-cli --no-default-features --features rustls,postgres`.
- [ ] **Adım 3:** Yerel PostgreSQL ve RabbitMQ çalışıyor; `backend/.env`'deki `DATABASE_URL` ve `RABBITMQ_URL` bunları gösteriyor. Göstermiyorsa dur ve kullanıcıya söyle; `.env` düzenlenmez.
- [ ] **Adım 4:** Yerel RabbitMQ'da `killreport-dlx` policy'si var mı: `rabbitmqctl list_policies`. Yoksa `backend/docs/ops/rabbitmq.md:77`'deki komutla uygula (Windows'ta `rabbitmqctl.bat`, `sudo` olmadan). Policy olmadan Görev 9'daki retry testi mesajı sessizce düşürür.
- [ ] **Adım 5:** Node tarafının yerelde çalıştığını gör: `yarn workspace backend queue:alliances`, sonra `yarn workspace backend worker:info:alliances` kuyruğu bitirip "queue completed!" satırını basmalı. Yerel `alliances` tablosu böylece dolar; bu koşu ölçüme katılmaz (spec, _Aşama 1_, son kural).

### Görev 1: Workspace iskeleti

**Dosyalar:**

- Oluştur: `backend-rs/Cargo.toml`, `backend-rs/rust-toolchain.toml`, `backend-rs/crates/{db,esi,mq}/Cargo.toml`, `backend-rs/crates/{db,esi,mq}/src/lib.rs`, `backend-rs/workers/worker-info-alliances/Cargo.toml`, `backend-rs/workers/worker-info-alliances/src/main.rs`
- Değiştir: `.gitignore`

**Arayüzler:**

- Üretir: `[workspace] members = ["crates/*", "workers/*"]`, `resolver = "2"`, bağımlılık sürümleri `[workspace.dependencies]`'de tek yerde. Crate'ler `x.workspace = true` ile alır.

- [ ] **Adım 1:** `rust-toolchain.toml`: `channel = "<Görev 0 Adım 1'deki sürüm>"`, `components = ["rustfmt", "clippy"]`.
- [ ] **Adım 2:** `[workspace.dependencies]`: `tokio` (`rt-multi-thread`, `macros`, `time`, `signal`, `sync`), `reqwest` (`default-features = false`, `rustls-tls`, `json`), `sqlx` (`runtime-tokio-rustls`, `postgres`, `chrono`, `macros`), `lapin` (TLS'siz yerel AMQP için varsayılan özellikler OpenSSL çekiyorsa `default-features = false`), `serde` (`derive`), `serde_json`, `chrono` (`serde`), `regex`, `tracing`, `tracing-subscriber` (`env-filter`), `thiserror`, `anyhow`, `dotenvy`, `futures-util`; dev: `wiremock`.
- [ ] **Adım 3:** Her crate'te boş `lib.rs`, worker'da `fn main() {}`. `.gitignore`'a `backend-rs/target/`.
- [ ] **Adım 4:** `cargo build` çıkış 0; `cargo tree -i openssl-sys` eşleşme yok. Eşleşme varsa hangi crate'in çektiğini (`cargo tree -i openssl-sys -e features`) bul ve özelliğini düzelt.
- [ ] **Adım 5:** `git status`'ta `target/` görünmüyor. Commit: `chore(backend-rs): add the Cargo workspace for the Rust worker spike`.

### Görev 2: `db` crate

**Dosyalar:**

- Değiştir: `backend-rs/crates/db/src/lib.rs`, `backend-rs/crates/db/Cargo.toml`

**Arayüzler:**

- Üretir: `pub fn worker_pool(database_url: &str) -> Result<sqlx::PgPool, sqlx::Error>` (senkron; havuz tembel bağlanır, `pg.Pool` gibi: ilk sorgu ilk bağlantıyı açar) ve test için `worker_pool_options()`.

- [ ] **Adım 1:** `PgPoolOptions`: `max_connections(2)`, `min_connections(0)`, `idle_timeout(10 s)`, `acquire_timeout(10 s)`. Her değerin yanına karşılığı olan `prisma-worker.ts:28-31` satırını yorum olarak yaz.
- [ ] **Adım 2:** Açılışta Node'daki gibi tek satır log: `✅ [worker] PostgreSQL pool configured: max=2 connections, min=0, idleTimeout=10s, pid=<pid>`.
- [ ] **Adım 3:** Yerel veritabanına karşı bir `#[ignore]`'lu test: havuz açılır, `SELECT 1` döner. `cargo test -p db -- --ignored` ile çalıştır.
- [ ] **Adım 4:** Commit: `feat(backend-rs): add the worker database pool`.

### Görev 3: `esi` crate, yardımcılar ve hata tipi

**Dosyalar:**

- Oluştur: `backend-rs/crates/esi/src/{throttled.rs,route.rs}`
- Değiştir: `backend-rs/crates/esi/src/lib.rs`

**Arayüzler:**

- Üretir:
  - `pub enum ThrottleKind { ErrorLimit, RateLimit, DeepLimit }` (`Display`: `error-limit`, `rate-limit`, `deep-limit`).
  - `pub struct EsiThrottled { pub status: u16 /* 420|429 */, pub kind:
ThrottleKind, pub message: String }`, `std::error::Error`.
  - `pub fn route_template(path: &str) -> String`.
  - `pub(crate) fn seconds(value: Option<&str>) -> Option<f64>` (ms) ve `pub(crate) fn parse_limit(value: Option<&str>) -> Option<(u32,
Duration)>`.

- [ ] **Adım 1:** `route_template`: `?`'ten sonrasını at, `/`'e böl, 40 karakter `[0-9a-f]` → `{hash}`, yalnız rakam → `{id}` (`rate-limiter.ts:102-114`).
- [ ] **Adım 2:** `seconds`: boş veya yalnız boşluk → `None`; sayı değilse → `None`; aksi halde saniye → süre. **Negatif ve sıfır `None` değildir**; onları yok saymak `pause`'un işi (`rate-limiter.ts:394`). Dönüş tipinin `Duration` değil `Option<f64>` (ms) olmasının sebebi bu: `Duration` negatif taşıyamaz.
- [ ] **Adım 3:** `parse_limit`: `^(\d+)/(\d+)([smhd])$` (önce trim), limit ve pencere sıfırdan büyük değilse `None` (`rate-limiter.ts:88-96`).
- [ ] **Adım 4:** `rate-limiter.spec.ts`'teki `routeTemplate` bloğunun 3 vakasını port et; `seconds` ve `parse_limit` için boş, boşluk, sayı olmayan, negatif, `150/15m`, `3600/1h` vakaları ekle.
- [ ] **Adım 5:** Commit: `feat(backend-rs): add ESI route templates and the throttled error`.

### Görev 4: `esi` crate, limiter portu

Haftanın en büyük görevi (spec, _Zaman kutusu_, gün 2–3).

**Dosyalar:**

- Oluştur: `backend-rs/crates/esi/src/limiter.rs`, `backend-rs/crates/esi/tests/limiter.rs`

**Arayüzler:**

- Üretir:
  - `pub struct RateLimiter` (`Clone`, içi `Arc`). `RateLimiter::new(max_rps:
u32)`, `RateLimiter::from_env()` (`ESI_MAX_RPS`, varsayılan 50).
  - `pub struct EsiRoute { pub path: String, pub bucket_key: Option<String> }`.
  - `pub async fn acquire(&self, route: &EsiRoute, max_wait: Option<Duration>)
-> Result<Permit, EsiThrottled>`; `Permit` drop edilince `release`
    (in-flight sayacı bir azalır). JS'teki `acquire` + `finally { release() }`
    ikilisinin karşılığı; `release`'i unutmak mümkün olmaz.
  - `pub fn observe(&self, route: &EsiRoute, status: u16, headers:
&HashMap<String, String>)` (anahtarlar küçük harf).
  - `pub fn stats(&self) -> LimiterStats { queue_length, current_rate,
paused_until, max_requests_per_second }`.

**Port kuralları** (JS → Rust):

| JS                                                  | Rust                                                                                                                             |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `Date.now()`                                        | `tokio::time::Instant::now()`; testlerde `start_paused = true` ile sanal saat.                                                   |
| `NaN` (henüz okunmamış `limit` / `remaining`)       | `Option<f64>`; `!(limit > 0)` → `limit.map_or(true, \|l\| l <= 0.0)`. NaN karşılaştırmalarının "her zaman false" anlamı korunur. |
| `-Infinity` (`loweredAt`, `sentAt`)                 | `Option<Instant>`; `None` "hiç olmadı" demek.                                                                                    |
| `queue: Waiter[]`, `grant` / `reject`               | `VecDeque<Waiter>`, her waiter'da bir `oneshot::Sender<Result<(), EsiThrottled>>`.                                               |
| `parked: Map<Waiter, setTimeout>`                   | `HashMap<u64, (Waiter, AbortHandle)>`; zamanlayıcı `tokio::spawn` + `sleep`, iptal `abort()`.                                    |
| `processQueue` async döngüsü + `processing` bayrağı | Tek bir dispatcher task'ı; `Notify` ile uyandırılır. Bayrağa gerek kalmaz.                                                       |
| `logger.warn`                                       | `tracing::warn!`, metin aynı.                                                                                                    |

Durum tek bir `std::sync::Mutex<State>` içinde; kilit hiçbir `.await`
boyunca tutulmaz. Dispatcher, bekleyeceği süreyi kilit altında hesaplar,
kilidi bırakır, sonra uyur.

- [ ] **Adım 1:** Sabitler `rate-limiter.ts:60-78` ile aynı adlarla (`ERROR_LIMIT_FLOOR`, `DEFAULT_PAUSE_MS`, `DEEP_LIMIT_PAUSE_MS`, `RATE_DECREASE`, `MAX_PAUSE_MS`, `RATE_CLIMB_INTERVAL_MS`, `LOW_TOKEN_SHARE`, `SUCCESS_TOKEN_COST`). `max_concurrent = max(50, max_rps)`.
- [ ] **Adım 2:** `current_rate`, `lower_rate`, `pause` ve `reject_waiters_before` (`rate-limiter.ts:175-182, 384-444`). `pause`'ta `ms <= 0` → dön; `until <= paused_until` → dön; log yalnızca uzatma ≥ 1 s ise.
- [ ] **Adım 3:** `observe` ve `observe_group` (`rate-limiter.ts:279-382`). Gruplu 429 süreç frenini **kurmaz**; boş `x-esi-error-limit-remain` değer değildir.
- [ ] **Adım 4:** `respace`, `ready_at`, `bucket_key_of`, `park_head_if_waiting` ve dispatcher döngüsü (`rate-limiter.ts:217-242, 450-539`): fren → bekle; 1 s pencere sıfırlama; baştaki waiter'ın bucket'ı hazır değilse park et; `request_count >= rate` → pencerenin sonuna kadar bekle; in-flight sınırı; aksi halde ver ve `max(1, 1000 / rate)` ms bekle.
- [ ] **Adım 5:** `acquire`: `max_wait` yoksa kuyruğa gir. Varsa önce süreç freni ve bucket hazır olma zamanı deadline'ı aşıyor mu bak, aşıyorsa hemen `Err`; aşmıyorsa deadline'lı waiter olarak gir (`rate-limiter.ts:250-272`). Hata mesajları JS'teki metinlerle aynı.
- [ ] **Adım 6:** `rate-limiter.spec.ts`'teki 43 vakanın tamamını `tests/limiter.rs`'e port et, `describe` blokları `mod` olarak: dispatch (3), stats (1), acquire (1), brake (10), adaptive rate (6), maxWait (4), group buckets (15), ve Görev 3'te taşınan routeTemplate (3). Her vakanın üstüne kaynağının satır numarasını yorum olarak yaz. Bir vaka Rust'ta anlamını kaybediyorsa (ör. JS'e özgü bir davranış) **silme**: neden farklı olduğunu yaz ve kullanıcıya sor.
- [ ] **Adım 7:** `cargo test -p esi` hepsi geçer. Commit: `feat(backend-rs): port the ESI rate limiter`.

### Görev 5: `esi` crate, client

**Dosyalar:**

- Oluştur: `backend-rs/crates/esi/src/client.rs`, `backend-rs/crates/esi/tests/{client.rs,guard.rs}`

**Arayüzler:**

- Üretir:
  - `pub struct EsiClient` (`Clone`). `EsiClient::new(limiter: RateLimiter)`; testler için `EsiClient::with_base_url(limiter, url)`.
  - `pub async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T,
EsiError>`.
  - `pub enum EsiError { Throttled(EsiThrottled), Http { status: u16, path:
String }, Transport(reqwest::Error), Decode(serde_json::Error) }` ve
    `pub fn status(&self) -> Option<u16>`.

- [ ] **Adım 1:** Sabitler yalnız bu dosyada: `ESI_BASE_URL = "https://esi.evetech.net"`, `COMPATIBILITY_DATE = "2020-01-01"`. Varsayılan header'lar: `User-Agent: KillReport-rs/<CARGO_PKG_VERSION> (+https://github.com/umutyerebakmaz/killreport)`, `X-Compatibility-Date`. Timeout 30 s.
- [ ] **Adım 2:** `get`: `acquire(route, None)` → istek → yanıt header'larını küçük harfli `HashMap`'e çevir → `observe` → 420/429 ise `EsiThrottled` (`kind`: 420 → error-limit; 429 + `x-ratelimit-group` → rate-limit; aksi deep-limit, `esi-client.ts:47-54`) → 2xx değilse `Http` → gövdeyi decode et. `Permit` fonksiyon sonunda düşer. Bağlantı hatasında (yanıt yok) `observe` çağrılmaz, JS'teki gibi.
- [ ] **Adım 3:** Hata mesajları hiçbir header içermez (`Authorization` redaksiyonunun karşılığı, `esi-client.ts:57-66`): `EsiError`'ın `Display`'i yalnızca status ve path yazar.
- [ ] **Adım 4:** `tests/client.rs` (wiremock): 200 decode; 404 → `Http { status: 404 }`; 420 → `Throttled` + limiter freni kurulmuş (`stats().paused_until`); gruplu 429 → `Throttled(RateLimit)` + süreç freni yok; header'sız 429 → `Throttled(DeepLimit)`; gönderilen `User-Agent` ve `X-Compatibility-Date` doğru.
- [ ] **Adım 5:** `tests/guard.rs`: `backend-rs/` altındaki bütün `.rs` dosyalarını gez (`target/` hariç); `esi.evetech.net` yalnızca `crates/esi/src/client.rs`'te geçmeli (`esi-client.guard.spec.ts`'in karşılığı). Guard dosyasının kendisi aradığı metni parçalayarak yazar (`concat!("esi.", "evetech.net")`), yoksa kendine takılır.
- [ ] **Adım 6:** Commit: `feat(backend-rs): add the ESI client`.

### Görev 6: `mq` crate

**Dosyalar:**

- Oluştur: `backend-rs/crates/mq/src/{topology.rs,failure.rs}`, `backend-rs/crates/mq/tests/{failure.rs,topology.rs}`
- Değiştir: `backend-rs/crates/mq/src/lib.rs`

**Arayüzler:**

- Üretir:
  - `pub mod retry_topology { DLX = "killreport.dlx", RETRY =
"killreport.retry", WAIT = "killreport.wait", PARKING =
"killreport.parking", WAIT_TTL_MS = 30_000 }` (`queue-names.ts:66-72`).
  - `pub async fn connect(url: &str) -> Result<(Connection, Channel),
lapin::Error>`.
  - `pub async fn declare_worker_queue(channel: &Channel, queue: &str) ->
Result<(), lapin::Error>`: iki exchange, wait ve parking kuyrukları,
    `wait → dlx` bağlantısı, işçi kuyruğu (`durable`, `x-max-priority: 10`) ve
    `queue → retry` bağlantısı (`rabbitmq.ts:134-166`, yalnızca bir kuyruk).
  - `pub const MAX_ATTEMPTS: u32 = 5`.
  - `pub fn death_count(delivery: &Delivery) -> u32`.
  - `pub fn is_forbidden(error: &anyhow::Error) -> bool`.
  - `pub trait Settle { async fn ack(&self); async fn nack(&self, requeue:
bool); async fn park(&self, body: &[u8], headers: &FieldTable); }` —
    gerçek uygulaması `lapin` kanalı + delivery, testteki çifti yaptığı
    çağrıları kaydeder.
  - `pub async fn handle_worker_error(settle: &impl Settle, delivery_body:
&[u8], headers: &FieldTable, queue: &str, error: &anyhow::Error)`.

- [ ] **Adım 1:** `death_count`: `x-death` yoksa, dizi değilse veya boşsa 0; ilk elemanın `count`'u sayı değilse 0 (`worker-error.ts:37-42`). AMQP tablosunda sayının türü `LongLongInt` olarak gelir; diğer tamsayı türlerini de kabul et.
- [ ] **Adım 2:** Sınıflama: `error.downcast_ref::<EsiError>()` varsa status'u oradan al; `EsiError::Throttled` ayrı dal. Yoksa `error.to_string()`'in **ilk satırına** `\b(420|429)\b`, `\b404\b`, `\b403\b` uygula (`worker-error.ts:59-128`).
- [ ] **Adım 3:** `handle_worker_error` dalları, sırasıyla (`worker-error.ts:142-216`): Throttled → uyar + `nack(true)`; ESI dışı 420/429 → uyar + 60 s `sleep` + `nack(true)`; 404 → uyar + `ack`; `death_count + 1 >= 5` → `park(body, headers)` + `ack`; aksi → hata logu + `nack(false)`. Her yolda tam bir settle. `park` mesajı varsayılan exchange'e, `killreport.parking` routing key'iyle, `persistent` (delivery mode 2) ve aynı header'larla yayınlar.
- [ ] **Adım 4:** `worker-error.spec.ts`'teki 25 vakayı `tests/failure.rs`'e port et: `deathCount` (2), `handleWorkerError` (13), `isForbidden` (4), "ilk satırın ötesindeki status" (5), "daha uzun bir sayının içindeki status" (1). 60 s'lik uykuyu bekleyen vakalar `start_paused = true` ile.
- [ ] **Adım 5:** `tests/topology.rs`, `#[ignore]`'lu, yerel RabbitMQ'ya karşı: (a) `declare_worker_queue` iki kez çağrılır, ikincisi hata vermez; (b) Node'un `ensureAllQueuesExist()`'i çalıştırılmış bir broker'da (`yarn workspace backend worker:info:alliances` bir kez açılıp kapatılarak) Rust'ın tanımı 406 vermez.
- [ ] **Adım 6:** Commit: `feat(backend-rs): add the queue topology and the shared failure path`.

### Görev 7: Worker'ın saf parçaları ve upsert

**Dosyalar:**

- Oluştur: `backend-rs/workers/worker-info-alliances/src/{message.rs,alliance.rs}`, `backend-rs/workers/worker-info-alliances/tests/{parse.rs,upsert.rs}`, `backend-rs/workers/worker-info-alliances/tests/fixtures/alliances.sql`, `backend-rs/.sqlx/`

**Arayüzler:**

- Üretir:
  - `struct EntityQueueMessage { #[serde(rename = "entityId")] entity_id: i32 }` — `queuedAt` ve `source` alanları struct'ta yok, serde onları yok sayar; `deny_unknown_fields` **yok**.
  - `struct AllianceInfo { name, ticker, date_founded: DateTime<Utc>,
creator_corporation_id: i32, creator_id: i32, executor_corporation_id:
Option<i32>, faction_id: Option<i32> }`.
  - `async fn upsert_alliance(pool: &PgPool, id: i32, info: &AllianceInfo) ->
Result<bool /* inserted */, sqlx::Error>`.

- [ ] **Adım 1:** Upsert, spec'teki SQL'in birebir aynısı, `sqlx::query!` ile. `date_founded` `NaiveDateTime` (UTC) olarak bağlanır. Tablonun zaman dilimsiz `TIMESTAMP(3)` olduğunu ve Prisma'nın UTC yazdığını fonksiyonun yorumunda belirt.
- [ ] **Adım 2:** `cargo sqlx prepare --workspace` ile `.sqlx/` üret (yerel `DATABASE_URL`'e karşı). Bundan sonra `SQLX_OFFLINE=true cargo build` de çalışmalı.
- [ ] **Adım 3:** Fixture: `pg_dump --schema-only --table=alliances "$DATABASE_URL" > tests/fixtures/alliances.sql`. Elle yazılmaz; tablonun gerçek, güncel şekli bu. `alliance_snapshots`'ın FK'sı fixture'a girmez, gerekmez.
- [ ] **Adım 4:** `tests/parse.rs`: mesaj gövdesi `{"entityId":99000001, "queuedAt":"…","source":"queue-alliances"}` parse olur; `entityId` eksik veya sayı değilse parse hatası. ESI gövdesi: `executor_corporation_id` ve `faction_id` eksik → `None`; `date_founded` `2010-11-04T13:11:00Z` ve `2010-11-04T13:11:00.123Z` ikisi de doğru `DateTime`'a.
- [ ] **Adım 5:** `tests/upsert.rs`, `#[sqlx::test(migrations = false, fixtures("alliances"))]` (sqlx her test için geçici bir veritabanı açar; asıl veritabanının tablolarına dokunmaz):
  - yeni ID → `true`, satır doğru, `updated_at` dolu, `created_at` dolu;
  - aynı ID tekrar → `false`; `name`, `ticker` yeni değerde; `updated_at` ilk değerden büyük;
  - update'te farklı `date_founded`, `creator_*` gönder → eski değerler kalır;
  - `corporation_count = 7` elle yazılmış bir satır update'ten sonra hâlâ 7;
  - `executor_corporation_id` dolu bir satıra `None` ile update → `NULL`;
  - `date_founded` milisaniyeli değer → okunan değer milisaniyesiyle aynı.
- [ ] **Adım 6:** Commit: `feat(backend-rs): add the alliance message, ESI shape and upsert`.

### Görev 8: Worker binary'si

**Dosyalar:**

- Değiştir: `backend-rs/workers/worker-info-alliances/src/main.rs`, `backend/package.json`

**Arayüzler:**

- Tüketir: `db::worker_pool`, `esi::{RateLimiter, EsiClient}`, `mq::{connect, declare_worker_queue, handle_worker_error}`.
- Üretir: `yarn workspace backend worker:info:alliances:rs`.

- [ ] **Adım 1:** Sabitler: `QUEUE_NAME = "esi_alliance_info_queue"`, `PREFETCH_COUNT = 3` (`worker-info-alliances.ts:11-12`).
- [ ] **Adım 2:** `main`: `dotenvy::dotenv()` (çalışma dizinindeki `.env`), `tracing_subscriber` (stdout), havuz, limiter, client. Açılış logları Node'daki dört satırla aynı (`🤝 alliance info worker started`, `📦 queue: …`, `⚡ prefetch: 3 concurrent`).
- [ ] **Adım 3:** Dış döngü (`worker-info-alliances.ts:28-178`): bağlan → `declare_worker_queue` → `basic_qos(3)` → consume (`no_ack: false`). Bağlantı veya kanal düşerse `💥 worker error: …`, `🔄 reconnecting in 5 seconds...`, 5 s bekle, tekrar.
- [ ] **Adım 4:** Mesaj işleme, eşzamanlı en fazla 3 (`for_each_concurrent(3, …)`): parse → `esi.get::<AllianceInfo>("/alliances/{id}")` → `upsert_alliance` → `ack` ve `  ✅ [n] <name> [<ticker>] ID:<id> (created|updated)`. Herhangi bir hata, **parse hatası dahil**, → `handle_worker_error` ve sayaçlar. Bu Node'dan bilinçli bir farktır (karar: 2026-11-13, spec _Hata yolu_): Node'da `JSON.parse` `try`'ın dışında (`worker-info-alliances.ts:86-89`), bozuk bir gövde consume callback'ini patlatır ve mesaj ack'lenmeden kalır. Rust'ta bozuk gövde ortak yolun "diğer" dalından geçer: 4 tekrar, 5.'de `killreport.parking`. Görev 7'nin parse testleri bu dalı kapsar.
- [ ] **Adım 5:** Sayaçlar (`processed`, `created`, `updated`, `errors`) ve 5 s'de bir "kuyruk bitti" kontrolü: son mesajdan 5 s geçtiyse ve en az bir mesaj işlendiyse Node'daki üç satırlık özeti bas (`worker-info-alliances.ts:49-58`). Node bunu her 5 s'de tekrar basar; aynısını yap, karşılaştırma loglarında farklı görünmesin.
- [ ] **Adım 6:** Kapanış: `tokio::signal::ctrl_c()` (ve `cfg(unix)` altında SIGTERM) → yeni mesaj almayı bırak (consumer'ı iptal et), işlenmekte olanların bitmesini bekle, bağlantıyı ve havuzu kapat, `worker stopped`.
- [ ] **Adım 7:** `backend/package.json` `scripts`'e: `"worker:info:alliances:rs": "cargo run --release --manifest-path ../backend-rs/Cargo.toml -p worker-info-alliances"`. Yarn'ın portable shell'i bunu olduğu gibi çalıştırır (CLAUDE.md, `scripts/` bölümü). `npx prettier --check backend/package.json`.
- [ ] **Adım 8:** Duman testi: `yarn workspace backend queue:alliances` ve `yarn workspace backend worker:info:alliances:rs`; kuyruk biter, özet basılır, Ctrl+C temiz kapanır. Commit: `feat(backend-rs): add the Rust alliance info worker`.

### Görev 9: CI job'u ve sözleşme kontrolleri (ölçüm 2)

**Dosyalar:**

- Değiştir: `.github/workflows/ci.yml`

- [ ] **Adım 1:** `ci.yml`'e `backend-rs` job'u: `ubuntu-latest`, `timeout-minutes: 20`, `services.postgres` (kullanıcı ve veritabanı workflow düzeyindeki `DATABASE_URL` ile aynı: `ci` / `ci` / `killreport`), adımlar `actions/checkout@v4`, `Swatinem/rust-cache`, `working-directory: backend-rs` altında `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test`, env `SQLX_OFFLINE: "true"`. Toolchain `rust-toolchain.toml`'dan gelir. `#[ignore]`'lu testler CI'da çalışmaz (RabbitMQ ve yerel veriye bağlılar). Diğer job'lara dokunma. `npx prettier --check .github/workflows/ci.yml`.
- [ ] **Adım 2:** Sözleşme kontrolleri yerelde, önce Node sonra Rust ile, sonuçlar yan yana not edilir:
  - **404:** kuyruğa elle `{"entityId":99999999,"queuedAt":"…","source":"manual"}` (RabbitMQ yönetim arayüzü, _Publish message_). Beklenen: uyarı + `ack`, kuyruk boş, parking boş. `entityId: 1` **kullanma**: ESI geçersiz aralıktaki bir ID'ye 404 değil 422 döner (2026-11-13'te görüldü) ve mesaj 404 dalına değil retry dalına gider. Bu Node'da da aynıdır.
  - **Retry ve parking:** worker çalışırken yerel PostgreSQL'i durdur, bir alliance ID'si yayınla. Beklenen: 4 deneme (her biri arasında ~30 s, `killreport.wait` üzerinden), 5.'de `killreport.parking`'e düşer; parking'deki mesajın `x-death` header'ı var. PostgreSQL'i tekrar başlat.
  - **Throttle:** gerçek bir 420 üretmek ESI'yi zorlamak demek; bu dal birim testleriyle (Görev 5 ve 6) kapsanır, burada denenmez.
- [ ] **Adım 3:** Commit: `ci: run fmt, clippy and tests for backend-rs`.

### Görev 10: Karşılaştırma koşuları ve karar

**Dosyalar:**

- Değiştir: `docs/superpowers/specs/2026-11-12-rust-worker-spike-design.md` (sonuçlar bölümü)

Spec'teki _Aşama 1: yerel karşılaştırma koşusu_ prosedürü, harfiyen.

- [ ] **Adım 1:** Reponun dışında bir ölçüm klasörü aç (ör. `%USERPROFILE%\killreport-spike\`). CSV'ler ve bellek örnekleri buraya.
- [ ] **Adım 2:** Bellek örnekleme, koşu boyunca ayrı bir PowerShell penceresinde (`<pid>`: Node için worker'ı çalıştıran `node.exe`, Rust için `worker-info-alliances.exe`; Görev Yöneticisi'nin _Ayrıntılar_ sekmesinden veya `Get-Process node, worker-info-alliances`):

  ```powershell
  while ($true) { Get-Process -Id <pid> | Select-Object @{n='t';e={Get-Date -Format o}}, WorkingSet64, PrivateMemorySize64 | Export-Csv -Append mem-<worker>-<n>.csv; Start-Sleep 5 }
  ```

- [ ] **Adım 3:** Üç koşu çifti, sıra: Node→Rust, Rust→Node, Node→Rust. Her koşu: kuyruk boş ve iki worker kapalı → `queue:alliances` → worker → özet satırı + süre not → worker kapat → `\copy` ile CSV.
- [ ] **Adım 4:** Her çiftin CSV'lerini karşılaştır: `git diff --no-index alliances-node-<n>.csv alliances-rs-<n>.csv`. Fark varsa o ID'yi ESI'den tekrar çek ve gerçek bir değişiklik olup olmadığına bak.
- [ ] **Adım 5:** Spec'e `## Sonuçlar (aşama 1)` bölümü ekle: beş ölçümün tablosu (her koşu için ham değerler), eşiklere göre geçti / kaldı, ölçüm 5 için gün gün saatler ve cold / incremental build süreleri, ve spec'teki _Aşama 1'in kararı_ kuralına göre karar.
- [ ] **Adım 6:** Commit: `docs(specs): record the phase 1 results of the Rust worker spike`. Karar "devam" ise aşama 2 droplet aktif olunca başlar; "dur" ise spec'te yazdığı gibi analiz dokümanına eklenir.
