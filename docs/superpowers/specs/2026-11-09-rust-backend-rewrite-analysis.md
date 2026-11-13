# Backend'i Rust ile yeniden yazma — analiz

Tarih: 2026-11-09

Bu belge bir tasarım değil, bir karar analizi. Soru şu: `backend/` (GraphQL Yoga +
Prisma + RabbitMQ worker'ları) Rust ile yeniden yazılmalı mı? Önce mevcut
backend'in boyutunu ve dışa bağımlılıklarını sayılarla koyuyor, sonra Rust
karşılıklarını eşliyor, artı ve eksileri listeliyor ve bir öneriyle bitiyor.

Sayıların tamamı 2026-11-09 tarihli `main` üzerinden alındı.

---

## 1. Yeniden yazılacak şeyin boyutu

### Kod hacmi

| Ne                                                 | Sayı                                  |
| -------------------------------------------------- | ------------------------------------- |
| Elle yazılmış TypeScript (spec ve generated hariç) | 34.123 satır                          |
| Test (74 spec dosyası)                             | 14.091 satır, 1.187 test, hepsi geçer |
| `resolvers/`                                       | 97 dosya, 8.295 satır                 |
| `services/`                                        | 82 dosya, 9.937 satır                 |
| `workers/`                                         | 46 dosya, 8.878 satır                 |
| `queues/`                                          | 31 dosya, 2.589 satır                 |
| `schemas/*.graphql`                                | 50 dosya, 2.356 satır                 |
| `plugins/`                                         | 5 Yoga/Envelop eklentisi, 481 satır   |
| `scripts/` + `populate-scripts/`                   | 10 + 8 script, ~1.450 satır           |
| Git geçmişi                                        | 948 commit, 2025-10-19 → 2026-11-05   |
| Katkı veren                                        | 1 kişi (894 commit) + renovate        |

Bu kod ~12,5 ayda tek kişi tarafından yazıldı. Yeniden yazma sırasında elde
hazır bir spec var (çalışan kod), bu yüzden sıfırdan daha hızlı gider; ama
Rust'ta aynı iş (serde struct'ları, hata enum'ları, explicit tipler) tipik
olarak 1,3–2× daha fazla satır tutar. Kabaca 45–65 bin satır Rust beklenmeli.

### Veritabanı yüzeyi

| Ne                                           | Sayı                                                     |
| -------------------------------------------- | -------------------------------------------------------- |
| Prisma modeli (`prisma/schema/*.prisma`)     | 44 (+1 enum)                                             |
| Prisma dışında elle yönetilen tablo          | 5 (`killmail_filters`, 3× `*_kill_stats`, `refresh_log`) |
| Migration                                    | 53 (hepsi düz SQL)                                       |
| Prisma ORM çağrısı (`findMany`, `upsert`, …) | 349 (102 dosya)                                          |
| `$queryRaw` / `$executeRaw`                  | 88 çağrı, 35 dosya                                       |
| `$transaction`                               | 4 yer; kritik olan `killmail-writer.ts:65`               |
| BigInt kolon (Decimal yok)                   | 11                                                       |

349 ORM çağrısının her biri Rust'ta ya elle yazılmış SQL'e ya da bir ORM
(sea-orm/diesel) çağrısına dönüşür. 88 `$queryRaw` zaten SQL olduğu için
en kolay taşınan kısım budur.

### GraphQL yüzeyi (frontend'in bağlı olduğu sözleşme)

| Ne                             | Sayı                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------- |
| GraphQL tipi                   | 128                                                                               |
| `Query` alanı                  | 121                                                                               |
| `Mutation` alanı               | 30                                                                                |
| `Subscription` (graphql-ws)    | 4: `newKillmail`, `sovereigntyAlert`, `workerStatusUpdates`, `activeUsersUpdates` |
| DataLoader                     | 39 (`services/dataloaders.ts`, 1.290 satır)                                       |
| Yoga eklentisi                 | cookies, depth-limit, disable-introspection, rate-limit, response-cache           |
| Frontend GraphQL dokümanı      | 78 (`frontend/src/graphql/`)                                                      |
| Frontend üretilmiş tip dosyası | 10.375 satır, kaynağı `backend/src/generated-schema.graphql`                      |

Frontend codegen (`frontend/codegen.ts:4`) backend'in ürettiği SDL dosyasını
okur. Rust tarafı aynı dosyayı **birebir aynı tiplerle** üretmek zorunda;
nullable farkı, scalar adı farkı (`Date`, `BigInt`, `JSON`), enum ve
description farkı frontend build'ini kırar.

### Dış dünya

| Bağımlılık            | Nerede                                                          | Not                                                                     |
| --------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| EVE ESI               | `esi-client.ts` (120 satır) + `rate-limiter.ts` (560)           | İki katmanlı adaptif limiter, header'lardan beslenir                    |
| zKillboard R2Z2 akışı | `worker-redisq-stream.ts` (726 satır)                           | 15 req/s IP limiti, 6 s 404 bekleme                                     |
| zKillboard API        | `zkillboard.ts`                                                 | Aynı uca 10 s ara                                                       |
| EVE SSO               | `eve-sso.ts`, `jose` ile JWKS doğrulama                         | Session cookie + kullanıcı token şifreleme                              |
| Discord webhook       | `services/discord-webhook/` (5 dosya) + worker                  |                                                                         |
| Fuzzwork fiyatları    | `services/market/`                                              |                                                                         |
| SDE (jsonl zip)       | `scripts/import-sde-*.ts`                                       |                                                                         |
| RabbitMQ              | 27 kuyruk, hepsi `x-max-priority: 10`                           | `lapin` ile aynı argüman verilebilir                                    |
| Redis                 | 33 dosya; cache + pub/sub (`NEW_KILLMAIL`, `SOVEREIGNTY_ALERT`) | Response-cache `KEYS` taraması yapıyor (`response-cache.plugin.ts:120`) |

### Çalışma zamanı ve altyapı

- `ecosystem.config.js`: **31 backend süreci** + 1 frontend. Her worker ayrı bir
  Node süreci, `max_memory_restart: 512M`. Ama bunların yalnızca **15'i
  sürekli çalışır**: API ve `autorestart: true` olan 14 worker. Kalan
  **16'sı** `cron_restart` ile tetiklenip işini bitirince çıkan işlerdir
  (`autorestart: false`: `queue-*`, `snapshot-*`, `update-*`, `worker-sov-*`,
  `worker-system-activity`). Sürekli bellek tutan backend süreci sayısı 31
  değil, 15'tir.
- Tek droplet: 4 vCPU / 8 GB, managed PostgreSQL **25 bağlantı** limiti
  (`backend/docs/deployment/cost-comparison.md:20`; CLAUDE.md 22 diyor, ikisi
  tek yerde uzlaştırılmalı). Aynı dokümandaki "22 kullanımda" hesabı
  (`cost-comparison.md:64`, "2×5 + 6×2") 6 worker varsayar ve eskidir.
  Bugünkü teorik üst sınır API `max: 5` (`prisma.ts:26`) + 14 sürekli
  worker × `max: 2` (`prisma-worker.ts:28`) = **33**, yani limitin üstünde;
  pratikte `allowExitOnIdle: true` boşta bağlantıları bıraktığı için sığıyor.
- ESI erişimi tek yerde: her çağrı `esiClient` üzerinden tek bir header
  güdümlü limiter'dan geçer (PR #297, spec
  `2026-10-28-esi-rate-limiter-design.md`). Limiter süreç başına çalışır,
  ama ESI'nin bucket ve error-limit header'ları IP genelindeki ortak
  harcamayı gösterdiği için süreçler birbirini her yanıtta görür (spec
  §4.5). Süreç başına kalan yalnızca `ESI_MAX_RPS` taban tavanı, header'sız
  429'daki AIMD durumu ve `getStats()` çıktısı.
- Node 24, TypeScript 5.9, Yoga 5.21, Prisma 7 (`adapter-pg`), Vitest 5.

---

## 2. Rust karşılıkları

| Bugün                                           | Rust'ta                                                      | Boşluk var mı?                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| graphql-yoga + graphql-tools                    | `async-graphql` (+ `axum`)                                   | Hayır. Code-first; `schema.sdl()` ile SDL dosyası üretilir, frontend codegen değişmeden kalır.  |
| graphql-ws subscription                         | `async-graphql` WS protokolü (graphql-ws destekli)           | Hayır.                                                                                          |
| `dataloader`                                    | `async-graphql::dataloader`                                  | Hayır; 39 loader yeniden yazılır.                                                               |
| depth-limit, disable-introspection eklentisi    | `limit_depth()`, `disable_introspection()` yerleşik          | Hayır, daha az kod.                                                                             |
| rate-limit eklentisi                            | `tower-governor`                                             | Hayır.                                                                                          |
| **response-cache (Redis, entity invalidation)** | Hazır eşdeğer **yok**                                        | **Evet.** Query+variables+session hash'i, TTL per-coordinate, entity invalidation elle yazılır. |
| Prisma Client                                   | `sqlx` (derleme zamanı kontrollü SQL) veya `sea-orm`         | Kısmen. ORM kolaylığı kaybolur; `sea-orm-cli generate entity` 45 modeli DB'den üretebilir.      |
| Prisma Migrate                                  | `sqlx migrate` / `refinery`                                  | Hayır; migration'lar zaten düz SQL. Geçişte baseline gerekir.                                   |
| Prisma Studio                                   | Yok (pgAdmin / TablePlus / psql)                             | Küçük.                                                                                          |
| amqplib                                         | `lapin`                                                      | Hayır.                                                                                          |
| ioredis                                         | `redis` veya `fred`                                          | Hayır; pub/sub destekli.                                                                        |
| axios                                           | `reqwest` (rustls)                                           | Hayır.                                                                                          |
| rate-limiter.ts (560 satır)                     | Elle port (`governor` yetmez: header güdümlü adaptif mantık) | Hayır ama birebir port gerekir; spec'i `2026-10-28-esi-rate-limiter-design.md`.                 |
| jose (JWKS)                                     | `jsonwebtoken` + JWKS fetch, veya `jwt-authorizer`           | Hayır.                                                                                          |
| winston                                         | `tracing` + `tracing-subscriber`                             | Hayır, daha iyi.                                                                                |
| zod (1 dosya)                                   | `serde` + `validator`                                        | Hayır.                                                                                          |
| tsx + nodemon dev döngüsü                       | `cargo watch -x run`                                         | Yavaşlar: cold build 3–6 dk, incremental 10–40 s.                                               |
| vitest (1.187 test)                             | `#[tokio::test]` + `sqlx::test` / testcontainers             | Prisma mock'ları doğrudan taşınmaz; DB'ye bağlı testler gerçek Postgres ister.                  |
| PM2 `yarn worker:x`                             | PM2 binary çalıştırabilir, ya da systemd                     | Hayır.                                                                                          |
| SVG harita render scriptleri                    | `std::fs` + string şablonu                                   | Hayır; ya da Node'da bırakılır.                                                                 |

---

## 3. Artılar

### Gerçekten kazandıranlar

1. **Bellek ve süreç sayısı.** Sürekli çalışan 15 backend Node süreci (bkz.
   §1, çalışma zamanı), her biri V8 taban maliyetiyle (boşta ~50–80 MB)
   aynı anda ~0,75–1,2 GB RSS tutuyor; cron işleri çalıştıkları birkaç dakika
   boyunca buna eklenir (tahmin; ölçülmedi). Rust worker'ları ~5–15 MB'dan
   başlar. Bütün worker'lar **tek bir binary içinde tokio task'ları** olarak
   da çalışabilir; ama bu, "her worker self-contained" kuralıyla ilişkisi
   §5.B'de karara bağlanması gereken bir tasarım tercihidir, bedava bir
   kazanç değil.
2. **Tek `getStats()`, tek AIMD durumu.** Mevcut limiter zaten tek yerden
   kontrol ediliyor ve çok süreçli çalışmayı header'lar üzerinden doğru
   yönetiyor (spec §4.5). Tek binary'nin eklediği küçük: `ESI_MAX_RPS`
   taban tavanı bir kez tanımlanır, header'sız 429'da hız bir kez düşer ve
   istatistik tek yerden okunur. Bu bir yan kazanç, ana gerekçe değil;
   Node'da worker'lar tek sürece toplanınca da aynı şey olur.
3. **Tek bağlantı havuzu.** 25 bağlantılık limit, teorik üst sınırı 33 olan
   (5 + 14 × 2, bkz. §1) süreç başına havuzlar yerine tek `PgPool` ile
   yönetilir. İki Prisma client ayrımı (`prisma` / `prisma-worker`) ve pool
   tükenmesi riski ortadan kalkar. Bugün limitin altında kalmak
   `allowExitOnIdle`'a bağlı, garanti değil; bu madde ilk yazıldığından
   daha güçlü bir gerekçe.
4. **`prisma migrate dev` tehlikesi biter.** CLAUDE.md'nin ilk kuralı olan
   "5 tablo drift olarak görünüyor, 72.790 satır silinir" problemi şema
   diff'i yapan bir araç olmayınca var olmaz. `sqlx migrate` sadece sıradaki
   SQL'i uygular.
5. **`$queryRaw` kodu daha temiz olur.** 88 ham sorgu `sqlx::query!` ile
   derleme zamanında kolon adı ve tip kontrolünden geçer (`system_id` vs `id`
   hatası derlemede yakalanır). `BigInt → Number()` dönüşümü ve
   `JSON.stringify` BigInt hatası sınıfı yok olur.
6. **ESI yanıtları için gerçek tipler.** `?? []` / `?? null` okunan alanlar
   `Option<Vec<_>>` olur; shape drift derlemede görünür, `any` yok.
7. **Deploy.** Backend için droplet'te `node_modules` yok, tek statik binary.
   Yeniden başlatma milisaniye.
8. **Yerleşik güvenlik eklentileri.** depth-limit ve introspection kapatma
   `async-graphql`'de bir satır; bugün 150 satır eklenti + 340 satır test.

### Daha küçük kazançlar

- `tracing` ile yapılandırılmış log ve span'ler winston'dan iyi.
- Veri işleme kısımları (killmail değer hesabı, fitting slot sınıflandırma,
  SDE jsonl import, SVG harita üretimi) CPU-bound ve Rust'ta belirgin hızlanır.
- Renovate'in haftalık bağımlılık PR yükü düşer (Cargo ekosistemi daha az
  sık, daha az kırıcı).

---

## 4. Eksiler

### Asıl maliyet: zaman ve özellik dondurma

1. **Süre.** 34 bin satır + 14 bin satır test, tek kişi. Elde spec olduğu
   için 12,5 ay değil, ama parite için gerçekçi tahmin **3–6 ay tam zamanlı
   eşdeğeri**. Bu süre boyunca ya özellik geliştirme durur ya da iki backend
   birden bakılır. Son beş PR'ın hepsi yeni özellik (tracker, Discord, OG
   kartları); bu tempo kesilir.
2. **İkinci sistem riski.** Yeniden yazım sırasında "madem yazıyoruz şunu da
   düzeltelim" çekimi güçlüdür. CLAUDE.md'nin "uniformity beats the local
   optimum" kuralı tam da bunu yasaklıyor; Rust'ta da geçerli kalmalı.
3. **349 ORM çağrısının örtük davranışı.** Prisma `upsert`, ilişki yükleme,
   `Date` ve `BigInt` dönüşümleri, `updated_at` otomatikleri. Her biri elle
   yeniden ifade edilir ve her biri bir veri hatası fırsatıdır. En riskli
   nokta `killmail-writer.ts`: transaction + `ON CONFLICT` istatistikleri +
   filtreler + pub/sub, 7 worker'ın tek yazıcıya indirgendiği yer (#244).

### Performans kazancı sanıldığı kadar büyük değil

4. **Darboğaz CPU değil.** API yolu `redis.get → $queryRaw → redis.setex`;
   gecikme PostgreSQL'de. Ingest yolu dış servislerin limitiyle sınırlı: ESI
   adaptif, R2Z2 15 req/s, zKillboard 10 s/çağrı. Rust bu limitleri
   değiştirmez. Throughput kazancı sadece CPU-bound parçalarda görünür
   (bkz. artılar, küçük kazançlar). Ana kazanç **bellek ve işletim**, hız
   değil; bunu bilerek karar vermek gerekir.

### Ekosistem boşlukları

5. **Response cache.** `@envelop/response-cache` + Redis + entity bazlı
   invalidation'ın hazır Rust karşılığı yok. Elle yazılır: operation
   hash'i, `PUBLIC_CACHE_QUERIES` ayrımı, koordinat bazlı TTL, invalidation.
   Bugünkü `KEYS` taraması zaten sorunlu (CLAUDE.md, Redis bölümü); yeniden
   yazarken `SCAN` veya tag set'leri ile düzeltilebilir, ama bu da iş.
6. **Prisma Studio ve Prisma'nın ergonomisi** gider. `sea-orm` kısmen
   doldurur, `sqlx` hiç doldurmaz (her sorgu elle).
7. **Test altyapısı.** Vitest'te Prisma mock'lanıyor. Rust'ta ya trait
   soyutlaması (daha çok kod) ya da gerçek Postgres (`sqlx::test`,
   testcontainers; CI'da Postgres servisi). 1.187 testin önemli kısmı saf
   mantık (rate limiter, item classifier, fitting, değer hesabı) ve kolay
   taşınır; DB'ye değen kısım zordur.

### Geliştirme döngüsü ve araçlar

8. **Derleme süresi.** `async-graphql` + `sqlx` + `tokio` cold build dakikalar
   sürer; `tsx` ile anında yeniden başlayan dev döngüsü 10–40 s'ye çıkar.
   Windows'ta `sqlx` derleme zamanı kontrolü DB'ye erişim ister (veya
   `cargo sqlx prepare` ile offline mod, `.sqlx/` dizini commit edilir).
9. **Monorepo çok dilli olur.** Yarn workspaces + Cargo workspace. CI'a
   `cargo test`, `cargo clippy`, `cargo fmt --check` ve Linux hedefi için
   cross-build eklenir. Frontend hâlâ Node ister; Node droplet'ten gitmez.
10. **GraphQL sözleşmesi birebir tutulmalı.** 78 frontend dokümanı ve
    10.375 satırlık üretilmiş tip, SDL'deki en küçük farkta kırılır.
    Scalar adları (`Date`, `BigInt`), description'lar, nullable'lar
    `async-graphql` attribute'larıyla elle eşlenir. Bir "SDL diff" CI
    kontrolü şart olur.
11. **Migration geçişi.** 53 Prisma migration'ı ve `_prisma_migrations`
    tablosu var. `sqlx migrate`'e geçerken baseline alınır; geçiş süresince
    iki araç birden çalışır.

### Dil sınırında korunması gereken sözleşmeler

Strangler'ın "dil-bağımsız sınırlar zaten var" varsayımı (§5.B) doğru, ama
bu sınırlar kuyruk adlarından ibaret değil. Rust tarafı aşağıdakileri
birebir korumak zorunda; her biri yazılı bir sözleşme ve bir test ister.

12. **Worker güvenilirlik sözleşmesi.** Spec:
    `2026-09-20-worker-reliability-contract-design.md`. Retry topolojisi
    `queue-names.ts:66` (`RETRY_TOPOLOGY`) ve `rabbitmq.ts:124-166`'da:
    `killreport.dlx` (fanout), `killreport.retry` (direct),
    `killreport.wait` (30 s TTL, tüketicisiz), `killreport.parking`; her
    uygulama kuyruğu retry exchange'ine kendi adıyla bağlanır. Deneme sayısı
    `x-death` başlığından okunur (`worker-error.ts:27`), throttle'da
    deneme harcamadan requeue, 404'te uyar-geç, aksi halde
    `nack(requeue: false)` ile DLX yolu (`worker-error.ts:204`). Dead-letter
    bağlantısı bir kuyruk argümanı değil, bir RabbitMQ **policy**'sidir
    (`backend/docs/ops/rabbitmq.md:11-44`): Rust `assertQueue` karşılığı da
    `x-dead-letter-exchange` **vermemeli**, yoksa 406
    `PRECONDITION_FAILED` alır. "Aynı kuyruk adları ve `x-max-priority`"
    (§5.B adım 1) bu yüzden eksik bir tanım.
13. **Redis pub/sub zarfı.** API `@graphql-yoga/redis-event-target` ile
    abone oluyor (`pubsub.ts:1`, `PubSubChannels` `pubsub.ts:10`). Rust
    worker'ın `NEW_KILLMAIL` / `SOVEREIGNTY_ALERT` yayını, bu kütüphanenin
    beklediği kanal adı ve JSON zarfıyla birebir aynı olmalı. Node'un
    yayınladığı mesajı yakalayıp Rust'ın ürettiğiyle karşılaştıran bir
    sözleşme testi gerekir. Redis yokken kullanılan in-memory fallback
    (`pubsub.ts:28`) dil sınırını geçemez; Rust worker'lı kurulumda Redis
    zorunlu hale gelir.
14. **Zamanlama.** 16 PM2 girdisi `cron_restart` ile zamanlanıyor (§1).
    PM2'nin birimi süreçtir: worker'lar tek binary'de task olursa PM2 tek
    bir işi yeniden başlatamaz, `max_memory_restart` da tek bir worker'ı
    değil hepsini birden düşürür. Cron işlerinin nereye taşınacağı (ayrı
    alt komut + PM2 `cron_restart`, OS crontab, binary içi zamanlayıcı)
    açıkça seçilmeli. OS crontab'daki işler (`backend/docs/ops/crontab.md`)
    de bu karara dahil.

---

## 5. Üç yol

### A. Yeniden yazma; Node'da düzelt

Bugünkü iki gerçek acı (süreç sayısı/bellek ve PostgreSQL bağlantı sayısı)
Node'da da çözülür: worker'ları tek bir süreçte çalışan tek bir "worker
host"ta toplamak ve tek Prisma pool paylaştırmak. ESI limiter zaten tek
yerde ve çok süreçli çalışmayı header'larla yönetiyor; bu adım onu
değiştirmez. Birkaç hafta
iş, sıfır sözleşme riski. Dezavantaj: Node'un taban belleği kalır, Rust'ın
tip güvenliği gelmez.

Rust worker denemesinin Linux ön karşılaştırması (2026-11-13,
`2026-11-12-rust-worker-spike-design.md`, _Ön karşılaştırma_) A yoluna iki
kalem daha ekledi; ikisi de Rust kararından bağımsız ve küçük:

- **Worker'ları `yarn` ve `tsx` üzerinden değil, doğrudan `node` ile
  başlatmak.** `yarn workspace backend worker:info:alliances` ile başlayan
  alliance worker'ı dört Node süreci olarak çalıştı: corepack'in `yarn`
  kısayolu, `yarn`, `tsx` ve asıl worker. Süreç grubunun en yüksek RSS'i
  ~508 MB, worker'ın kendisi ~235 MB; aradaki ~270 MB worker'ı başlatan
  süreçlerin. Canlıda PM2 worker'ları `script: 'yarn'` ile başlatıyor
  (`ecosystem.config.js`), orada süreç sayısı 3 ya da 4; aşama 2'de `pm2 ls`
  ile doğrulanacak. İki seçenek var. Daha küçüğü PM2'nin `yarn` yerine `node --import tsx
src/workers/....ts` çalıştırması: `yarn` süreçleri gider, `tsx` worker
  sürecinin içinde yüklenir. Daha büyüğü derlenmiş JavaScript'i doğrudan
  `node` ile çalıştırmak; ama backend bugün JavaScript üretmiyor (`build` ve
  `typecheck` ikisi de `tsc --noEmit`, `start` de `tsx` ile), yani bu yeni bir
  derleme adımı demek. Ölçüm Linux'ta, tek worker
  üzerinde yapıldı; 14 sürekli worker için toplamı canlıda ölçülmeli.
  Ölçülen değerler §3.1'deki tahminden (süreç başına boşta 50–80 MB) de
  yüksek: worker süreci boşta 142 MB tuttu.
- **Worker'ların kullanmadıkları servisleri yüklememesi.**
  `worker-info-alliances.ts`, `AllianceService`'i `@services/alliance`'tan
  alıyor; o dosya `alliance-stats.service`'i de dışa aktarıyor
  (`services/alliance/index.ts`), o da API'nin `@services/prisma` havuzunu
  (`max: 5, min: 1`) ve `@services/redis`'i yüklüyor. Sonuç: worker açılışta
  API havuzunu kuruyor ve hiç kullanmadığı bir Redis bağlantısı açıyor (log:
  "Redis cache connected"). API havuzunun bir PostgreSQL bağlantısını da açık
  tutup tutmadığı doğrulanmadı; `pg.Pool` normalde ilk sorguda bağlanır. Çözüm
  worker'ın `@services/alliance/alliance.service`'i doğrudan içe aktarması. Diğer worker'larda
  aynı kalıbın olup olmadığına bakılmadı.

### B. Strangler: önce worker'lar, API sonra (önerilen)

Worker'lar yeniden yazmanın **en yüksek kazanç / en düşük risk** kısmı:

- Frontend sözleşmesine dokunmaz (GraphQL yok).
- Bellek ve süreç sorununun neredeyse tamamı burada: sürekli çalışan 15
  backend sürecinin 14'ü ve cron ile çalışan 16 işin tamamı worker veya
  kuyruk scripti (§1).
- ESI limiter zaten tek yerde ve çok süreçli çalışmayı header'larla
  yönetiyor (spec §4.5); Rust portu aynı davranışı korur, yeni bir şey
  kazandırmaz.
- Dil-bağımsız sınırlar zaten var: RabbitMQ kuyrukları (JSON mesajlar),
  PostgreSQL, Redis pub/sub (`NEW_KILLMAIL` Node API'ye Rust worker'dan
  ulaşır). Ama bu sınırların her biri yazılı bir sözleşme gerektirir:
  bkz. §4, madde 12–14.

Sıra:

1. `backend-rs/` Cargo workspace: `esi` crate (client + limiter portu,
   mevcut spec'e birebir, `rate-limiter.spec.ts` test vektörleri taşınır),
   `db` crate (`sqlx`, aynı `DATABASE_URL`), `mq` crate (`lapin`, aynı
   kuyruk adları, `x-max-priority` ve §4 madde 12'deki retry sözleşmesi;
   `worker-error.spec.ts` vakaları taşınır).
2. İlk worker: `worker-redisq-stream` + `killmail-writer` portu. Tek yazıcı
   olduğu için en kritik ve en çok test edilmiş parça. Node worker ile
   yan yana **gölge** çalıştırılır. Gölge modun üç kısıtı var:
   - **Ayrı hedef veritabanı.** Aynı veritabanında karşılaştırma
     yapılamaz: `saveKillmail` önce `findUnique` ile bakar
     (`killmail-writer.ts:45-49`), çakışmada P2002'yi `false` olarak
     yutar (`killmail-writer.ts:150`). İki yazıcıdan hangisi önce kaparsa
     o yazar, diğeri sessizce atlar; karşılaştırılacak ikinci çıktı oluşmaz.
     Gölge yazıcı ayrı bir veritabanına (veya ayrı bir şemaya) yazmalı,
     karşılaştırma `killmail_id` üzerinden satır satır yapılmalı. Hedefte
     `*_kill_stats` ve `killmail_filters` de bulunmalı, çünkü yazım yolunun
     en kırılgan kısmı onlar (`kill-stats-realtime.ts:65-90`).
   - **R2Z2 bütçesi paylaşılır.** Limit IP başına 15 req/s ve aşımı 403
     (`worker-redisq-stream.ts:22`). İki poller aynı droplet'ten aynı
     bütçeyi harcar. Ya her biri bütçenin yarısıyla sınırlanmalı, ya da
     Rust gölgesi R2Z2'yi değil, Node'un çektiği payload'ları okumalı (ör.
     Node'un ayrıca yayınladığı bir gölge kuyruğu). İkincisi limiti hiç
     zorlamaz ve iki yazıcıya birebir aynı girdiyi verir; karşılaştırma
     için daha temiz.
   - **Yan etkiler kapalı.** `publish` bayrağı (`killmail-writer.ts:14`)
     iki şeyi birden yönetir: `NEW_KILLMAIL` pub/sub yayını ve
     `discord_webhook_queue` mesajı (`killmail-writer.ts:140-145`). Gölge
     yazıcıda ikisi de kapalı olmalı; yoksa her kill Discord'a iki kez
     düşer.
3. Sonra `info-*` worker'ları (ESI'den tek tablo upsert eden 10 worker).
   Hepsi aynı kalıpta olduğu için "tek generic worker + tablo başına bir
   `impl`" cazip, ama CLAUDE.md bunu açıkça yasaklıyor: "Each worker is
   **self-contained** — no shared runner" ve "uniformity beats the local
   optimum". Bu ya Rust için bilinçli olarak değiştirilen bir kural olarak
   bu dokümanda ve CLAUDE.md'de kayda geçmeli, ya da Rust worker'ları da
   birer bağımsız worker olarak yazılmalı (paylaşılan şey yalnızca `esi`,
   `db`, `mq` crate'leri). Aynı soru §3.1'deki "tek binary, tokio task'ları"
   fikri için de geçerli.
4. Kalan worker'lar. Her adımda PM2'den bir Node süreci düşer.
5. API en son ve **ayrı bir karar**: worker'lar bittiğinde Node API'de kalan
   sorun sadece Prisma hazard'ı olur; o da API'yi taşımadan çözülebilir
   (5 tabloyu Prisma şemasına eklemek, CLAUDE.md'de zaten önerili).

### C. Tam yeniden yazma

Sadece B'nin 1–4. adımları bittikten ve ölçümler (bellek, ESI bütçe
kullanımı, hata oranı) kazancı gösterdikten sonra düşünülmeli. API'nin
taşınması en çok iş (121 query, 39 loader, response cache) ve en az kazanç
(I/O-bound) olan parça.

---

## 6. Öneri

Tam yeniden yazmaya **şimdi** girilmemeli. Worker katmanıyla başlayan
strangler (B) başlatılmalı; ilk kilometre taşı `worker-redisq-stream` +
`killmail-writer` portunun gölge modda Node ile aynı satırları yazdığını
göstermek (ayrı hedef veritabanında, bkz. §5.B adım 2). Bu noktada elde üç
ölçüm olur: Rust worker'ın RSS'i, Rust limiter portunun ESI başlık
istatistikleri (`getStats()` karşılığı, Node limiter'ınkiyle karşılaştırılır)
ve yazım farkları. Karar oradan devam eder.

Ölçümlerin bir karar üretmesi için iki şey önceden sabitlenmeli:

- **Taban çizgisi A yolu olmalı, bugünkü durum değil.** Rust'ın getirdiği
  bellek kazancı, Node worker'larının tek bir süreçte toplandığı hale
  karşı ölçülmeli; yoksa ölçüm Rust'ı değil süreç sayısını ödüllendirir.
  Sıra bu yüzden: önce A (Node worker host), RSS ve bağlantı sayısı
  ölçülür; sonra B'nin ilk adımı.
- **Eşik.** Gölge mod başlamadan şu yazılmalı: aynı iş yükünde RSS'te ne
  kadar düşüş (ör. A'ya göre en az %X) ve kaç günlük sıfır yazım farkı C
  yolunu haklı çıkarır, ne kadarının altı B'yi orada durdurur. Eşiksiz bir
  ölçüm sonradan her iki yöne de okunabilir.

Rust'tan bağımsız, hemen yapılabilecekler:

- 5 elle yönetilen tabloyu `prisma/schema/`'ya almak (hazard'ı Node'da bitirir).
- Response-cache invalidation'daki `KEYS` taramasını `SCAN`'e çevirmek.
- Worker'ları tek Node sürecinde toplamak (A yolu), bellek ve bağlantı
  sayısı için; B'ye geçilse bile bu ölçüm için iyi bir taban çizgisi verir.

## 7. Açık sorular

- Hedef platform: droplet x86_64 Linux. Geliştirme Windows. Cross-build CI'da
  mı, droplet'te `cargo build --release` mi?
- `sqlx` mi `sea-orm` mu? 88 ham sorgu ve 349 ORM çağrısı dağılımı
  `sqlx`'i işaret ediyor; `sea-orm` ORM kolaylığı verir ama ikinci bir
  şema tanımı demektir.
- Tek binary + alt komut (`killreport-worker redisq`, `killreport-worker
info-characters`) mi, worker başına binary mi? PM2 ile uyum için alt
  komut daha pratik.
- Gölge çalıştırma sırasında `NEW_KILLMAIL` ve Discord mesajı iki kez
  gitmesin diye Rust worker'da publish kapalı başlamalı
  (`killmail-writer.ts:14`'teki bayrağın karşılığı, bkz. §5.B adım 2).
- Gölge hedefi: ayrı bir PostgreSQL veritabanı mı, aynı sunucuda ayrı bir
  şema mı? Managed PostgreSQL'in 25 bağlantı limiti ikisinde de paylaşılır.
- Gölge girdisi: Rust da R2Z2'yi mi poll edecek (bütçe yarıya bölünür), yoksa
  Node'un aldığı payload'ları bir gölge kuyruğundan mı okuyacak?
- Cron işleri tek binary'de nerede yaşayacak (§4 madde 14)?
- "Self-contained worker" kuralı Rust için değişiyor mu (§5.B adım 3)?
- Bağlantı limiti 25 mi, 22 mi? `cost-comparison.md` ile CLAUDE.md
  uzlaştırılmalı.
- **Süreç yöneticisi: PM2 mi, systemd mi?** Rust'tan bağımsız bir karar ve
  droplet yeniden kurulurken değerlendirilecek; çalışan bir sistemde sonradan
  değiştirmekten o an çok daha ucuz. Rust worker'larının PM2'ye ihtiyacı yok,
  systemd de Node süreçlerini çalıştırabildiği için seçim "hepsi PM2" ile
  "hepsi systemd" arasında. Worker'ların systemd'de, API ve frontend'in
  PM2'de olduğu bir ara dönem iki yönetici, iki log yeri ve iki zamanlama
  mekanizması demek; geçilecekse API, frontend ve worker'lar birlikte geçer.
  systemd'nin getirisi bellek değil (PM2 tek bir daemon, birkaç on MB):
  `MemoryMax=` ile cgroup tabanlı sert bellek sınırı (PM2'nin
  `max_memory_restart`'ı sonradan kontrol eder), kaçırılan çalıştırmayı
  telafi eden timer'lar (`Persistent=true`; `cron_restart` bunu yapmaz),
  journald ile log rotasyonu ve işletimde Node bağımlılığının kalkması.
  Bedeli: 31 PM2 girdisinin unit'e, 16 `cron_restart` işinin timer'a
  çevrilmesi, `backend/docs/ops/pm2.md` ve `crontab.md`'nin yeniden
  yazılması, `pm2 ls` / `pm2 monit` yerine `systemctl` / `journalctl`. Rust
  worker denemesinin aşama 2'si bilerek PM2'de kalır: ölçülen tek değişiklik
  Node'dan Rust'a geçiş olsun ve geri dönüş tek komut kalsın
  (`2026-11-12-rust-worker-spike-design.md`, _Aşama 2_).
