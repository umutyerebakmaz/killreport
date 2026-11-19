# Rust `prices` Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `queue:prices` ve `worker:prices`'ın Rust karşılıklarını eklemek,
Jita 4-4'e süzülmüş, bütün sayfaları okuyan, emir yoksa satıra dokunmayan
fiyatı hem Rust'ta hem Node'da uygulamak.

**Architecture:** `queue-prices`, `queue-killmail-types`'ın kopyası: tek
`UNION` + `EXISTS` sorgusu, `mq::publish_entities`. `worker-prices`,
`worker-info-types`'ın kopyası: `runner::Worker`, `esi.get_paged` ile emirler,
saf `jita_price`, `market_prices` upsert'i. Paylaşılan crate'lerde iki değişiklik:
`get_paged` query'li path ve `runner::Outcome::Unchanged`. Node tarafı aynı
kuralları `MarketService`'te uygular.

**Tech Stack:** Rust (sqlx 0.8, lapin 2, wiremock, `runner`/`mq`/`esi`/`db`),
TypeScript (Prisma `$queryRaw`, amqplib, vitest).

**Spec:** `docs/superpowers/specs/2026-11-19-rust-prices-design.md`

## Global Constraints

- Kuyruk `esi_type_price_queue`, `source` `queue-prices`, öncelik yok, mesaj
  `{ entityId, queuedAt, source }`, `persistent`.
- Jita 4-4: `location_id = 60003760`, bölge `10000002`.
- Jita emri yoksa `market_prices` satırına dokunulmaz.
- `sell` ve `buy` = hacme göre %5'lik dilimin hacim ağırlıklı ortalaması
  (sell artan, buy azalan fiyat sırasıyla; hedef = o tarafın toplam
  `volume_remain`'inin %5'i, son emirden yalnız eksik kalan kadar; spec
  "Hedefler / 2"). Taraf boşsa 0. `average = (buy + sell) / 2`,
  `volume = Σ volume_remain` (bütün Jita emirleri).
- Rust'ta `sqlx::query!` makrosu değil `sqlx::query` / `query_scalar`
  fonksiyonları: CI `SQLX_OFFLINE=true` derliyor, `.sqlx` cache'i
  güncellenmez.
- `updated_at` insert'te de `now()`; `created_at` veritabanı default'u.
- systemd unit'leri değişmez, Node dosyaları silinmez.
- Yarn, asla npm. Commit mesajları İngilizce, Claude atfı yok.

## Review Focus

1. **Çok sayfalı emir listesi**, Jita emri yalnızca 2. sayfada → fiyat ondan
   hesaplanmalı. Task 1 (`get_paged`) ve Task 4/5 handle testleri.
2. **Sadece başka istasyonlarda emir var** → `None` / `null`, satır eski
   değerini korur. Task 4 `other_stations_only_leaves_the_row`, Task 5 aynısı.
3. **Bir structure'ın `location_id`'si `i32`'ye sığmaz** (1e12 civarı) →
   parse patlamamalı. Task 4 parse testi `location_id: 1_035_466_617_946`.
4. **ESI 5xx** → mesaj "no orders" diye ack'lenmemeli, hata yoluna gitmeli.
   Task 4 `esi_error_is_an_error`, Task 5 `getJitaPrice` reject testi.
5. **`types`'ta olmayan type ID** → kuyruğa girmemeli. Task 3
   `unknown_types_are_skipped`.

---

### Task 1: `get_paged` query'li path'i kabul eder

**Files:**

- Modify: `backend-rs/crates/esi/src/client.rs:131-147`
- Test: `backend-rs/crates/esi/tests/paged.rs`

**Interfaces:**

- Produces: `EsiClient::get_paged<T>(&self, path: &str)`; `path` `?` içeriyorsa
  sayfa `&page=N`, içermiyorsa `?page=N` olarak eklenir. İmza değişmez.

- [ ] **Step 1: Failing test** — `paged.rs`'e
      `a_path_with_a_query_gets_its_page_with_an_ampersand`: mock
      `/markets/10000002/orders/` için `query_param("type_id", "34")` ve
      `query_param("page", "1")` → `X-Pages: 2`, body `[1]`; `page=2` → `[2]`.
      `get_paged::<i32>("/markets/10000002/orders/?type_id=34")` → `vec![1, 2]`.
- [ ] **Step 2: Çalıştır, FAIL** — `cd backend-rs && cargo test -p esi --test paged`
      Expected: yeni test FAIL (istek `?type_id=34?page=1`).
- [ ] **Step 3: Uygula** — ayırıcı `if path.contains('?') { '&' } else { '?' }`;
      doc yorumu "`path` carries no query string" cümlesini güncelle.
- [ ] **Step 4: Çalıştır, PASS** — aynı komut, bütün `paged` testleri PASS.
- [ ] **Step 5: Commit** — `feat(esi): get_paged accepts a path with a query string`

### Task 2: `runner::Outcome::Unchanged`

**Files:**

- Modify: `backend-rs/crates/runner/src/lib.rs:25-82`,
  `backend-rs/crates/runner/src/process.rs:55-60`,
  `backend-rs/crates/runner/src/totals.rs`
- Test: `lib.rs`/`totals.rs` içindeki mevcut `#[cfg(test)]` modülleri (yoksa
  `lib.rs`'e ekle)

**Interfaces:**

- Produces: `Outcome::Unchanged` ("the worker looked and left the row as it
  was"); `Totals::unchanged() -> u64`; `success_line` →
  `"  - [{n}]{detail}"`; varsayılan `Worker::summary`, `unchanged() > 0`
  olduğunda `"📊 final: {p} processed ({c} created, {u} updated, {s} unchanged, {e} errors)"`,
  sıfırken bugünkü satırın aynısı.

- [ ] **Step 1: Failing testler** —
      `unchanged_line_has_a_dash`: `success_line(3, &Processed { outcome: Outcome::Unchanged, detail: " 34 (no Jita orders)".into() })`
      == `"  - [3] 34 (no Jita orders)"`.
      `summary_mentions_unchanged_only_when_there_are_some`: sıfırken string
      `"unchanged"` içermez; bir `Unchanged` sayıldıktan sonra
      `"1 unchanged"` içerir. (`Totals`'ın `pub(crate)` sayaçları crate içi
      testten çağrılabilir.)
- [ ] **Step 2: Çalıştır, FAIL** — `cargo test -p runner`. Expected: derleme
      hatası (`Unchanged` yok).
- [ ] **Step 3: Uygula** — varyant, `unchanged: AtomicU64`,
      `count_unchanged`, `process.rs`'te `Outcome::Unchanged => totals.count_unchanged()`.
      Exhaustive `match` kullanan diğer crate'ler varsa (`cargo build --workspace`
      gösterir) onları da güncelle.
- [ ] **Step 4: Çalıştır, PASS** — `cargo test -p runner && cargo build --workspace`
- [ ] **Step 5: Commit** — `feat(runner): an Unchanged outcome for a message that wrote nothing`

### Task 3: Rust `queue-prices`

**Files:**

- Create: `backend-rs/queues/queue-prices/{Cargo.toml,src/lib.rs,src/main.rs}`,
  `tests/ids.rs`, `tests/fixtures/{killmails,victims,killmail_items,types}.sql`
  (`queue-killmail-types/tests/fixtures/`'tan kopya)
- Modify: `backend/package.json` (`queue:prices:rs`, `queue:types:rs`
  satırının biçiminde, alfabetik yerine `queue:prices`'ın yanına)

**Interfaces:**

- Produces: `pub const QUEUE_NAME: &str = "esi_type_price_queue"`,
  `pub const SOURCE: &str = "queue-prices"`,
  `pub async fn priced_type_ids(pool: &PgPool) -> sqlx::Result<Vec<i32>>` —
  spec'teki SQL birebir.

- [ ] **Step 1: Failing testler** — `tests/ids.rs`,
      `#[sqlx::test(migrations = false, fixtures("killmails", "victims", "killmail_items", "types"))]`,
      satırlar `queue-killmail-types/tests/ids.rs`'teki yardımcılarla:
  - `ships_and_items_are_queued_once_in_order`: victim ship 587, item 34 ve
    587, types {34, 587} → `vec![34, 587]`.
  - `unknown_types_are_skipped`: item 99999 `types`'ta yok → sonuçta yok.
  - `attackers_are_not_read`: sadece attacker ship'i olan bir type → sonuçta
    yok (Node da okumuyor).
- [ ] **Step 2: Çalıştır, FAIL** — `cd backend && DATABASE_URL="$(grep -m1 '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"')" cargo test --manifest-path ../backend-rs/Cargo.toml -p queue-prices`
- [ ] **Step 3: Uygula** — `lib.rs` sorgu; `main.rs`, `queue-killmail-types/src/main.rs`
      ile aynı akış: `priority` `None`, log metinleri `types to price`,
      boşsa `✅ no types to price!` ile RabbitMQ'suz exit 0, son satır
      `now run the worker: yarn worker:prices:rs`.
- [ ] **Step 4: Çalıştır, PASS** — Step 2 komutu, sonra
      `cd ../backend-rs && cargo fmt --check && cargo clippy --all-targets -- -D warnings`
- [ ] **Step 5: Commit** — `feat: Rust queue-prices`

### Task 4: Rust `worker-prices`

**Files:**

- Create: `backend-rs/workers/worker-prices/{Cargo.toml,src/lib.rs,src/market.rs,src/main.rs}`,
  `tests/{parse.rs,price.rs,upsert.rs,handle.rs}`,
  `tests/fixtures/{types.sql,market_prices.sql}` (`market_prices.sql`,
  `worker-info-types/tests/fixtures/types.sql`'in başındaki `pg_dump`
  komutuyla `--table=market_prices` için üretilir; FK `types`'a, fixture
  sırası `"types", "market_prices"`)
- Modify: `backend/package.json` (`worker:prices:rs`)

**Interfaces:**

- Consumes: Task 1 `get_paged`, Task 2 `Outcome::Unchanged`.
- Produces (`market.rs`):
  - `pub const REGION_ID: i32 = 10000002; pub const JITA_4_4: i64 = 60003760;`
  - `#[derive(Deserialize)] pub struct Order { pub location_id: i64, pub price: f64, pub is_buy_order: bool, pub volume_remain: i64 }`
    (ESI'nin diğer alanları yok sayılır)
  - `#[derive(Debug, Clone, PartialEq)] pub struct Price { pub buy: f64, pub sell: f64, pub average: f64, pub volume: f64 }`
  - `pub fn jita_price(orders: &[Order]) -> Option<Price>`
  - `pub async fn upsert_price(pool: &PgPool, type_id: i32, price: &Price) -> Result<bool, sqlx::Error>`
    — spec'teki SQL, `true` = inserted.
  - `pub fn orders_path(type_id: i32) -> String` →
    `"/markets/10000002/orders/?type_id={id}"`
- `lib.rs`: `pub mod market;` ve `pub struct PriceWorker { pub pool: PgPool, pub esi: EsiClient }`
  - `impl Worker` (`handle` testten çağrılabilsin diye lib'de;
    `worker-alliance-corporations` deseni). `QUEUE_NAME = "esi_type_price_queue"`,
    `CONSUMER_TAG = "worker-prices-rs"`, `STARTED = "🏪 Jita price worker started"`,
    `WAITING_FOR = "type IDs"`, `ENTITY = "type"`.
    `handle`: `None` → `Outcome::Unchanged`, detail `" {id} (no Jita orders)"`;
    `Some` → `Created`/`Updated`, detail `" {id} buy={:.2} sell={:.2}"`.

- [ ] **Step 1: Failing testler**
  - `parse.rs`: ESI'nin tam bir emir JSON'u (`order_id`, `duration`, `issued`,
    `range` vb. dahil) ve `location_id: 1_035_466_617_946` olan bir emir
    `Vec<Order>`'a parse olur.
  - `price.rs`: `other_stations_are_ignored` (Jita sell 5.0, başka istasyon
    sell 4.0 → sell 5.0); `buy_only` (buy 3.0 → `buy 3.0, sell 0.0, average 1.5`);
    `sell_only`; `a_single_cheap_order_does_not_set_the_price` (sell
    1 × 1.0, 100 × 10.0, 99 × 11.0 → sell 9.1);
    `buy_takes_the_top_five_percent` (buy 1 × 100.0, 100 × 10.0, 99 × 9.0 →
    `(1·100 + 9·10) / 10 = 19.0`); `both_sides` (buy 1 × 4.0; sell 1 × 5.0;
    volume 1+1 → `buy 4, sell 5, average 4.5, volume 2`);
    `no_jita_orders_is_none`; `empty_is_none`. Kayan nokta karşılaştırması
    `(a - b).abs() < 1e-9`.
  - `upsert.rs` (`fixtures("types", "market_prices")`, type 34 satırı test
    içinde eklenir): ilk çağrı `true` ve `created_at`/`updated_at` dolu; ikinci
    çağrı `false`, değerler yenilenmiş, `updated_at` ilerlemiş.
  - `handle.rs` (wiremock + gerçek PG, `worker-alliance-corporations/tests/handle.rs`
    deseni, publisher kullanılmaz):
    `jita_orders_on_page_two_are_priced` (`X-Pages: 2`, Jita emri yalnız
    page 2'de → `Created`, satır o fiyatla);
    `other_stations_only_leaves_the_row` (önceden satır 7.0 → `Unchanged`,
    satır 7.0 kalır); `esi_error_is_an_error` (500 → `Err`, satır değişmez).
- [ ] **Step 2: Çalıştır, FAIL** — Task 3 Step 2 komutu, `-p worker-prices`.
- [ ] **Step 3: Uygula** — `market.rs`, `lib.rs`, `main.rs`
      (`worker-info-types/src/main.rs` gibi: `runner::run(|r| PriceWorker { pool: r.pool, esi: r.esi })`;
      modül yorumunda Node'dan farklar: Jita 4-4, bütün sayfalar, emir yoksa
      dokunmaz, hatalar yutulmaz, spec yolu).
- [ ] **Step 4: Çalıştır, PASS** — Step 2 komutu + `cargo fmt --check && cargo clippy --all-targets -- -D warnings`
- [ ] **Step 5: Commit** — `feat: Rust worker-prices`

### Task 5: Node düzeltmeleri

**Files:**

- Modify: `backend/src/services/market/market.service.ts`,
  `backend/src/workers/worker-prices.ts`, `backend/src/queues/queue-prices.ts`
- Create: `backend/src/services/market/market.service.spec.ts`

**Interfaces:**

- Produces (`market.service.ts`):
  - `export const JITA_4_4 = 60003760;`
  - `export function jitaPriceFromOrders(typeId: number, orders: ESIMarketOrder[]): MarketPrice | null`
    — Task 4 `jita_price`'ın aynı kuralları.
  - `MarketService.getJitaPrice(typeId): Promise<MarketPrice | null>` — sayfa
    1'i `params: { type_id, page: 1 }` ile çeker, `Number(res.headers['x-pages'])`
    (okunamazsa 1) kadar sayfayı sırayla okur, `jitaPriceFromOrders`'a verir.
    `try/catch` kalkar: her hata fırlar.
  - `MarketService.savePrice(price): Promise<void>` — `try/catch` kalkar.

- [ ] **Step 1: Failing testler** — `market.service.spec.ts`,
      `character.service.spec.ts` desenindeki `vi.mock('@services/esi-client', …)`
      ve `vi.mock('@services/prisma-worker', …)`:
  - `jitaPriceFromOrders`: Task 4 `price.rs`'teki altı vakanın aynısı, aynı
    değerlerle.
  - `getJitaPrice reads every page`: page 1 `x-pages: '2'` başka istasyon,
    page 2 Jita sell 5 → `sell 5`; `esiClient.get` iki kez,
    `params.page` 1 ve 2.
  - `getJitaPrice rethrows`: `esiClient.get` 500 hatasıyla reject → promise
    reject.
  - `savePrice rethrows`: `marketPrice.upsert` reject → promise reject.
- [ ] **Step 2: Çalıştır, FAIL** — `yarn workspace backend test src/services/market`
- [ ] **Step 3: Uygula**
  - `market.service.ts`: yukarıdaki arayüz; path `/latest/markets/10000002/orders/`
    olduğu gibi kalır.
  - `worker-prices.ts`: `findUnique` kalkar; `null` → `  - [n] [typeId] (no Jita orders)`
    ve ack; aksi halde `  ✅ [n] [typeId] buy=… sell=… (saved)`. Prefetch
    `worker-info-types.ts:17-20` kuralı (`Math.max(config.esi.prefetch, Math.ceil(config.esi.maxRequestsPerSecond / 2))`,
    o dosyadaki ifadeyi birebir al) ve başındaki yorum.
  - `queue-prices.ts`: tek sorgu spec SQL'i (`$queryRaw<{ id: number }[]>`),
    `publishEntitiesConfirmed(QUEUE_NAME, 'queue-prices', ids, { onBatch })`,
    `queue-character-corporations.ts:39-66` akışı (boşsa
    `✅ no types to price!` ile exit 0; `process.exit` confirm'den sonra).
- [ ] **Step 4: Çalıştır, PASS** — `yarn workspace backend test && yarn workspace backend build`
- [ ] **Step 5: Commit** — `fix: prices read every page, only Jita 4-4, and stop swallowing errors`

### Task 6: Dokümanlar ve son doğrulama

**Files:**

- Modify: `backend/docs/workers/` altında prices zincirini anlatan sayfa
  (`grep -rln "worker:prices\|esi_type_price_queue" backend/docs` ile bulunur;
  yoksa `worker-documentation.md`'deki worker listesine kısa bir bölüm).
  `backend/docs/ops/systemd.md` değişmez.

- [ ] **Step 1: Doküman** — Rust komutları (`queue:prices:rs`,
      `worker:prices:rs`), Jita 4-4 kuralı, "emir yoksa dokunmaz" ve "sadece
      buy emri varsa sell 0" sonucu. Linkler dosyaya göreli.
- [ ] **Step 2: Format** — `npx prettier --check` değişen bütün dosyalarda.
- [ ] **Step 3: Tam set** — `qa` agent'ına arka planda: `yarn test`,
      `yarn workspace backend build`, `cd backend-rs && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test --workspace`
      (DATABASE_URL Task 3'teki gibi). Expected: hepsi PASS.
- [ ] **Step 4: Commit** — `docs: the Rust price worker and the Jita 4-4 rule`
