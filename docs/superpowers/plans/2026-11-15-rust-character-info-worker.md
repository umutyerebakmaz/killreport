# Rust karakter worker'ı ve kuyruğu (`worker-info-characters`, `queue-characters`) — implementasyon planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Amaç:** `esi` crate'ine istek başına `X-Compatibility-Date` vermeyi eklemek,
sonra `worker-info-characters.ts` ve `queue-characters.ts`'in Rust
karşılıklarını yazmak.

**Mimari:** `esi`'ye `CompatibilityDate` tipi ve
`EsiClient::get_with_compatibility_date` eklenir; `get` onun varsayılan tarihli
inceltmesi olur. Worker `backend-rs/workers/worker-info-characters` altında
corporation worker'ının düzenini izler: `character.rs` ESI tipi, başlık
alanları ve upsert; `main.rs` `runner::Worker` impl'i. Kuyruk
`backend-rs/queues/queue-characters` altında `queue-corporations`'ın kopyasıdır.

**Teknoloji:** Rust (`rust-toolchain.toml`), tokio, reqwest, sqlx (postgres,
`uuid` özelliği yok), serde/serde_json, chrono, tracing, wiremock.

**Spec:** `docs/superpowers/specs/2026-11-15-rust-character-info-worker-design.md`

## Genel kısıtlar

- Branch: `feat/rust-character-info-worker` (spec zaten commit'li). Commit mesajları İngilizce, Claude attribution satırı yok.
- Varsayılan uyumluluk tarihi `2020-01-01`; karakter tarihi `2026-06-09`.
- Kuyruk `esi_character_info_queue`, prefetch `5`, consumer tag `worker-info-characters-rs`, `source` `queue-characters`.
- ESI yolu `/characters/{id}/` (sonda `/` var).
- Uyarı metinleri: `Ignoring achievement_score {v}: not an int32 >= 0`, `Ignoring character_title_id {v}: not a UUID`.
- UUID deseni: `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`, büyük/küçük harf duyarsız.
- Yeni workspace bağımlılığı yok (`uuid` crate'i yok, sqlx `uuid` özelliği yok). `character_title_id`, `$n::text::uuid` ile bağlanır.
- Yeni `query!`/`query_scalar!` eklendiğinde `.sqlx/`, `backend-rs/` içinde `cargo sqlx prepare --workspace` ile yenilenip commit edilir. CI `SQLX_OFFLINE=true` ile derler.
- Node dosyalarına, `ecosystem.config.js`'e ve `.env`'e dokunulmaz. Node tarafındaki tek değişiklik, `backend/package.json`'a iki `:rs` satırı.
- Her task sonunda `cargo fmt --check` ve `cargo clippy --all-targets -- -D warnings` temiz olmalı. `cargo test` da `DATABASE_URL` yerel PostgreSQL'i gösterirken geçmeli.

## Review Focus

1. **`achievement_score` beklenmedik tipte gelir** (`1.5`, `"x"`, `null`): decode başarılı olur, skor `None` olur, satırın geri kalanı yazılır. → Task 2: `a_wrong_typed_score_does_not_fail_the_decode`, `title_fields` vakaları.
2. **Büyük harfli UUID** (`00851DE7-…`): kabul edilir. Postgres onu küçük harfle saklar, bu yüzden testler küçük harfli değeri bekler. → Task 3: `an_uppercase_title_id_is_stored`.
3. **ESI bir opsiyoneli açıkça `null` gönderir** (`"alliance_id": null`): `None` olarak okunur, decode düşmez. → Task 2: `explicit_nulls_parse_as_none`.
4. **Bir istekte iki `x-compatibility-date` başlığı.** Default header ile istek başlığı birlikte gitmemeli. → Task 1: `sends_exactly_one_compatibility_date`.
5. **`birthday` kesirli saniyeyle gelir** (`2010-01-01T12:34:56.789Z`): parse edilir, `timestamp(3)` olarak saklanır. → Task 2 ve Task 3'teki fixture değerinde milisaniye kullanılır.

---

### Task 1: `esi` — istek başına uyumluluk tarihi

**Dosyalar:**

- Oluştur: `backend-rs/crates/esi/src/compatibility.rs`
- Değiştir: `backend-rs/crates/esi/src/client.rs` (`COMPATIBILITY_DATE` sabiti `:18`, default header `:92-95`, `get` `:114-163`)
- Değiştir: `backend-rs/crates/esi/src/lib.rs` (modül ve `pub use`)
- Test: `backend-rs/crates/esi/tests/client.rs`, `backend-rs/crates/esi/tests/compatibility.rs` (yeni)

**Arayüzler:**

- Üretir:
  - `esi::CompatibilityDate` (`Clone, Copy, Debug, PartialEq, Eq`)
  - `pub const fn CompatibilityDate::new(date: &'static str) -> CompatibilityDate`
  - `pub const CompatibilityDate::DEFAULT: CompatibilityDate` (`"2020-01-01"`)
  - `pub fn CompatibilityDate::as_str(self) -> &'static str`
  - `pub async fn EsiClient::get_with_compatibility_date<T: DeserializeOwned>(&self, path: &str, date: CompatibilityDate) -> Result<T, EsiError>`
  - `EsiClient::get(path)` imzası değişmez.

- [ ] **Adım 1: Başarısız testleri yaz.**

  `tests/compatibility.rs`:
  - `accepts_a_valid_date`: `CompatibilityDate::new("2026-06-09").as_str() == "2026-06-09"`.
  - `the_default_is_2020_01_01`: `CompatibilityDate::DEFAULT.as_str() == "2020-01-01"`.
  - `#[should_panic]` testleri, her biri runtime'da `CompatibilityDate::new(..)` çağırır: `rejects_a_short_date` (`"2026-6-09"`), `rejects_wrong_separators` (`"2026/06/09"`), `rejects_letters` (`"2026-0a-09"`), `rejects_trailing_text` (`"2026-06-09x"`).

  `tests/client.rs`, mevcut `sends_the_user_agent_and_the_compatibility_date` olduğu gibi kalır (`get` hâlâ `2020-01-01` gönderiyor) ve şunlar eklenir:
  - `sends_the_requested_compatibility_date`: mock `header("x-compatibility-date", "2026-06-09")` ile eşleşir ve `.expect(1)`. `get_with_compatibility_date("/characters/1/", CompatibilityDate::new("2026-06-09"))` çağrılır.
  - `sends_exactly_one_compatibility_date`: mock her isteği yanıtlar. Sonra `server.received_requests().await.unwrap()[0].headers.get_all("x-compatibility-date").iter().count() == 1` ve değer `2026-06-09` olmalı.

- [ ] **Adım 2: Testlerin başarısız olduğunu doğrula.** `cargo test -p esi`. `CompatibilityDate` ve `get_with_compatibility_date` tanımlı olmadığı için derleme hatası beklenir.

- [ ] **Adım 3: `compatibility.rs`'i yaz.** `new`, biçimi bir `const fn` döngüsüyle doğrular: uzunluk 10, `bytes[4] == b'-'` ve `bytes[7] == b'-'`, diğer baytlar `b'0'..=b'9'`. Değilse `panic!("compatibility date must be YYYY-MM-DD")`. Doc yorumu, takvim geçerliliğinin denetlenmediğini ve nedenini (spec) söyler.

- [ ] **Adım 4: `client.rs`'i değiştir.** `COMPATIBILITY_DATE` sabiti silinir ve `default_headers`'tan `x-compatibility-date` çıkarılır. `get`'in gövdesi `get_with_compatibility_date`'e taşınır; istekte `.header("x-compatibility-date", HeaderValue::from_static(date.as_str()))` kullanılır. `get` tek satırla `self.get_with_compatibility_date(path, CompatibilityDate::DEFAULT).await` olur. Modül başı yorumu ve `get`'in doc'u bu değişikliğe göre güncellenir.

- [ ] **Adım 5: Testlerin geçtiğini doğrula.** `cargo test -p esi`; bütün testler, `guard.rs` dahil, PASS olmalı. Ardından `cargo build --workspace` ile mevcut çağıranların değişmeden derlendiğini doğrula.

- [ ] **Adım 6: Commit.**

  ```bash
  git add backend-rs/crates/esi
  git commit -m "feat(esi): per-request X-Compatibility-Date"
  ```

---

### Task 2: `worker-info-characters` — ESI tipi ve başlık alanları

**Dosyalar:**

- Oluştur: `backend-rs/workers/worker-info-characters/Cargo.toml`. Bağımlılıklar `worker-info-corporations/Cargo.toml` ile aynı, artı `serde_json.workspace = true` ve `tracing.workspace = true` normal bağımlılık olarak.
- Oluştur: `backend-rs/workers/worker-info-characters/src/lib.rs` (`pub mod character;`)
- Oluştur: `backend-rs/workers/worker-info-characters/src/character.rs`
- Test: `backend-rs/workers/worker-info-characters/tests/parse.rs`, `tests/title_fields.rs`

**Arayüzler:**

- Tüketir: `esi::CompatibilityDate` (Task 1).
- Üretir (`worker_info_characters::character`):
  - `pub const CHARACTER_COMPATIBILITY_DATE: CompatibilityDate` (`"2026-06-09"`)
  - `pub struct CharacterInfo` (`Debug, Clone, Deserialize, PartialEq`):
    - Zorunlu: `name: String`, `corporation_id: i32`, `birthday: DateTime<Utc>`, `bloodline_id: i32`, `race_id: i32`, `gender: String`.
    - `#[serde(default)] Option`: `alliance_id: Option<i32>`, `security_status: Option<f64>`, `description: Option<String>`, `faction_id: Option<i32>`, `corporation_title: Option<String>`, `character_title_id: Option<serde_json::Value>`, `achievement_score: Option<serde_json::Value>`.
  - `pub struct TitleFields { pub title: Option<String>, pub character_title_id: Option<String>, pub achievement_score: Option<i32> }` (`Debug, Clone, PartialEq`)
  - `pub fn title_fields(info: &CharacterInfo) -> TitleFields`

- [ ] **Adım 1: Başarısız testleri yaz.**

  `tests/parse.rs`, corporation'daki `esi(extra)` yardımcısıyla. Zorunlu alanlar: `"name":"Test Pilot","corporation_id":98000001,"birthday":"2010-01-01T12:34:56.789Z","bloodline_id":1,"race_id":1,"gender":"male"`. Testler:
  - `only_the_required_fields_parse_with_every_optional_as_none`: bütün opsiyoneller `None`, `birthday == Utc.with_ymd_and_hms(2010,1,1,12,34,56).unwrap() + Duration::milliseconds(789)`.
  - `every_field_parses`: bütün opsiyoneller dolu, her biri beklenen değere eşit.
  - `explicit_nulls_parse_as_none`: `"alliance_id":null,"faction_id":null,"achievement_score":null` ile gelen alanların hepsi `None`.
  - `a_wrong_typed_score_does_not_fail_the_decode`: `"achievement_score":"x","character_title_id":7` ile `from_str` `Ok` döner.

  `tests/title_fields.rs`, `character-achievement.spec.ts` vakalarının portu:
  - `maps_the_new_fields_corporation_title_into_title`: `CEO` + `00851de7-b7ca-5136-871e-d07429563c06` + `1234` → üçü de aynen.
  - `writes_none_for_every_key_esi_left_out`: üçü de `None`.
  - `keeps_a_score_of_0`: `0` → `Some(0)`.
  - `keeps_an_integral_float_score`: `1.0` → `Some(1)`.
  - `drops_a_score_that_does_not_fit_an_int_column`: `2147483648` → `None`, `-1` → `None`, `2147483647` → `Some(i32::MAX)`.
  - `drops_a_fractional_or_non_numeric_score`: `1.5` → `None`, `"x"` → `None`.
  - `keeps_an_uppercase_uuid`: `00851DE7-B7CA-5136-871E-D07429563C06` → aynen `Some`.
  - `drops_a_title_id_that_is_not_a_uuid`: `"not-a-uuid"` → `None`, `7` → `None`.

- [ ] **Adım 2: Testlerin başarısız olduğunu doğrula.** `cargo test -p worker-info-characters`; derleme hatası beklenir.

- [ ] **Adım 3: `character.rs`'i yaz.** Skor `Value::as_i64()`, yoksa `as_f64()` ile `fract() == 0.0` denetimi yapılarak okunur; aralık `0..=i32::MAX`. UUID denetimi elle yapılır: uzunluk 36, tireler 8/13/18/23. konumda, geri kalan baytlarda `is_ascii_hexdigit`. `regex` kullanılmaz. Reddedilen her değer Genel kısıtlar'daki metinle `tracing::warn!` olarak loglanır; `{v}` olarak `Value`'nun `Display`'i kullanılır. Doc yorumları Node kaynağını `file:line` ile anar.

- [ ] **Adım 4: Testlerin geçtiğini doğrula.** `cargo test -p worker-info-characters`; PASS.

- [ ] **Adım 5: Commit.**

  ```bash
  git add backend-rs/workers/worker-info-characters backend-rs/Cargo.lock
  git commit -m "feat(backend-rs): character ESI shape and title field validation"
  ```

---

### Task 3: `worker-info-characters` — upsert

**Dosyalar:**

- Değiştir: `backend-rs/workers/worker-info-characters/src/character.rs`
- Oluştur: `backend-rs/workers/worker-info-characters/tests/fixtures/characters.sql`
- Test: `backend-rs/workers/worker-info-characters/tests/upsert.rs`
- Değiştir: `backend-rs/.sqlx/` (macro kullanılırsa)

**Arayüzler:**

- Tüketir: `CharacterInfo`, `title_fields` (Task 2).
- Üretir: `pub async fn upsert_character(pool: &PgPool, id: i32, info: &CharacterInfo) -> Result<bool, sqlx::Error>`. Satır yeniyse `true` döner.

- [ ] **Adım 1: Fixture'ı üret.** `corporations.sql`'in başlığındaki `pg_dump --schema-only --table=characters …` komutuyla, aynı filtreyle ve aynı başlık yorumuyla. `character_title_id uuid` kolonunun içinde olduğunu kontrol et.

- [ ] **Adım 2: Başarısız testleri yaz** (`#[sqlx::test(migrations = false, fixtures("characters"))]`, `upsert.rs`'deki `Row` ve `row()` kalıbıyla; `character_title_id` `SELECT character_title_id::text` ile okunur).
  - `a_new_character_is_inserted`: `true` döner; her kolon girdiye eşit; `birthday == info.birthday.naive_utc()` (milisaniye dahil); `updated_at >= created_at`.
  - `an_existing_character_is_updated`: ikinci çağrı `false` döner. `corporation_id`, `alliance_id`, `security_status`, `description`, `title`, `character_title_id`, `achievement_score`, `faction_id` yeni değerleri alır; `updated_at` artar.
  - `columns_written_only_on_insert_keep_their_value`: ikinci çağrıda `name`, `birthday`, `bloodline_id`, `race_id`, `gender` farklı verilir; satırda ilk değerler kalır.
  - `missing_optional_fields_clear_the_old_value`: dolu bir satırdan sonra bütün opsiyoneller `None` gönderilir; bütün opsiyonel kolonlar NULL olur.
  - `a_rejected_score_or_title_id_is_null`: `achievement_score = "x"`, `character_title_id = "nope"` ile upsert hatasız geçer; ikisi de NULL olur.
  - `an_uppercase_title_id_is_stored`: büyük harfli UUID yazılır, okunan değer küçük harfli halidir.

- [ ] **Adım 3: Testlerin başarısız olduğunu doğrula.** `cargo test -p worker-info-characters --test upsert`; derleme hatası beklenir.

- [ ] **Adım 4: `upsert_character`'ı yaz.** Spec'teki _Upsert_ maddelerini izler: INSERT bütün kolonları ve `updated_at = now()` yazar; UPDATE yalnızca spec'te sayılan 8 kolonu ve `updated_at`'i yazar; sonuç `RETURNING (xmax = 0)` ile alınır. `birthday` `naive_utc()` olarak, `character_title_id` `$n::text::uuid` olarak bağlanır. Değerler `title_fields(info)`'dan gelir. Doc yorumu, `corporation.rs:36-58`'deki notların karşılığını içerir: `name`'in update'te yazılmaması parite için korunuyor, Node'daki bir eksik.

- [ ] **Adım 5: Testlerin geçtiğini doğrula.** `cargo test -p worker-info-characters`; PASS. Macro kullanıldıysa `cargo sqlx prepare --workspace`, ardından `SQLX_OFFLINE=true cargo build --workspace` başarılı olmalı.

- [ ] **Adım 6: Commit.**

  ```bash
  git add backend-rs/workers/worker-info-characters backend-rs/.sqlx
  git commit -m "feat(backend-rs): character upsert with Node parity"
  ```

---

### Task 4: `worker-info-characters` — binary ve script

**Dosyalar:**

- Oluştur: `backend-rs/workers/worker-info-characters/src/main.rs`
- Değiştir: `backend/package.json` (`worker:info:characters` satırının hemen altı)

**Arayüzler:**

- Tüketir: `upsert_character`, `CharacterInfo`, `CHARACTER_COMPATIBILITY_DATE` (Task 2-3); `EsiClient::get_with_compatibility_date` (Task 1); `runner::{Worker, Processed, run}`.

- [ ] **Adım 1: `main.rs`'i yaz.** `worker-info-corporations/src/main.rs`'in düzeniyle `CharacterWorker { pool, esi }` tanımla. Sabitler: `QUEUE_NAME = "esi_character_info_queue"`, `PREFETCH_COUNT = 5`, `CONSUMER_TAG = "worker-info-characters-rs"`, `STARTED = "👤 character info worker started"`, `WAITING_FOR = "characters"`, `ENTITY = "character"`. `handle` önce `get_with_compatibility_date(&format!("/characters/{id}/"), CHARACTER_COMPATIBILITY_DATE)`, sonra `upsert_character` çağırır; `detail = format!(" {}", info.name)` olur. Modül başı yorumu Node dosyasını, `:rs` script'ini ve spec'teki _Log satırları_ farkını anar.

- [ ] **Adım 2: Script satırını ekle.**

  ```json
  "worker:info:characters:rs": "cargo run --release --manifest-path ../backend-rs/Cargo.toml -p worker-info-characters",
  ```

- [ ] **Adım 3: Derle ve denetle.** `cargo build -p worker-info-characters`, `cargo clippy --all-targets -- -D warnings`, `cargo fmt --check` ve `npx prettier --check backend/package.json`; hepsi temiz çıkmalı.

- [ ] **Adım 4: Commit.**

  ```bash
  git add backend-rs/workers/worker-info-characters backend/package.json
  git commit -m "feat(backend-rs): Rust character info worker"
  ```

---

### Task 5: `queue-characters`

**Dosyalar:**

- Oluştur: `backend-rs/queues/queue-characters/Cargo.toml` (`queue-corporations/Cargo.toml`'un kopyası, `name = "queue-characters"`)
- Oluştur: `backend-rs/queues/queue-characters/src/lib.rs`, `src/main.rs`
- Oluştur: `backend-rs/queues/queue-characters/tests/fixtures/characters.sql` (Task 3'teki fixture'ın kopyası), `tests/fixtures/character_rows.sql`
- Test: `backend-rs/queues/queue-characters/tests/ids.rs`
- Değiştir: `backend/package.json` (`queue:characters` satırının hemen altı)

**Arayüzler:**

- Üretir (`queue_characters`): `pub const QUEUE_NAME: &str = "esi_character_info_queue"`, `pub const SOURCE: &str = "queue-characters"`, `pub fn parse_ids(args: &[String]) -> Vec<i32>`, `pub async fn all_character_ids(pool: &PgPool) -> sqlx::Result<Vec<i32>>`.

- [ ] **Adım 1: Başarısız testleri yaz.** `queue-corporations/tests/ids.rs`'in karakter karşılığı: `parse_ids_keeps_valid_numbers`, `parse_ids_rejects_partial_numbers`, `all_ids_in_order` ve `empty_table_is_empty`. `character_rows.sql` üç karakteri sırasız ekler (`2120000003`, `2120000001`, `2120000002`) ve yalnızca NOT NULL kolonları doldurur. Beklenen sonuç `[2120000001, 2120000002, 2120000003]`.

- [ ] **Adım 2: Testlerin başarısız olduğunu doğrula.** `cargo test -p queue-characters`; derleme hatası beklenir.

- [ ] **Adım 3: `lib.rs` ve `main.rs`'i yaz.** `queue-corporations`'ın aynısı, şu farklarla: sorgu `SELECT id FROM characters ORDER BY id`, log metinleri `queue-characters.ts:30-77`'deki gibi "character" geçer, son satır `now run the worker: yarn worker:info:characters:rs`. Hata satırı `failed to queue characters: {e:#}`.

- [ ] **Adım 4: Testlerin geçtiğini doğrula.** `cargo test -p queue-characters`; PASS.

- [ ] **Adım 5: Script satırını ekle.**

  ```json
  "queue:characters:rs": "cargo run --release --manifest-path ../backend-rs/Cargo.toml -p queue-characters",
  ```

- [ ] **Adım 6: Commit.**

  ```bash
  git add backend-rs/queues/queue-characters backend/package.json backend-rs/Cargo.lock
  git commit -m "feat(backend-rs): Rust queue publisher for characters"
  ```

---

### Task 6: Yerel parite koşusu ve yol haritası

Kod değişikliği yok; spec'in _Doğrulama_ bölümündeki elle yapılan kontrol.

- [ ] **Adım 1: Tam Rust paketini çalıştır.** `backend-rs/` içinde `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings` ve `cargo test`; hepsi temiz/PASS olmalı. Ayrıca kökte `npx prettier --check backend/package.json docs/superpowers/plans/2026-11-15-rust-character-info-worker.md`.

- [ ] **Adım 2: Satır sayısını kaydet.** `psql "$DB" -c "SELECT COUNT(*) FROM characters;"` (`DB`, CLAUDE.md'deki `grep` satırıyla alınır).

- [ ] **Adım 3: Mesaj paritesi.** Worker'lar durdurulmuşken önce `yarn queue:characters <3 ID>`, sonra `yarn queue:characters:rs <aynı 3 ID>`. RabbitMQ management'ta (ya da `rabbitmqadmin get`) gövdeler `queuedAt` dışında aynı olmalı. Ardından kuyruk tüketilir.

- [ ] **Adım 4: Satır paritesi.** Aynı ID'ler önce Node worker'ıyla işlenir ve satırlar `SELECT * FROM characters WHERE id IN (…)` ile kaydedilir. Sonra aynı ID'ler Rust worker'ıyla işlenip satırlar yeniden okunur. Fark yalnızca `updated_at`'te olmalı. En az bir satırda `achievement_score` ve `character_title_id` dolu olmalı; ID'ler bu koşulu sağlayacak şekilde seçilir, örneğin ilk koşudan sonra `achievement_score IS NOT NULL` olan bir karakter.

- [ ] **Adım 5: Satır sayısını yeniden kontrol et.** Adım 2'deki sayı azalmamış olmalı.

- [ ] **Adım 6: Yol haritasını güncelle.** PR açıldıktan sonra #315'te `worker:info:characters` ve `queue:characters` satırları `[x]` yapılır, Rust crate sütununa crate yolu ve PR numarası yazılır, "Done" sayısı `6 of 75` olur.
