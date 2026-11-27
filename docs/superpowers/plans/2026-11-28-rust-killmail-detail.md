# Rust `worker:killmail-detail` Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Hedef:** `esi_killmail_detail_queue`'yu tüketen bir Rust worker ve onun
kullandığı, Rust redisq'in de kullanacağı ortak killmail yazıcısı. Node
yazıcısında da üç düzeltme yapılıyor.

**Mimari:** `crates/killmail-writer`, bir ESI detayını tek transaction'da yazar:
claim, victim, attacker'lar, item'lar, stats ve `killmail_filters`.
`workers/worker-killmail-detail` `runner` üzerinde çalışır: mesajı okur, detayı
`esi` ile çeker, yazıcıya verir, `announce` açıksa duyurur. Redis PUBLISH,
`sov`'dan çıkarılıp küçük bir `crates/pubsub` crate'ine taşınır.

**Teknoloji:** Rust 1.97 (sqlx 0.8, lapin 2, redis, serde, wiremock),
TypeScript (Prisma, vitest).

**Spec:** `docs/superpowers/specs/2026-11-28-rust-killmail-detail-design.md`

## Genel kısıtlar

- Kuyruk `esi_killmail_detail_queue`; mesaj `{killmailId, killmailHash, announce}`.
- Duyuru kanalı `NEW_KILLMAIL`, payload `{"killmailId":<id>}`. Discord kuyruğu
  `discord_webhook_queue`, onaylı publish.
- Rust'ın yazdığı satırlar Node `saveKillmail`'in yazdıklarıyla birebir aynı olur.
  Node'da `|| null` kullanılan kolonlarda (victim `character_id`, `alliance_id`;
  attacker `character_id`, `corporation_id`, `alliance_id`, `ship_type_id`,
  `weapon_type_id`; item `quantity_dropped`, `quantity_destroyed`) 0 → NULL olur.
  `??` kullanılanlarda (victim/attacker `faction_id`, `security_status`, `position_*`
  ve `killmail-derived.ts`'teki stats/filters girdileri) 0 korunur.
- Bütün zamanlar UTC olarak bağlanır. `kill_date`, `killmail_time`'ın UTC
  tarihidir. Varsayılanı olmayan her `updated_at` kolonuna uygulamadan UTC `now`
  bağlanır (Prisma'nın `@updatedAt`'i raw SQL'de yazılmaz).
- Bütün ESI çağrıları `esi::EsiClient` üzerinden yapılır. Kendi retry ya da rate
  limit mantığı yazılmaz.
- Dosya ve kod yorumları İngilizce, commit mesajlarında Claude attribution yok.
- Yarn kullanılır, npm değil. Generated dosyalar elle düzenlenmez.

## Review odakları

1. **Aynı killmail iki kez gelirse** (redelivery, iki kaynak): ikinci `save`
   `AlreadyStored` döner, stats bir kez artar, satır sayıları değişmez.
   → Görev 3, `second_save_is_already_stored`.
2. **`item_type_id` null olan item:** o item atlanır, geri kalanı yazılır, değer
   hesabı da onu saymaz. → Görev 3, `skips_items_without_a_type`.
3. **Tüm ID'leri null olan NPC attacker:** stats'e o attacker için satır
   eklenmez, filter dizilerinde null bulunmaz, `attacker_count` yine onu sayar.
   → Görev 3, `npc_attacker_counts_but_adds_no_ids`.
4. **Gece yarısına yakın UTC zamanı** (`23:59:59Z`): `kill_date` o gün olur,
   oturumun yerel saat dilimi devreye girmez. → Görev 3,
   `kill_date_is_the_utc_day`.
5. **Bilinmeyen solar system ya da gemi tipi:** filter satırı yine yazılır,
   `region_id`/`victim_ship_group_id` NULL kalır, sonraki bir yazımda kendini
   onarır. → Görev 3, `unknown_system_still_writes_the_filter_row`.

---

### Task 1: `crates/pubsub`, ortak Redis PUBLISH

**Dosyalar:**

- Oluştur: `backend-rs/crates/pubsub/Cargo.toml`, `backend-rs/crates/pubsub/src/lib.rs`, `backend-rs/crates/pubsub/tests/publish.rs`
- Değiştir: `backend-rs/Cargo.toml` (workspace dependency `pubsub = { path = "crates/pubsub" }`), `backend-rs/crates/sov/Cargo.toml`, `backend-rs/crates/sov/src/lib.rs:179-235`

**Arayüzler:**

- Üretir:
  ```rust
  pub struct RedisPubSub { /* redis_url: Option<String>, connection: OnceCell<MultiplexedConnection> */ }
  impl RedisPubSub {
      /// On when USE_REDIS_PUBSUB is exactly "true"; `what` names what goes
      /// unpublished in the off log line ("sovereignty alerts", "new killmails").
      pub fn from_env(what: &str) -> Self;
      pub fn new(redis_url: Option<String>) -> Self;
      pub fn is_enabled(&self) -> bool;
      /// `PUBLISH <channel> <serde_json::to_string(payload)>`; Ok(()) when disabled.
      pub async fn publish(&self, channel: &str, payload: &impl serde::Serialize) -> anyhow::Result<()>;
  }
  ```
- `sov::AlertPublisher`'ın public API'si (`from_env`, `new`, `is_enabled`,
  `publish`, `publish_all`) değişmez. İçeride bir `RedisPubSub` tutar ve
  `CHANNEL` ile `publish`'e delege eder.

- [ ] **Adım 1:** `crates/pubsub/tests/publish.rs`'e iki test yaz:
      `disabled_is_a_no_op` (`RedisPubSub::new(None)` → `!is_enabled()`,
      `publish("NEW_KILLMAIL", &json!({"killmailId":1}))` Ok) ve
      `unreachable_redis_errors` (`new(Some("redis://127.0.0.1:1"))` → `publish` Err).
- [ ] **Adım 2:** `cargo test -p pubsub` çalıştır. Crate henüz olmadığı için derleme
      hatası beklenir.
- [ ] **Adım 3:** Crate'i yaz. Bağlantı mantığı `sov/src/lib.rs:213-233`'teki
      `OnceCell` + `get_multiplexed_async_connection` aynen taşınır. Ardından
      `AlertPublisher`'ı ona delege edecek hale getir.
- [ ] **Adım 4:** `cargo test -p pubsub -p sov` çalıştır. Yeni testler ve
      `crates/sov/tests/publish.rs` değişmeden PASS olmalı.
- [ ] **Adım 5:** Commit: `refactor(rust): move Redis PUBLISH into a pubsub crate`

### Task 2: runner, mesaj alanları ve killmail publish

**Dosyalar:**

- Değiştir: `backend-rs/crates/runner/src/message.rs`, `backend-rs/crates/runner/src/publisher.rs`
- Değiştir (fake'ler): `crates/runner/tests/process.rs:192`, `workers/worker-alliance-corporations/tests/{handle,summary}.rs`, `workers/worker-character-corporation-history/tests/handle.rs`, `workers/worker-prices/tests/handle.rs`, ayrıca `EntityQueueMessage { .. }` literal'i kuran her yer (`grep -rn "EntityQueueMessage {"`)

**Arayüzler:**

- Üretir:

  ```rust
  pub struct EntityQueueMessage {
      pub entity_id: i32,           // entityId | killmailId | userId (as today)
      pub full_sync: bool,          // fullSync, default false (as today)
      #[serde(default, rename = "killmailHash")]
      pub killmail_hash: Option<String>,
      #[serde(default)]
      pub announce: bool,
  }
  // trait Publisher gains (required):
  fn publish_killmails<'a>(&'a self, queue: &'a str, source: &'static str, ids: &'a [i32])
      -> BoxFuture<'a, anyhow::Result<u64>>;
  ```

  `ChannelPublisher`, `mq::publish_killmails(&self.channel, queue, source, ids)`'i
  çağırır ve `publish` ile aynı `PublisherLost` eşlemesini uygular. Gövde
  `{"killmailId","queuedAt","source"}` olur. Node discord worker'ı yalnızca
  `killmailId` okuduğu için uyumludur.

- [ ] **Adım 1:** `message.rs` testlerine ekle:
      `parses_a_detail_message`: `{"killmailId":5,"killmailHash":"abc","announce":true}`
      → `entity_id 5, killmail_hash Some("abc"), announce true`.
      `detail_fields_default_when_absent`: `{"entityId":1}` → `killmail_hash None, announce false`.
- [ ] **Adım 2:** `cargo test -p runner message` çalıştır. FAIL beklenir (alanlar yok).
- [ ] **Adım 3:** Alanları ve trait metodunu ekle, fake'leri güncelle. Panik
      atan fake'ler (`Nobody`) yeni metotta da panik atar. Kaydeden fake'ler kendi
      biçimlerinde kaydeder.
- [ ] **Adım 4:** `cargo test --workspace` çalıştır, PASS olmalı.
      `RABBITMQ_URL=amqp://localhost cargo test -p runner publisher -- --ignored`
      RabbitMQ varsa çalıştırılır; yoksa raporda "çalıştırılmadı" denir.
- [ ] **Adım 5:** Commit: `feat(runner): killmail detail fields and killmail publish`

### Task 3: `crates/killmail-writer`

**Dosyalar:**

- Oluştur: `backend-rs/crates/killmail-writer/{Cargo.toml,src/lib.rs,src/detail.rs}`, `backend-rs/crates/killmail-writer/tests/save.rs`, `backend-rs/crates/killmail-writer/tests/fixtures/*.sql`
- Değiştir: `backend-rs/Cargo.toml` (`killmail-writer = { path = "crates/killmail-writer" }`)

**Arayüzler:**

- Tüketir: `killmail_value::{compute, type_info, Item as ValueItem}`.
- Üretir (`detail.rs`, ESI `/killmails/{id}/{hash}/` biçimi, `Deserialize`):
  ```rust
  pub struct KillmailDetail { pub killmail_id: i32, pub killmail_time: DateTime<Utc>,
      pub solar_system_id: i32, pub victim: Victim, #[serde(default)] pub attackers: Vec<Attacker> }
  pub struct Victim { pub character_id: Option<i32>, pub corporation_id: i32,
      pub alliance_id: Option<i32>, pub faction_id: Option<i32>, pub ship_type_id: i32,
      pub damage_taken: i32, pub position: Option<Position>, #[serde(default)] pub items: Vec<DetailItem> }
  pub struct Position { pub x: f64, pub y: f64, pub z: f64 }
  pub struct Attacker { pub character_id: Option<i32>, pub corporation_id: Option<i32>,
      pub alliance_id: Option<i32>, pub faction_id: Option<i32>, pub ship_type_id: Option<i32>,
      pub weapon_type_id: Option<i32>, pub damage_done: i32, pub final_blow: bool,
      pub security_status: Option<f64> }
  pub struct DetailItem { pub item_type_id: Option<i32>, pub flag: i32,
      pub quantity_destroyed: Option<i32>, pub quantity_dropped: Option<i32>, pub singleton: i32 }
  ```
  `lib.rs`:
  ```rust
  #[derive(Debug, Clone, Copy, PartialEq, Eq)]
  pub enum Saved { Written, AlreadyStored }
  /// `now` is UTC, for the updated_at columns.
  pub async fn save(pool: &PgPool, detail: &KillmailDetail, hash: &str, now: NaiveDateTime)
      -> anyhow::Result<Saved>;
  ```
- Adımlar spec'teki sırayla (`Tasarım › crates/killmail-writer`):
  1. Boş attacker listesi `bail!("killmail {id} has no attackers; refusing to write it")`.
  2. Değer: `item_type_id` null olmayan item'lar `ValueItem`'a çevrilir; `type_info`
     transaction'dan önce, havuz üzerinde çalışır.
  3. Transaction: `INSERT INTO killmails … ON CONFLICT (killmail_id) DO NOTHING
RETURNING killmail_id`; satır dönmezse rollback ve `AlreadyStored`.
  4. victim; attacker'lar ve item'lar tek `UNNEST` insert'le.
  5. Stats, tablo başına tek `INSERT … SELECT $1::date, UNNEST($2::int[]), 1 ON
CONFLICT … DO UPDATE SET kill_count = <t>.kill_count + 1` (ID'ler tekilleştirilir,
     null'lar atılır).
  6. `killmail_filters`, `killmail-filters-realtime.ts`'teki SQL ile aynı (aynı
     join'ler ve aynı `ON CONFLICT … WHERE … IS NULL`). Diziler tekilleştirilir,
     null'lar atılır.
  7. Null item sayısı > 0 ise `warn!("skipping {n} invalid items (null item_type_id) for killmail {id}")`.
- Fixture'lar `workers/worker-backfill-values/tests/fixtures/*.sql`'deki başlık
  ve `pg_dump` komutuyla üretilir, elle yazılmaz: `killmails`, `victims`,
  `attackers`, `killmail_items`, `killmail_filters`, `character_kill_stats`,
  `corporation_kill_stats`, `alliance_kill_stats`, `solar_systems`,
  `constellations`, `types`, `item_groups`, `categories`, `market_prices`. FK'si
  olan fixture, hedefinden sonra yüklenir.

- [ ] **Adım 1:** `tests/save.rs`'i yaz. `#[sqlx::test(migrations = false, fixtures(...))]`,
      ortak bir `detail()` kurucusu var: Rifter kurbanı, iki attacker (aynı corp,
      farklı karakter), bir item ve fiyatlı tipler. Testler:
  - `writes_every_table`: `Saved::Written`. `killmails` satırında
    `attacker_count = 2`, değerler `compute` sonucuna eşit (beklenen sayılar
    fixture fiyatlarından elle yazılır), `updated_at = now`; victim, 2 attacker,
    1 item; `character_kill_stats` 2 satır `kill_count 1`,
    `corporation_kill_stats` 1 satır `kill_count 1`; `killmail_filters` satırında
    `attacker_corporation_ids` tek elemanlı, `region_id` fixture'daki değer,
    `total_value` killmail ile aynı.
  - `second_save_is_already_stored`: iki `save`; ikincisi `AlreadyStored`,
    `corporation_kill_stats.kill_count` hâlâ 1, attacker satırı hâlâ 2.
  - `skips_items_without_a_type`: bir item `item_type_id: None`; item satırı 1,
    değer o item'ı saymıyor.
  - `npc_attacker_counts_but_adds_no_ids`: tüm ID'leri `None` olan üçüncü
    attacker; `attacker_count 3`, stats satır sayısı `writes_every_table` ile
    aynı, `attacker_character_ids` içinde NULL yok.
  - `zero_ids_are_stored_as_null`: victim `alliance_id Some(0)` ve attacker
    `weapon_type_id Some(0)` → kolonlar NULL; victim `faction_id Some(0)` → 0.
  - `kill_date_is_the_utc_day`: `killmail_time 2026-11-27T23:59:59Z`,
    `kill_date = 2026-11-27`.
  - `unknown_system_still_writes_the_filter_row`: `solar_system_id`'si fixture'da
    olmayan bir killmail; filter satırı var, `region_id IS NULL`.
  - `refuses_no_attackers`: `attackers: vec![]` → Err, `killmails`'te satır yok.
  - `deserializes_esi_json` (sqlx'siz `#[test]`): `attackers` anahtarı olmayan
    ve `position` olmayan gerçek biçimde bir JSON parse olur, `attackers` boş
    gelir ve `position` `None` olur.
- [ ] **Adım 2:** `cargo test -p killmail-writer` çalıştır, derleme hatası/FAIL beklenir.
- [ ] **Adım 3:** `detail.rs` ve `save`'i yaz.
- [ ] **Adım 4:** `cargo test -p killmail-writer` çalıştır, PASS olmalı.
      `cargo clippy -p killmail-writer -- -D warnings` temiz çıkmalı.
- [ ] **Adım 5:** Commit: `feat(rust): killmail-writer crate, one transaction for every derived write`

### Task 4: `workers/worker-killmail-detail` ve script

**Dosyalar:**

- Oluştur: `backend-rs/workers/worker-killmail-detail/{Cargo.toml,src/lib.rs,src/main.rs,tests/handle.rs,tests/fixtures/*.sql}` (fixture'lar Görev 3'tekilerin kopyası)
- Değiştir: `backend/package.json` (script `"worker:killmail-detail:rs": "cargo run --release --manifest-path ../backend-rs/Cargo.toml -p worker-killmail-detail"`, `worker:backfill-values:rs`'in yanına)

**Arayüzler:**

- Tüketir: `killmail_writer::{save, Saved, KillmailDetail}`, `pubsub::RedisPubSub`,
  `runner::{Worker, Context, EntityQueueMessage, Outcome, Processed}`,
  `Publisher::publish_killmails`.
- Üretir:
  ```rust
  pub struct DetailWorker { pub pool: PgPool, pub esi: EsiClient, pub pubsub: RedisPubSub }
  impl Worker for DetailWorker {
      const QUEUE_NAME = "esi_killmail_detail_queue";
      const OUTPUT_QUEUE = Some("discord_webhook_queue");
      const CONSUMER_TAG = "worker-killmail-detail-rs";
      const STARTED = "🔄 killmail detail worker started";
      const WAITING_FOR = "killmails"; const ENTITY = "killmail";
  }
  ```
  `main.rs`: `runner::run(|r| DetailWorker { pool: r.pool, esi: r.esi, pubsub: RedisPubSub::from_env("new killmails") })`.
- Davranış:
  - `handle_message`: hash yoksa `bail!("killmail {id}: message has no killmailHash")`.
    `esi.get::<KillmailDetail>(&format!("/killmails/{id}/{hash}/"))`, sonra
    `save(.., Utc::now().naive_utc())`.
  - `handle` (trait zorunlu kılıyor): her zaman aynı "no killmailHash" hatası.
  - `Written`, `announce` false: `Outcome::Saved { queued: 0 }`, detay `" killmail {id} saved"`.
  - `Written`, `announce` true: önce `pubsub.publish("NEW_KILLMAIL", &json!({"killmailId": id}))`,
    sonra `ctx.publisher().publish_killmails("discord_webhook_queue", "worker-killmail-detail", &[id])`.
    İkisinin hatası `warn!` ile loglanır ve yutulur. `queued`, onaylanan discord
    sayısıdır (0 ya da 1).
  - `AlreadyStored`: `Outcome::Unchanged`, detay `" killmail {id} (already stored)"`.
- Prefetch'e dokunulmaz, runner'ın ortak kuralı uygulanır.

- [ ] **Adım 1:** `tests/handle.rs`'i yaz. Mock ESI `workers/worker-prices/tests/handle.rs`
      düzeninde, kaydeden bir fake `Publisher` ve `RedisPubSub::new(None)` ile. Testler:
  - `saves_and_stays_quiet_without_announce`: ESI 200 → `Saved { queued: 0 }`,
    publisher'a çağrı yok, `killmails`'te satır var.
  - `announces_to_discord`: `announce: true` → `Saved { queued: 1 }`, fake
    `("discord_webhook_queue", [id])` kaydetmiş.
  - `failed_announcement_still_saves`: fake publisher Err döner →
    `Ok(Saved { queued: 0 })`, satır var.
  - `already_stored_is_unchanged`: aynı mesaj iki kez → ikincisi
    `Outcome::Unchanged`, publisher ikinci kez çağrılmamış.
  - `missing_hash_errors`: `killmail_hash: None` → Err, ESI'a istek gitmemiş
    (`server.received_requests()` boş).
  - `esi_404_errors`: ESI 404 → Err ve hata `mq::failure`'ın tanıdığı HTTP status'u
    taşıyor (diğer worker testlerindeki 404 assert'üyle aynı biçim).
- [ ] **Adım 2:** `cargo test -p worker-killmail-detail` çalıştır, FAIL beklenir.
- [ ] **Adım 3:** `lib.rs`, `main.rs` ve script'i yaz.
- [ ] **Adım 4:** `cargo test --workspace` ve `cargo clippy --workspace --all-targets -- -D warnings`
      çalıştır, ikisi de temiz olmalı. CI'daki binary/crate sayımı (`ci.yml:191`) yeni
      worker'ı kendiliğinden sayar, oraya dokunulmaz.
- [ ] **Adım 5:** Commit: `feat(rust): killmail-detail worker on the shared writer`

### Task 5: Node yazıcısındaki düzeltmeler

**Dosyalar:**

- Değiştir: `backend/src/services/killmail-writer.ts`, `backend/src/services/kill-stats-realtime.ts:41-108`, `backend/src/services/killmail-filters-realtime.ts:51-174`
- Test: `backend/src/services/killmail-writer.spec.ts`, `backend/src/services/kill-stats-realtime.spec.ts`, `backend/src/services/killmail-filters-realtime.spec.ts`

**Arayüzler:** `saveKillmail(detail, hash, options): Promise<boolean>` imzası değişmez.

- Davranış:
  - `findUnique` kaldırılır. Transaction'ın ilk adımı
    `tx.killmail.createMany({ data: [...], skipDuplicates: true })` olur
    (Prisma bunu `ON CONFLICT DO NOTHING` ile yazar ve `@updatedAt`'i doldurur).
    `count === 0` ise callback hiçbir şey yazmadan `false` döner. P2002 yakalaması
    kaldırılır.
  - Değer hesabı transaction'dan önce yapılır (bugünkü gibi).
  - `insertKillmailFilter(toFilterInput(detail), tx)` transaction'ın son adımı
    olur.
  - `updateDailyAggregatesRealtime` ve `insertKillmailFilter` içindeki
    `try/catch` yutmaları kaldırılır; hata yukarı çıkar.
  - Publish (`NEW_KILLMAIL`, discord) yalnızca `true` dönen yolda ve commit'ten
    sonra yapılır (bugünkü gibi).
  - `repair-killmail-derived.ts` değişmez. Filter insert'ü artık throw ettiği için
    onun transaction'ı rollback olur; read-back kontrolü ikinci bir koruma olarak
    kalır. `repair-killmail-derived.spec.ts` değişmeden geçmelidir.

- [ ] **Adım 1:** Spec'leri güncelle:
  - `killmail-writer.spec.ts`:
    - "the existence check" ve "a second writer that got there first" yerine
      `it('returns false and writes nothing more when createMany skips the duplicate')`:
      `createMany` `{count: 0}` döner; victim/attacker/filter çağrısı yok, publish yok.
    - "writes the filter row after the transaction" yerine
      `it('writes the filter row inside the transaction, with tx')`:
      `insertKillmailFilter` ikinci argüman olarak `tx` ile çağrılmış.
    - "still reports the killmail as saved when the filter row is lost" yerine
      `it('rejects when the filter row fails, and announces nothing')`.
  - `kill-stats-realtime.spec.ts:173` yerine
    `it('rethrows a database error so the transaction fails')`.
  - `killmail-filters-realtime.spec.ts`: hatanın yutulduğunu assert eden test
    varsa, `rejects` olarak çevrilir.
- [ ] **Adım 2:** `yarn workspace backend test src/services` çalıştır. Yeni
      testler FAIL olmalı.
- [ ] **Adım 3:** Üç dosyayı değiştir.
- [ ] **Adım 4:** `yarn workspace backend test` ve `yarn workspace backend build`
      çalıştır, ikisi de PASS olmalı (repair spec'i dahil).
- [ ] **Adım 5:** Commit: `fix(killmails): claim first, filter row inside the transaction, no swallowed errors`

### Task 6: Dokümanlar

**Dosyalar:**

- Değiştir: `backend/docs/esi/esi-user-killmail-sync.md` (bölüm 4 ve dosya tablosu, satır ~97 ve ~192)

- [ ] **Adım 1:** Bölüm 4'e Rust worker'ı ve `yarn worker:killmail-detail:rs`'i ekle.
      Yazıcının tek transaction'da yazdığı tabloları ve `announce` davranışını
      anlat. Dosya tablosuna `backend-rs/workers/worker-killmail-detail/` ve
      `backend-rs/crates/killmail-writer/` satırlarını ekle (göreli linklerle).
- [ ] **Adım 2:** `npx prettier --check` çalıştır. CLAUDE.md'deki link grep'iyle
      yeni linklerin çözüldüğünü doğrula.
- [ ] **Adım 3:** Commit: `docs: Rust killmail-detail worker`

Merge'den sonra (plan dışı, merge adımının parçası): #315'te `worker:killmail-detail`
satırı işaretlenir.
