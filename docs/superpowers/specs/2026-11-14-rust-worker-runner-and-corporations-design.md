# Rust worker'ları için ortak çalıştırıcı ve ikinci worker (`worker-info-corporations`) — tasarım

Tarih: 2026-11-14

## Amaç ve neden

Spike'ın birinci aşaması (`2026-11-12-rust-worker-spike-design.md`) tek bir
worker'la geçti: aynı çıktı, Node'un ~%10'u kadar bellek. Sıradaki soru,
**ikinci worker'ın maliyeti.** `worker-info-alliances/src/main.rs` 286 satır;
bunun ~230 satırı alliance'a özgü değil (bağlanma, yeniden bağlanma, consume
döngüsü, sayaçlar, "queue completed" özeti, kapanış, tracing kurulumu).
Bugünkü yapıyla her yeni worker bunu kopyalar.

Bu iş iki şey yapar:

1. Ortak kısmı `crates/runner` adında bir kütüphaneye taşır; alliance worker'ı
   onun üzerine yeniden kurulur, davranışı değişmez.
2. İkinci worker'ı, `worker-info-corporations`'ı, bu çalıştırıcının üzerine
   yazar. Böylece "yeni bir worker ne kadar tutuyor" sorusu gerçek bir rakamla
   cevaplanır.

### Kullanıcının asıl gereksinimi: süreç izolasyonu

"No shared runner" kuralının (`CLAUDE.md:439`) koruduğu şey **çalışma
anındaki** bağımsızlık:

- Bir worker'ın çökmesi, durdurulması ya da yeniden başlatılması
  (örneğin `worker-redisq-stream` çalışırken) diğerlerini etkilememeli.
- Bazı worker'lar cron ile tetikleniyor (PM2 `cron_restart`, OS crontab),
  bazıları istendiği an elle başlatılıp durdurulabilmeli.
- Bellek düşük kalmalı.

Bu tasarım üçünü de korur, çünkü **kod paylaşmak süreç paylaşmak değildir.**
`runner` bir kütüphane; derlemede her worker'ın kendi binary'sine girer.
Çalışma anında ortak bir süreç, ortak bir döngü ya da ortak bir bağlantı
yoktur. Her worker ayrı binary, ayrı süreç, kendi RabbitMQ bağlantısı, kendi
veritabanı havuzu, kendi `QUEUE_NAME`'i olarak kalır. Node'da bugün de böyle:
bütün worker'lar `worker-error.ts`'i ve `esi-client.ts`'i import eder, ama her
biri ayrı süreç.

Bellek açısından ayrı süreçler Rust'ta ucuz: aşama 1'de worker başına en
fazla 26 MB (Node'da 220–320 MB). "RAM için worker'ları tek sürece toplayalım"
seçeneğine bu yüzden gerek yok; zaten izolasyonu bozduğu için reddedildi
(bkz. _Yaklaşımlar_).

## Hedefler

- `backend-rs/crates/runner`: bir worker'ın kuyruğa bağlanıp mesaj işlediği,
  çöktüğünde yeniden bağlandığı ve düzgün kapandığı ortak döngü.
- `worker-info-alliances` bu çalıştırıcıya taşınır. Log satırları, ack/nack
  davranışı, kapanış ve yeniden bağlanma bugünküyle **aynı**; mevcut testleri
  değişmeden geçer.
- `backend-rs/workers/worker-info-corporations`: `esi_corporation_info_queue`
  kuyruğunu tüketen, `worker-info-corporations.ts` ile davranışça aynı Rust
  worker.
- `backend/package.json`'a `worker:info:corporations:rs` scripti.
- `CLAUDE.md:439` kuralının güncellenmesi (bkz. _Kural değişikliği_).
- Yeni worker'ın satır sayısının kayda geçmesi (kaynak ve test ayrı).

## Hedef dışı

- Node worker'larına herhangi bir değişiklik. İkisi de geri dönüş yolu olarak
  yerinde kalır.
- Kuyruk adı, mesaj formatı, kuyruk argümanları ya da Prisma şemasında
  değişiklik.
- PM2 (`ecosystem.config.js`), crontab, production deploy, Linux (musl)
  derlemesi. Bunlar spike'ın aşama 2'sine ait.
- `esi`, `mq`, `db` crate'lerinde çalıştırıcının ihtiyacı dışında bir
  refactor.
- Üçüncü bir worker, ya da info worker'larından farklı yapıdaki worker'lar
  (killmail-detail, redisq-stream) için genelleme.
- Node'la yeni bir bellek karşılaştırması. Bellek aşama 1'de ölçüldü; ikinci
  worker aynı çalıştırıcıyı kullanacağı için ayrıca ölçülmez.

## Anti-hedefler (çalışsa bile başarısızlık sayılır)

- Bir worker'ın durumunun, hatasının ya da yaşam döngüsünün başka bir worker'ı
  etkileyebildiği her yapı: tek süreçte birden çok worker, worker'lar arası
  paylaşılan bağlantı, havuz ya da kanal.
- Çalıştırıcının içinde kuyruk adına ya da worker türüne göre dallanma
  (`if queue == ...`). Çalıştırıcı hangi worker'ı çalıştırdığını bilmez.
- Kodu ne yaptığını görmeyi zorlaştıracak kadar gizlemek (makro üretimi bir
  `main`).
- Alliance worker'ının davranışında, log satırı dahil, fark çıkması.

## Kısıtlar

| Kısıt                                                                                                                                                                | Kaynak                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Her `assertQueue` `x-max-priority: 10` ile; yoksa 406 ve worker çıkar. Çalıştırıcı kuyruğu mevcut `mq::declare_worker_queue` ile tanımlar.                           | `CLAUDE.md`, _Declaring a queue_; `crates/mq/src/topology.rs` |
| Her ESI isteği `esi::EsiClient` üzerinden; kendi rate limit'i, retry'ı ya da sleep'i yok. `esi.evetech.net` yalnızca `crates/esi/src/client.rs`'te.                  | `CLAUDE.md`, _Rate limiting_; `crates/esi/tests/guard.rs`     |
| Worker havuzu süreç başına 2 bağlantı (`db::worker_pool`). Rust worker'ı yerine geçtiği Node worker'ının bütçesini kullanır, ikisi aynı anda production'da çalışmaz. | `prisma-worker.ts:28-32`; DigitalOcean 22 bağlantı            |
| Hata yolu tek: `mq::handle_worker_error`. 404 uyarı + atla, throttle anında requeue, deneme sayısı, parking.                                                         | `crates/mq/src/failure.rs`                                    |
| Sorgular `sqlx::query!` ailesiyle; CI `SQLX_OFFLINE=true` ile derler, `.sqlx/` yeni sorgu için `cargo sqlx prepare --workspace` ile yenilenip commit edilir.         | `.github/workflows/ci.yml:115-117`                            |
| Her worker kuyruk adını `QUEUE_NAME` sabiti olarak kendi kodunda tutar.                                                                                              | `CLAUDE.md`, _Workers and queues_                             |
| Branch, commit, PR ve kod yorumları İngilizce. Bu doküman Türkçe.                                                                                                    | `CLAUDE.md`, _Working with the user_                          |

## Yaklaşımlar

1. **Trait + ortak çalıştırıcı kütüphanesi (seçildi).** Worker küçük bir
   trait'i uygular (kuyruk adı, prefetch, bir mesajı işleyen `handle`);
   `runner::run` geri kalan her şeyi yapar. `main.rs` ~15 satıra iner. Tipler
   açık kalır, worker'ın `handle`'ı testte tek başına çağrılabilir. Bedeli:
   trait'in sınırını bir kere doğru çizmek.
2. **Fonksiyon + closure.** `runner::run(config, |msg| async { … })`. Trait
   tanımı yok, ama pool ve ESI client closure'a `Arc` ile taşınır. Async
   closure'larda ömür kuralları sürtünmeli, `handle`'ı tek başına test etmek
   zahmetli.
3. **Makro.** `info_worker!(…)` bütün `main`'i üretir. En kısa çıktı, ama hata
   mesajları ve okunabilirlik kötüleşir. Anti-hedeflere takılır.
4. **Kural kalır, yalnızca yapı taşları paylaşılır.** Tracing kurulumu,
   kapanış sinyali, sayaçlar ortak; bağlanma, yeniden bağlanma ve consume
   döngüsü (~90 satır) her worker'a kopyalanır. `main.rs` ~130 satır. En çok
   tekrar eden kısmı tekrar etmeye devam ettiği için elendi.
5. **Tek süreç, bütün worker'lar görev (task) olarak.** En az toplam bellek,
   ama bir panic ya da bellek sızıntısı hepsini düşürür; worker'lar tek tek
   başlatılıp durdurulamaz. Kullanıcının asıl gereksinimine aykırı, elendi.

Kullanıcı 1'i seçti. Kural konusundaki gerekçe yukarıda, _Kullanıcının asıl
gereksinimi_.

## Tasarım

### Dizin yapısı

```text
backend-rs/
├── crates/
│   ├── db/  esi/  mq/                 # değişmez
│   └── runner/                        # YENİ
│       ├── src/lib.rs                 # Worker trait'i, run(), Processed
│       ├── src/message.rs             # EntityQueueMessage (alliance'tan taşınır)
│       ├── src/totals.rs              # sayaçlar + "queue completed" özeti
│       ├── src/shutdown.rs            # shutdown_signal()
│       └── tests/
└── workers/
    ├── worker-info-alliances/         # main.rs küçülür, message.rs silinir
    └── worker-info-corporations/      # YENİ
        ├── src/main.rs
        ├── src/lib.rs
        ├── src/corporation.rs         # CorporationInfo + upsert_corporation
        └── tests/{parse.rs, upsert.rs, fixtures/corporations.sql}
```

### `runner` crate'inin sözleşmesi

```rust
/// What a worker reports for a message it processed successfully.
pub struct Processed {
    /// true if the row was new (INSERT), false if it existed (UPDATE).
    pub inserted: bool,
    /// The part of the success log line between the counter and the
    /// "(created)/(updated)" suffix; the worker decides its own shape.
    pub detail: String,
}

pub trait Worker: Send + Sync + 'static {
    const QUEUE_NAME: &'static str;
    const PREFETCH_COUNT: u16;
    const CONSUMER_TAG: &'static str;
    /// "🤝 alliance info worker started" — the first log line.
    const STARTED: &'static str;
    /// "alliances" in "⏳ waiting for alliances...".
    const WAITING_FOR: &'static str;
    /// "alliance" in "(alliance 99000001)" on the failure path.
    const ENTITY: &'static str;

    fn handle(&self, id: i32) -> impl Future<Output = anyhow::Result<Processed>> + Send;
}

/// What the runner hands the worker's constructor.
pub struct Resources { pub pool: PgPool, pub esi: EsiClient }

pub async fn run<W: Worker>(build: impl FnOnce(Resources) -> W) -> anyhow::Result<()>;
```

Worker'ın `main.rs`'i:

```rust
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    runner::run(|r| CorporationWorker { pool: r.pool, esi: r.esi }).await
}
```

`run`'ın yaptıkları, bugünkü `main.rs`'teki sırayla ve aynı log
satırlarıyla: `.env` + tracing kurulumu, `DATABASE_URL` / `RABBITMQ_URL` /
`RateLimiter::from_env`, havuz, başlangıç satırları, yeniden bağlanma döngüsü
(5 s), bağlantı başına `declare_worker_queue` + `basic_qos` + `basic_consume`,
`for_each_concurrent(PREFETCH_COUNT)`, mesaj başına
`EntityQueueMessage::parse` → `handle` → başarıda sayaç + log + ack, hatada
sayaç + `handle_worker_error` (bağlam `"{ENTITY} {id}"` ya da
`"unparseable message"`), 5 s sessizlik özeti, SIGINT/SIGTERM'de cancel +
elindeki mesajları bitirme + bağlantıları ve havuzu kapatma.

Başarı log satırı çalıştırıcıda biçimlenir:
`"  ✅ [{n}]{detail} ({created|updated})"`. Worker `detail`'ı kendi biçimiyle
verir ki iki Node worker'ının farklı satırları birebir korunsun:

- alliance: `detail = " {name} [{ticker}] ID:{id}"`
  → `"  ✅ [12] Foo [FOO] ID:99000001 (created)"` (`worker-info-alliances.ts:129-134`)
- corporation: `detail = "[{id}] {name} [{ticker}]"`
  → `"  ✅ [12][98000001] Foo [FOO] (updated)"` (`worker-info-corporations.ts:136-143`)

Node'un corporation satırındaki ANSI renkleri (`\x1b[36m(updated)\x1b[0m`,
`\x1b[32m(created)\x1b[0m`) korunmaz: alliance Rust worker'ı renksiz, ve
renk kodu log dosyasına çöp olarak düşer. **Benim kararım**, metin aynı kalır.

`Worker` trait'i mesaj tipine göre generic **değil**: her info worker'ı
`EntityQueueMessage` (`entityId`) tüketir, ve hedef dışı olan farklı yapıdaki
worker'lar için şimdiden genellemek tahmine dayalı olur. Üçüncü, farklı
mesajlı bir worker geldiğinde trait genişletilir.

### Alliance worker'ının taşınması

- `main.rs` yukarıdaki ~15 satıra iner; `AllianceWorker { pool, esi }`
  `Worker`'ı uygular: `handle` bugünkü `process`'in içindeki ESI çağrısı +
  `upsert_alliance`.
- `message.rs` `runner`'a taşınır; `tests/parse.rs` içindeki mesaj vakaları
  `crates/runner/tests/`'e gider, ESI yanıtı vakaları worker'da kalır.
- `alliance.rs` ve `tests/upsert.rs` değişmez.
- Davranışın aynı kaldığının kanıtı: mevcut testler + bir yerel koşu
  (`yarn queue:alliances` → `yarn worker:info:alliances:rs`), log satırlarının
  ve özet satırının bugünküyle aynı biçimde çıktığına bakılır.

### `worker-info-corporations`

Sabitler (`worker-info-corporations.ts:12-13`):

- `QUEUE_NAME = "esi_corporation_info_queue"`
- `PREFETCH_COUNT = 25`
- `CONSUMER_TAG = "worker-info-corporations-rs"`
- `STARTED = "🏢 corporation info worker started"`, `WAITING_FOR =
"corporations"`, `ENTITY = "corporation"`

ESI yanıtı, `GET /corporations/{id}/`. ESI eksik anahtarı hiç göndermez,
bu yüzden isteğe bağlı her alan `#[serde(default)] Option`:

```rust
pub struct CorporationInfo {
    pub name: String,
    pub ticker: String,
    pub member_count: i32,
    pub ceo_id: i32,
    pub creator_id: i32,
    pub tax_rate: f64,
    #[serde(default)] pub date_founded: Option<DateTime<Utc>>,
    #[serde(default)] pub description: Option<String>,
    #[serde(default)] pub alliance_id: Option<i32>,
    #[serde(default)] pub faction_id: Option<i32>,
    #[serde(default)] pub home_station_id: Option<i32>,
    #[serde(default)] pub shares: Option<i64>,
    #[serde(default)] pub url: Option<String>,
}
```

`war_eligible` gibi okunmayan alanlar yok sayılır (`deny_unknown_fields`
kullanılmaz).

Kolonlar (`20251207200258_init/migration.sql`, `corporations`):
`date_founded TIMESTAMP(3)` boş olabilir, `shares BIGINT`, `tax_rate DOUBLE
PRECISION NOT NULL`, `updated_at TIMESTAMP(3) NOT NULL` varsayılansız.
`alliance_id` üzerindeki foreign key `20260101155358_remove_alliance_corporation_relations`
ile kaldırıldı; henüz `alliances`'ta olmayan bir alliance'a işaret eden
corporation yazılabilir.

Upsert, Node'un `create` / `update` ayrımıyla birebir
(`worker-info-corporations.ts:95-128`):

```sql
INSERT INTO corporations (
  id, name, ticker, member_count, ceo_id, creator_id, date_founded,
  description, alliance_id, faction_id, home_station_id, shares, tax_rate,
  url, updated_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now())
ON CONFLICT (id) DO UPDATE SET
  name         = EXCLUDED.name,
  ticker       = EXCLUDED.ticker,
  member_count = EXCLUDED.member_count,
  ceo_id       = EXCLUDED.ceo_id,
  alliance_id  = EXCLUDED.alliance_id,
  faction_id   = EXCLUDED.faction_id,
  tax_rate     = EXCLUDED.tax_rate,
  description  = EXCLUDED.description,
  url          = EXCLUDED.url,
  updated_at   = now()
RETURNING (xmax = 0) AS "inserted!"
```

- `date_founded` ve `creator_id` update'e girmez (Node'daki yorum: hiç
  değişmezler). `date_founded` UTC instant'ı naive timestamp olarak bağlanır,
  alliance'taki gibi.
- **`home_station_id` ve `shares` da update'e girmez**, çünkü Node'un
  `update` bloğunda yoklar. Bu muhtemelen Node'daki bir eksiklik: ikisi de
  zamanla değişebilir. Davranış eşitliği için Rust da aynısını yapar
  (**benim kararım**); düzeltmesi ikisinde birlikte, ayrı bir değişiklik
  olarak yapılır.
- `created_at` veritabanı varsayılanına bırakılır.
- `xmax = 0`, Node'daki ayrı `findUnique` sorgusunun yerini alır.

### Kural değişikliği

`CLAUDE.md:439` bugün: _"Each worker is **self-contained** — no shared
runner."_ Önerilen metin (İngilizce, dosyanın dili):

> Each worker is **self-contained at runtime**: its own process, its own
> connection and pool, its own `QUEUE_NAME`, so one worker crashing,
> stopping or restarting never affects another. Rust workers share the
> consume loop as a library (`backend-rs/crates/runner`) compiled into each
> binary; that is shared code, not a shared process. Never run several
> workers inside one process.

Spike spec'indeki karar 1 (`2026-11-12-rust-worker-spike-design.md:260`)
silinmez; altına bu dokümana işaret eden bir "Güncelleme (2026-11-14)" notu
eklenir.

## Testler

| Neyi sabitler         | Nasıl                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mesaj parse           | Bugünkü `tests/parse.rs` mesaj vakaları `crates/runner/tests/`'e taşınır: ek alanlı gövde kabul, `entityId` eksikse hata.                                                                                                                                                                                                                                             |
| Çalıştırıcı akışı     | Gerçek RabbitMQ olmadan test edilebilen parçalar: başarı log satırının biçimi (`[n]` + `detail` + sonek), sayaçların başarı/hata/parse hatasında doğru artması, özet satırının yalnızca sessizlik + en az bir mesajdan sonra basılması (sanal saat, `tokio::time::pause`). Mesaj başına işleme, `Settle` trait'i üzerinden, `mq/tests/failure.rs`'teki test çiftiyle. |
| Alliance davranışı    | Mevcut testlerin bütün assertion'ları korunur: `tests/upsert.rs` ve `tests/parse.rs`'in ESI kısmı yerinde kalır, mesaj vakaları `crates/runner/tests/`'e taşınır ama değişmez.                                                                                                                                                                                        |
| Corporation ESI parse | Bütün alanlar var; isteğe bağlı her alan eksik → `None`; `date_founded` milisaniyeli, milisaniyesiz ve yok; `shares` 2³¹'den büyük; tanınmayan ek alan kabul.                                                                                                                                                                                                         |
| Corporation upsert    | `sqlx::test` + `fixtures/corporations.sql` (alliance fixture'ı gibi `pg_dump --schema-only` ile üretilir): insert; update'te değişen alanlar; eksik `alliance_id` / `faction_id` / `description` / `url` → `NULL`; `date_founded`, `creator_id`, `home_station_id`, `shares` update'te korunur; `updated_at` ilerler; `inserted` dönüşü doğru.                        |
| Kuyruk tanımı         | Mevcut `#[ignore]`'lu RabbitMQ testleri; yeni kuyruk adı için tekrar gerekmez, tanım ortak fonksiyondan geçer.                                                                                                                                                                                                                                                        |

## Doğrulama

1. `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`,
   `cargo test` (`backend-rs/`), `.sqlx/` yenilenmiş ve commit edilmiş.
2. Alliance worker'ı yerelde bir kez: `yarn queue:alliances` +
   `yarn worker:info:alliances:rs`; log ve özet satırları bugünküyle aynı
   biçimde, `0 errors`.
3. Corporation worker'ı yerelde, Node ile eşitlik: aynı sabit ID kümesi önce
   Node, sonra Rust worker'ına verilir, iki koşunun ardından `corporations`
   satırları (yazılan kolonlar, `created_at` / `updated_at` hariç) CSV olarak
   karşılaştırılır ve aynı olmalıdır. `queue:character-corporations` bir
   enrichment scripti (yalnızca eksik olanları kuyruğa koyar), ikinci koşuda
   boş döner; bu yüzden ID kümesi bu karşılaştırma için tek seferlik, commit
   edilmeyen bir yayınla verilir (bkz. _Builder'a kalanlar_).

   **Bu adımın kanıtladığı ve kanıtlamadığı (benim kararım).** İlk koşu
   satırları oluşturduğu için ikinci koşu yalnızca update yolundan geçer;
   yalnızca insert'te yazılan kolonlar (`date_founded`, `creator_id`,
   `home_station_id`, `shares`) ilk koşunun değerini taşır. Yani CSV eşitliği
   **update yolunun** eşitliğini kanıtlar. Insert yolu `sqlx::test`
   testleriyle (gerçek PostgreSQL, her alan ve her `NULL` durumu) ve ESI parse
   testleriyle sabitlenir. Satır silmek (`CLAUDE.md`, _Never lose rows_) ya
   da ayrı bir kopya veritabanı kurmak bu adım için gerekmez; alliance
   spike'ı da aynı sınırla, ısınma koşusundan sonra update yolunu
   karşılaştırdı. Sıra Rust→Node olarak da bir kez tekrarlanır, ki iki worker
   da update yolundan geçmiş olsun.

   İki koşu art arda, dakikalar içinde yapılır. `member_count`,
   `description`, `ceo_id` gibi değişebilen kolonlarda çıkan bir fark, alliance
   spike'ındaki kuralla ele alınır: o ID'yi worker'a tekrar işletip yeni
   değerin ESI'deki gerçek bir değişiklik olduğu doğrulanır.

4. Kapanış: worker işlerken Ctrl+C → yeni mesaj alınmaz, eldekiler biter,
   `worker stopped`; ack'lenmemiş mesaj kuyruğa döner.
5. Satır sayıları: `worker-info-corporations` kaynak ve test ayrı ayrı,
   `crates/runner` ayrıca. Bu dokümanın sonuna _Sonuçlar_ olarak eklenir.

## Builder'a kalanlar

- `runner` içindeki dosya bölümü (yukarıdaki dört dosya bir öneri) ve iç
  tiplerin adları.
- Çalıştırıcı testlerinin tam olarak hangi iç fonksiyonları dışa açacağı
  (`pub(crate)` + `#[cfg(test)]` ya da küçük `pub` yardımcılar).
- Doğrulama 3 için tek seferlik ID yayınının nasıl yapılacağı (örneğin
  `rabbitmqadmin publish` ya da geçici bir komut). Kalıcı bir script
  eklenmez.
- `.sqlx/`'in yenilenmesi için `sqlx-cli` kurulu değilse kurulumu.

## Sonuçlar (2026-11-14)

### Satır sayıları

`wc -l`, kaynak ve test ayrı.

| Parça                                    | Kaynak             | Test            |
| ---------------------------------------- | ------------------ | --------------- |
| `crates/runner`                          | 440 (6 dosya)      | 223 (2 dosya)   |
| `worker-info-alliances` (sonra)          | 122 (`main.rs` 46) | 217 (değişmedi) |
| `worker-info-corporations`               | 153 (`main.rs` 47) | 238             |
| Node `worker-info-corporations.ts`       | 216                | -               |
| `worker-info-alliances` `main.rs` (önce) | 286                | -               |

`worker-info-alliances`'in `main.rs`'i 286 satırdan 46'ya indi; consume
döngüsü, sayaçlar, yeniden bağlanma ve kapanış `crates/runner`'a taşındı.
Yeni bir worker artık yaklaşık 150 satır kaynak (ESI parse + upsert + 47
satırlık `main.rs`).

### Alliance koşusu (Task 2, Adım 5)

`yarn queue:alliances` ile 3640 alliance kuyruğa konup yeniden yazılan
worker'a işletildi; özet satırı bugünkü biçimle aynı:

```text
📊 final: 3640 processed (1 created, 3639 updated, 0 errors)
```

### Corporation eşitlik koşusu

500 ID (`SELECT id FROM corporations ORDER BY id LIMIT 500`, 1000001 -
98002160), her koşuda aynı küme, `esi_corporation_info_queue`'ya
`{"entityId": <id>, "source": "parity-check"}` gövdesiyle, `persistent`.
Koşular worker başlangıcından özet satırına kadar (5 s sessizlik dahil):

| Koşu    | Worker | Süre | Özet satırı                                        |
| ------- | ------ | ---- | -------------------------------------------------- |
| Çift 1a | Node   | 20 s | `500 processed (0 created, 500 updated, 0 errors)` |
| Çift 1b | Rust   | 20 s | `500 processed (0 created, 500 updated, 0 errors)` |
| Çift 2a | Rust   | 20 s | `500 processed (0 created, 500 updated, 0 errors)` |
| Çift 2b | Node   | 21 s | `500 processed (0 created, 500 updated, 0 errors)` |

CSV'ler her koşunun hemen ardından alındı (`created_at` / `updated_at`
hariç, brief'teki 14 kolon). `git diff --no-index`:

- **Rust→Node (`corporations-rs-2.csv` / `corporations-node-2.csv`): boş.**
- **Node→Rust (`corporations-node-1.csv` / `corporations-rs-1.csv`): 1
  satır, 1 kolon.** ID 1000172 (Pator Tech School), `member_count`: Node
  927441, Rust 927595.

Bulunan fark ve çözümü: 1000172, ID kümesinin Node ile Rust arasında kendi
kendine değişen bir NPC corporation'ı. Kural gereği ID Rust worker'ıyla
yeniden işletildi (`1 processed`, `0 errors`); DB'de 927595 kaldı ve ESI'nin
o anki yanıtı da `member_count: 927595`. Yani fark Rust'ın bir
davranışından değil, iki koşu arasında ESI'de gerçekten değişen değerden
geliyor. Aynı kaymayı Node koşuları arasında da (`node-1` ile `node-2`)
`1000009` (251099 → 251091), `1000172` ve `1000179` (27353 → 27365) üzerinde
görüyoruz; hepsi yalnızca `member_count`.

Hata satırı yok: dört koşunun hiçbirinde `0 errors` dışında bir hata çıktısı
yok. Ölçüm dosyaları (CSV, loglar, yayın scripti) repo dışında, geçici ölçüm
klasöründe; commit edilmedi.

Bir not: ilk denemede `node-1` CSV'si alınamadı (yerel Windows `psql`'e
`/c/...` biçiminde yol verilmişti), Rust koşusu CSV'den önce çalıştığı için
çift bozuldu. Çift baştan, doğru sırayla tekrarlandı; yukarıdaki sonuçlar
tekrar edilen koşulara ait.

### Bu doğrulamanın sınırı

Spec'te (_Doğrulama_ 3) belirtildiği gibi, ID'ler `corporations` tablosunda
zaten var olduğu için dört koşu da yalnızca **update yolunu** karşılaştırdı
(`0 created, 500 updated`). Insert yolu `sqlx::test` ve parse testleriyle
sabit.

### Kapanış (Ctrl+C / SIGTERM)

_Doğrulama_ 4 ajan kabuğundan **çalıştırılamadı**: yerel Windows
kabuğunda yerel `.exe`'ye `SIGINT` iletilemiyor, `taskkill` `/F` olmadan
reddediyor (Task 2'de de aynı). Worker'lar yalnızca `/F` ile durduruldu. Bu
kontrol kullanıcının elle yapacağı iş olarak **beklemede**: worker
işlerken Ctrl+C → `⚠️  shutting down...`, eldekiler biter, `worker stopped`;
ack'lenmemiş mesaj kuyruğa döner.
