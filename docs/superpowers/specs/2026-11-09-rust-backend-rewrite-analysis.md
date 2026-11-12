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
  Node süreci, `max_memory_restart: 512M`.
- Tek droplet: 4 vCPU / 8 GB, managed PostgreSQL **25 bağlantı** limiti
  (22'si kullanımda — `backend/docs/deployment/cost-comparison.md`).
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

1. **Bellek ve süreç sayısı.** 31 ayrı Node süreci, her biri V8 taban
   maliyetiyle (boşta ~50–80 MB) 8 GB'lık makinede ~2 GB civarı RSS tutuyor
   (tahmin; ölçülmedi). Rust worker'ları ~5–15 MB'dan başlar. Daha önemlisi,
   bütün worker'lar **tek bir binary içinde tokio task'ları** olarak
   çalışabilir.
2. **Tek `getStats()`, tek AIMD durumu.** Mevcut limiter zaten tek yerden
   kontrol ediliyor ve çok süreçli çalışmayı header'lar üzerinden doğru
   yönetiyor (spec §4.5). Tek binary'nin eklediği küçük: `ESI_MAX_RPS`
   taban tavanı bir kez tanımlanır, header'sız 429'da hız bir kez düşer ve
   istatistik tek yerden okunur. Bu bir yan kazanç, ana gerekçe değil;
   Node'da worker'lar tek sürece toplanınca da aynı şey olur.
3. **Tek bağlantı havuzu.** 25 bağlantılık limit 31 süreç × 2 yerine tek
   `PgPool` ile yönetilir. İki Prisma client ayrımı (`prisma` / `prisma-worker`)
   ve pool tükenmesi riski ortadan kalkar.
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
   `Date`/`Decimal` dönüşümleri, `updated_at` otomatikleri. Her biri elle
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

### B. Strangler: önce worker'lar, API sonra (önerilen)

Worker'lar yeniden yazmanın **en yüksek kazanç / en düşük risk** kısmı:

- Frontend sözleşmesine dokunmaz (GraphQL yok).
- Bellek ve süreç sorununun tamamı burada (31 sürecin 30'u worker).
- ESI limiter zaten tek yerde ve çok süreçli çalışmayı header'larla
  yönetiyor (spec §4.5); Rust portu aynı davranışı korur, yeni bir şey
  kazandırmaz.
- Dil-bağımsız sınırlar zaten var: RabbitMQ kuyrukları (JSON mesajlar),
  PostgreSQL, Redis pub/sub (`NEW_KILLMAIL` Node API'ye Rust worker'dan
  ulaşır).

Sıra:

1. `backend-rs/` Cargo workspace: `esi` crate (client + limiter portu,
   mevcut spec'e birebir, `rate-limiter.spec.ts` test vektörleri taşınır),
   `db` crate (`sqlx`, aynı `DATABASE_URL`), `mq` crate (`lapin`, aynı
   kuyruk adları ve `x-max-priority`).
2. İlk worker: `worker-redisq-stream` + `killmail-writer` portu. Tek yazıcı
   olduğu için en kritik ve en çok test edilmiş parça. Node worker ile
   **yan yana, farklı bir kuyruk/sequence ile gölge çalıştırılır**, DB
   çıktısı karşılaştırılır.
3. Sonra `info-*` worker'ları (ESI'den tek tablo upsert eden 10 worker,
   hepsi aynı kalıp — tek generic worker + tablo başına bir `impl`).
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
göstermek. Bu noktada elde üç ölçüm olur: Rust worker'ın RSS'i, Rust
limiter portunun ESI başlık istatistikleri (`getStats()` karşılığı, Node
limiter'ınkiyle karşılaştırılır) ve yazım farkları. Karar oradan devam eder.

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
- Gölge çalıştırma sırasında `NEW_KILLMAIL` iki kez yayınlanmasın diye
  Rust worker'da publish kapalı başlamalı (`killmail-writer.ts:14`'teki
  bayrağın karşılığı).
