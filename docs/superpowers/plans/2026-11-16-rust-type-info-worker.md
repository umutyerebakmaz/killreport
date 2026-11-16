# Rust type worker'ı ve kuyruğu (`worker-info-types`, `queue-types`) — implementasyon planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Amaç:** `esi` crate'ine sayfalı liste okumayı (`get_paged`) eklemek, sonra
`worker-info-types.ts` ve `queue-types.ts`'in Rust karşılıklarını yazmak.

**Mimari:** `esi::EsiClient`'ın istek gövdesi, başlıkları da döndüren içe
dönük bir yardımcıya taşınır; `get_paged` onu `X-Pages` kadar çağırır. Worker
`backend-rs/workers/worker-info-types` altında öbür worker'ların düzenini
izler: `type_info.rs` ESI tipi ve upsert, `main.rs` `runner::Worker` impl'i.
Kuyruk `backend-rs/queues/queue-types` altında: ID'ler ESI'den, filtre
veritabanından, yalnızca eksikler basılır.

**Teknoloji:** Rust (`rust-toolchain.toml`), tokio, reqwest, sqlx (postgres),
serde, tracing, wiremock.

**Spec:** `docs/superpowers/specs/2026-11-16-rust-type-info-worker-design.md`

## Genel kısıtlar

- Worktree `.worktrees/rust-type-info-worker`, branch `feat/rust-type-info-worker` (spec commit'li). Ana checkout'a dokunulmaz: orada başka bir oturum systemd işi üzerinde çalışıyor.
- Commit mesajları İngilizce, Claude attribution satırı yok.
- Worktree'de `backend/.env` yok ve oluşturulmaz. Testler ve `cargo sqlx prepare` için `DATABASE_URL` ana checkout'un `.env`'inden okunur:
  `export DATABASE_URL=$(grep -m1 '^DATABASE_URL' ../../../backend/.env | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r')` (`backend-rs/` içinden).
- Kuyruk `esi_type_info_queue`, prefetch `10`, consumer tag `worker-info-types-rs`, `source` `queue-types`, başlangıç satırı `📦 type info worker started`.
- ESI yolları: liste `/universe/types/` (`?page=N` ile), tekil `/universe/types/{id}/`. İkisinin de sonunda `/` var.
- `meta_group_id` hiçbir SQL'de yazılmaz.
- `runner` crate'ine ve var olan üç worker'a dokunulmaz.
- Yeni `query!`/`query_scalar!` eklendiğinde `.sqlx/`, `backend-rs/` içinde `cargo sqlx prepare --workspace` ile yenilenip commit edilir. CI `SQLX_OFFLINE=true` ile derler.
- Node dosyalarına, `ecosystem.config.js`'e, `deploy/`'a ve `.env`'e dokunulmaz. Node tarafındaki tek değişiklik `backend/package.json`'a iki `:rs` satırı.
- Her task sonunda `cargo fmt --check` ve `cargo clippy --all-targets -- -D warnings` temiz olmalı.

## Review Focus

1. **`X-Pages` başlığı yok ya da sayı değil** (`X-Pages: abc`): tek sayfa kabul edilir, hata yok. → Task 1: `without_x_pages_only_the_first_page_is_read`, `an_unreadable_x_pages_counts_as_one_page`.
2. **Ortadaki bir sayfa başarısız olur** (2. sayfa 500 ya da 420): bütün çağrı hata döner, kısmi liste dönmez; 420'de limiter yine fren yapar. → Task 1: `a_failing_later_page_fails_the_whole_call`, `a_throttled_later_page_brakes_the_limiter`.
3. **İlk istek de `?page=1` taşır.** Sayfasız istek ESI'de 1. sayfayı döndürür ama sayfa numarası açık olmalı. → Task 1: testlerde mock'lar `query_param("page", "1")` ile eşleşir.
4. **ESI listesinde tekrar eden ID, ya da tabloda zaten olan ID:** kuyruğa hiç ya da bir kez girer, ESI sırası korunur. → Task 4: `missing_keeps_esi_order_and_drops_existing_and_repeats`.
5. **Var olan satır güncellenince `meta_group_id` ve `created_at` korunur.** → Task 2: `an_update_keeps_meta_group_id_and_created_at`.

---

### Task 1: `esi` — `get_paged`

**Files:**

- Modify: `backend-rs/crates/esi/src/client.rs`
- Test: `backend-rs/crates/esi/tests/paged.rs` (yeni)

**Interfaces:**

- Produces: `EsiClient::get_paged<T: DeserializeOwned>(&self, path: &str) -> Result<Vec<T>, EsiError>`. `path` sorgu kısmı içermez.

- [ ] **Adım 1: Testleri yaz.** `tests/paged.rs`, `client.rs` testlerindeki `client_for` kalıbıyla (`RateLimiter::new(50)`, `with_base_url`). Mock'lar `path("/universe/types/")` ve `query_param("page", "N")` ile eşleşir.
  - `reads_every_page_in_order`: 1. sayfa `[1,2]` + `X-Pages: 3`, 2. sayfa `[3]`, 3. sayfa `[4,5]`; her mock `.expect(1)`. Sonuç `[1,2,3,4,5]`.
  - `without_x_pages_only_the_first_page_is_read`: başlıksız 1. sayfa `[7]`, `page=2` için `.expect(0)` mock'u. Sonuç `[7]`.
  - `an_unreadable_x_pages_counts_as_one_page`: `X-Pages: abc`, sonuç yalnızca 1. sayfa.
  - `a_failing_later_page_fails_the_whole_call`: `X-Pages: 2`, 2. sayfa 500. `EsiError::Http { status: 500, .. }` döner.
  - `a_throttled_later_page_brakes_the_limiter`: 2. sayfa `420` + `x-esi-error-limit-reset: 30`. `EsiError::Throttled` döner ve `client.limiter().stats().paused_until.is_some()`.

- [ ] **Adım 2: Çalıştır, başarısız olduğunu gör.** `cargo test -p esi --test paged`. Beklenen: `no method named get_paged` derleme hatası.

- [ ] **Adım 3: Uygula.** `get_with_compatibility_date`'in gövdesi, `(T, HashMap<String, String>)` döndüren özel bir `async fn` yardımcısına taşınır (başlıklar zaten `lowercase_headers` ile hesaplanıyor). `get_with_compatibility_date` onu çağırıp başlıkları atar; imzası ve davranışı değişmez. `get_paged`, `{path}?page=1`'i `CompatibilityDate::DEFAULT` ile ister, `x-pages`'i `u32` olarak parse eder (okunamazsa ya da yoksa 1), sonra `2..=pages` için sırayla ister ve `Vec<T>`'leri birleştirir. Hata `?` ile aynen yükselir.

- [ ] **Adım 4: Doğrula.** `cargo test -p esi` (bütün `esi` testleri; var olan `client.rs` testleri değişmeden geçmeli). PASS. `cargo clippy -p esi --all-targets -- -D warnings` temiz.

- [ ] **Adım 5: Commit.** `git add backend-rs/crates/esi && git commit -m "feat(backend-rs): read every page of a paged ESI list"`

---

### Task 2: `worker-info-types` — ESI tipi ve upsert

**Files:**

- Create: `backend-rs/workers/worker-info-types/Cargo.toml`, `src/lib.rs`, `src/type_info.rs`
- Test: `tests/parse.rs`, `tests/upsert.rs`, `tests/fixtures/types.sql`
- Modify: `backend-rs/.sqlx/` (yenilenir), `backend-rs/Cargo.lock`

**Interfaces:**

- Produces:
  - `pub struct TypeInfo { pub name: String, pub description: Option<String>, pub group_id: i32, pub published: bool, pub volume: Option<f64>, pub capacity: Option<f64>, pub mass: Option<f64>, pub icon_id: Option<i32> }` (`Deserialize`, `Debug`, `Clone`, `PartialEq`; opsiyonellerde `#[serde(default)]`; öbür ESI alanları yok sayılır).
  - `pub async fn upsert_type(pool: &PgPool, id: i32, info: &TypeInfo) -> Result<bool, sqlx::Error>`: yeni satırsa `true`.

- [ ] **Adım 1: Crate iskeleti.** `Cargo.toml`, `worker-info-characters`'ınkinin kopyası; `chrono`, `serde_json`, `tracing` ve `tracing-subscriber` yalnızca gerçekten kullanılırsa kalır. Testler `NaiveDateTime` okuyacağı için `chrono` dev-dependency olarak yeterli olabilir. `lib.rs`: `pub mod type_info;` ve kısa bir modül yorumu.

- [ ] **Adım 2: Fixture'ı üret.** `tests/fixtures/types.sql`, öbür fixture'lardaki başlık yorumu ve tarifle (`pg_dump --schema-only --table=types ... | tr -d '\r' | grep -Ev ...`), yerel veritabanından. İçinde `meta_group_id` ve `created_at DEFAULT CURRENT_TIMESTAMP` görünmeli. Index satırları kalabilir. Foreign key satırı varsa (`type_dogma_*` gibi başka tablolara referans) fixture'dan çıkarılır, yoksa yükleme düşer.

- [ ] **Adım 3: Testleri yaz.**
  - `parse.rs`:
    - `parses_a_real_esi_answer`: Rifter'ın (587) gerçek yanıtının kısaltılmış hali; `dogma_attributes`, `market_group_id`, `packaged_volume`, `radius` gibi fazladan alanlar dahil. Beklenen `TypeInfo` alan alan.
    - `optional_fields_may_be_missing`: yalnızca `name`, `group_id`, `published`, `type_id` ile; `description`, `volume`, `capacity`, `mass`, `icon_id` `None`.
  - `upsert.rs` (`#[sqlx::test(migrations = false, fixtures("types"))]`, `worker-info-alliances/tests/upsert.rs` kalıbı):
    - `a_new_type_is_inserted_with_both_timestamps`: `true` döner; satırın alanları `TypeInfo` ile aynı, `created_at` ve `updated_at` dolu, `meta_group_id` NULL.
    - `an_existing_type_is_updated`: önce bir `INSERT` ile eski adla satır, sonra `upsert_type` yeni adla; `false` döner ve ad yeni.
    - `an_update_keeps_meta_group_id_and_created_at`: elle `meta_group_id = 2` ve geçmiş bir `created_at` ile satır; `upsert_type` sonrası ikisi aynı, `updated_at` değişmiş.

- [ ] **Adım 4: Çalıştır, başarısız olduğunu gör.** `cargo test -p worker-info-types`. Beklenen: `TypeInfo` / `upsert_type` bulunamadı derleme hatası.

- [ ] **Adım 5: Uygula.** `type_info.rs`: `TypeInfo` ve `upsert_type`. SQL spec'teki gibi `sqlx::query_scalar!` ile, `RETURNING (xmax = 0) AS "inserted!"`. Doc yorumu öbür worker'lardaki gibi neyin neden açıkça yazıldığını söyler: `updated_at` varsayılansız, `meta_group_id` sde'nin.

- [ ] **Adım 6: Doğrula.** `cargo test -p worker-info-types` PASS. `cargo sqlx prepare --workspace`, ardından `SQLX_OFFLINE=true cargo build --workspace` başarılı.

- [ ] **Adım 7: Commit.** `git add backend-rs/workers/worker-info-types backend-rs/.sqlx backend-rs/Cargo.lock && git commit -m "feat(backend-rs): type info decode and upsert"`

---

### Task 3: `worker-info-types` — binary ve script

**Files:**

- Create: `backend-rs/workers/worker-info-types/src/main.rs`
- Modify: `backend/package.json`

**Interfaces:**

- Consumes: Task 2'deki `TypeInfo`, `upsert_type`; `runner::{run, Processed, Worker}`.

- [ ] **Adım 1: `main.rs`.** `worker-info-characters/src/main.rs`'in kalıbı: `TypeWorker { pool, esi }`, sabitler Genel kısıtlar'daki gibi, `WAITING_FOR = "types"`, `ENTITY = "type"`. `handle`: `self.esi.get::<TypeInfo>(&format!("/universe/types/{id}/"))`, sonra `upsert_type`, `Processed { inserted, detail: format!(" {}", info.name) }`. Üstteki modül yorumu Node dosyasını, `backend/`'den çalıştırmayı ve spec'teki "Node'dan fark" maddesini (var olan type'ı tazeler) anar.

- [ ] **Adım 2: Script.** `backend/package.json`'a, `worker:info:corporations:rs`'in yanına alfabetik sırayla:
      `"worker:info:types:rs": "cargo run --release --manifest-path ../backend-rs/Cargo.toml -p worker-info-types"`.

- [ ] **Adım 3: Doğrula.** `cargo build -p worker-info-types` başarılı, `cargo clippy --all-targets -- -D warnings` temiz, kökte `npx prettier --check backend/package.json` temiz.

- [ ] **Adım 4: Commit.** `git commit -m "feat(backend-rs): Rust type info worker"` (`main.rs` ve `package.json`).

---

### Task 4: `queue-types`

**Files:**

- Create: `backend-rs/queues/queue-types/Cargo.toml`, `src/lib.rs`, `src/main.rs`
- Test: `tests/fetch.rs`, `tests/ids.rs`, `tests/fixtures/types.sql` (Task 2'dekinin kopyası)
- Modify: `backend/package.json`, `backend-rs/Cargo.lock`

**Interfaces:**

- Consumes: Task 1'deki `EsiClient::get_paged`.
- Produces (`lib.rs`):
  - `pub const QUEUE_NAME: &str = "esi_type_info_queue";`, `pub const SOURCE: &str = "queue-types";`
  - `pub async fn fetch_type_ids(esi: &EsiClient) -> Result<Vec<i32>, EsiError>`: `esi.get_paged("/universe/types/")`.
  - `pub async fn existing_type_ids(pool: &PgPool) -> sqlx::Result<HashSet<i32>>`: runtime `sqlx::query_scalar("SELECT id FROM types")` (`queue-characters` gibi, makro değil).
  - `pub fn missing(esi_ids: &[i32], existing: &HashSet<i32>) -> Vec<i32>`.

- [ ] **Adım 1: Crate iskeleti.** `Cargo.toml`: `queue-alliances` ile `queue-characters`'ın birleşimi (`anyhow`, `db`, `esi`, `mq`, `runner`, `sqlx`, `tokio`, `tracing`; dev: `serde_json`, `wiremock`, `sqlx` + `migrate`).

- [ ] **Adım 2: Testleri yaz.**
  - `fetch.rs`: `fetches_every_page_of_the_type_list` (`X-Pages: 2`, `[1,2]` + `[3]` → `[1,2,3]`, `path("/universe/types/")`); `server_error_is_an_error`.
  - `ids.rs`:
    - `missing_keeps_esi_order_and_drops_existing_and_repeats`: `missing(&[5, 3, 9, 3, 1], &{3, 1})` → `[5, 9]`.
    - `existing_type_ids_reads_the_table` (`#[sqlx::test(migrations = false, fixtures("types"))]`): iki satır eklenir, küme tam o iki ID.

- [ ] **Adım 3: Çalıştır, başarısız olduğunu gör.** `cargo test -p queue-types`. Beklenen: fonksiyonlar bulunamadı.

- [ ] **Adım 4: `lib.rs`'i uygula.** `missing`, bir `HashSet` ile görülenleri izleyerek ESI sırasını korur.

- [ ] **Adım 5: `main.rs`.** `queue-characters/src/main.rs`'in iskeleti; akış ve log metinleri spec'in _queue-types_ bölümündeki sırayla, birebir:
      `fetching all type IDs from ESI...` → `found {n} types` → `{k} already in database, {m} to queue` → (m = 0 ise) `nothing to queue` ve `Ok(())` → `adding to queue: esi_type_info_queue` → `publish_entities` (batch geri çağrısı `debug!("queued batch {batch}/{total}")`) → `all {m} types queued successfully!` → `run worker with: yarn worker:info:types:rs`. Hata `error!("failed to queue types: {e:#}")` ve çıkış 1. `EsiClient`'ı worker'ların kurduğu yoldan kurar (`queue-alliances/src/main.rs`'e bak). Veritabanı havuzu ESI listesi alındıktan sonra açılır ve RabbitMQ'ya bağlanmadan kapatılır.

- [ ] **Adım 6: Script.** `backend/package.json`'a, `queue:types`'ın yanına: `"queue:types:rs": "cargo run --release --manifest-path ../backend-rs/Cargo.toml -p queue-types"`.

- [ ] **Adım 7: Doğrula.** `cargo test -p queue-types` PASS; `cargo clippy --all-targets -- -D warnings`, `cargo fmt --check` temiz; `npx prettier --check backend/package.json`.

- [ ] **Adım 8: Commit.** `git commit -m "feat(backend-rs): Rust type queue that publishes only missing types"`

---

### Task 5: CLAUDE.md notu

**Files:**

- Modify: `CLAUDE.md` (_The ingest pattern_ altındaki iki kuyruk türü listesi)

- [ ] **Adım 1: Not ekle.** Listenin altına İngilizce tek paragraf: `queue-types` (Rust) ikisinin arasında durur. Aday ID'leri bir ESI list endpoint'inden okur (`/universe/types/`, sayfalı), ama "zaten veritabanında mı?" filtresini enrichment kuyrukları gibi uygular; worker bu yüzden atlamaz, düz upsert yapar. Node `queue-types.ts`'in yalnızca `/universe/groups/`'un 1. sayfasını okuduğu da bir cümleyle belirtilir.

- [ ] **Adım 2: Doğrula.** `npx prettier --check CLAUDE.md`.

- [ ] **Adım 3: Commit.** `git commit -m "docs: note where the type queue sits between root scan and enrichment"`

---

### Task 6: Tam paket ve yerel koşu

Kod değişikliği yok; spec'in _Doğrulama_ bölümündeki elle yapılan kontrol.

- [ ] **Adım 1: Tam Rust paketi.** `backend-rs/` içinde `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test`; hepsi temiz/PASS. Kökte `npx prettier --check backend/package.json CLAUDE.md docs/superpowers/plans/2026-11-16-rust-type-info-worker.md`.

- [ ] **Adım 2: Satır sayısı.** `psql "$DB" -At -c "SELECT COUNT(*) FROM types;"` kaydedilir.

- [ ] **Adım 3: Kuyruk koşusu.** Worktree'de `.env` olmadığı için binary'ler **ana checkout'un `backend/` dizininden**, worktree'nin manifest'iyle çalıştırılır; böylece aynı `.env` okunur:
      `cd ../../../backend && cargo run --release --manifest-path ../.worktrees/rust-type-info-worker/backend-rs/Cargo.toml -p queue-types`.
      Bu koşu ve sonraki worker koşusu ESI'ye gerçek istek atar, bu yüzden kullanıcıya önceden haber verilir. Beklenen: `found ~53000 types`, `~33600 already in database, ~20000 to queue`, `all … queued successfully!`. Kuyruk derinliği basılan sayıyla aynı olmalı.

- [ ] **Adım 4: Worker koşusu.** Aynı yoldan `-p worker-info-types`. Kuyruk boşalınca `📊 final:` satırı: neredeyse hepsi created, `errors` sıfır ya da yalnızca 404'ler.

- [ ] **Adım 5: Satır sayısını yeniden kontrol et.** Adım 2'deki sayı + created sayısı; hiçbir koşulda azalmamış olmalı.

- [ ] **Adım 6: İkinci kuyruk koşusu.** Yine `queue-types`. Beklenen: `nothing to queue`, ya da yalnızca 404 alan birkaç ID.

- [ ] **Adım 7: Yol haritası.** PR açıldıktan sonra #315'te `worker:info:types` ve `queue:types` satırları `[x]` yapılır, Rust crate sütununa crate yolu ve PR numarası yazılır, "Done" sayısı bir artırılır (ikisi için iki).
