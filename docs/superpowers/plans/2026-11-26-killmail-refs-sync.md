# killmail_refs sync — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kullanıcı ve kurum killmail sync'i bulduklarını `killmail_refs`'e
yazsın, ayrı bir yayıncı bekleyenleri detay kuyruğuna koysun; token yenileme
kilitli ve ölü/geçici ayrımlı olsun; Node ve Rust aynı davranışla.

**Architecture:** Önce veritabanı (tablo + kolon), sonra Node tarafının
tamamı (token, refs çekirdeği, worker'lar, cron, yayıncı + timer), sonra
Rust tarafı aynı sırayla (esi/runner eklentileri, `sso` ve `killmail-refs`
lib crate'leri, iki worker, yayıncı), en son dokümanlar.

**Tech Stack:** TypeScript (Prisma 7, amqplib, axios, vitest), Rust 1.97
(sqlx 0.8, lapin 2, reqwest, wiremock), PostgreSQL, systemd.

**Spec:** `docs/superpowers/specs/2026-11-26-killmail-refs-sync-design.md`

## Global Constraints

- Hiçbir satır kaybolmaz; `prisma migrate dev` yok; migration
  `backend/prisma/CLAUDE.md` prosedürüyle (`database` agent'ı).
- Zaman damgaları UTC, uygulamadan bağlanır. Node ham SQL'de `Date` değil
  saat dilimsiz string (`'YYYY-MM-DD HH:MM:SS.mmm'`), Rust'ta
  `Utc::now().naive_utc()`. SQL'de `now()` / `CURRENT_TIMESTAMP` yok.
- Her ESI isteği `esiClient` (Node) / `EsiClient` (Rust) üzerinden; kendi
  uyku, hız sınırı ya da error-limit kontrolü yok.
- Sayfa tavanı **14**; tamamı kayıtlı sayfada dur (tam sync değilse).
- Tam sync = mesajda `fullSync: true` **ya da** işin damgası
  (`last_killmail_sync_at` / `last_corp_killmail_sync_at`) NULL.
- NPC kurumu: `1_000_000 ≤ id < 2_000_000`.
- Yayıncı seçimi: `killmails`'te yok ve (`last_queued_at IS NULL` | `queued_count < 5 AND last_queued_at < now − 1h` | `queued_count ≥ 5 AND last_queued_at < now − 24h`), `killmail_id DESC`, `LIMIT 5000`; `announce: false`, priority 5; consumer yoksa tur atlanır.
- Kuyruk adları: `esi_user_killmails_queue`, `esi_corporation_killmails_queue`, `esi_killmail_detail_queue`; `x-max-priority: 10`.
- Generated dosyalar elle düzenlenmez; Prisma client `prisma generate` ile.
- Commit mesajları İngilizce, Claude attribution yok.
- Kapsam dışı: `worker:killmail-detail`, `resolvers/killmail/mutations.ts`'teki
  `getCharacterKillmails` kullanımı, zkillboard yayıncıları,
  `users.last_*_killmail_id` / `users.corporation_id` kolonları (dokunulmaz).

## Review Focus

1. **İki worker aynı kullanıcının token'ını aynı anda yeniliyor** — yalnızca
   biri SSO'ya gitmeli, diğeri yeni token'ı okumalı; kaybeden `invalid_grant`
   ile token'ı silmemeli. Test: Task 2 `concurrent_refresh_calls_sso_once`
   (Node), Task 8 `concurrent_refresh_calls_sso_once` (Rust).
2. **SSO geçici hatası (5xx/timeout)** — kullanıcı "çıkış yapmış" sayılmamalı,
   token silinmemeli; mesaj ortak yoldan tekrar denenmeli; API'de
   `refreshSession` UNAUTHENTICATED dönmemeli. Test: Task 2
   `transient_sso_error_throws_and_keeps_token`.
3. **Sync yarıda çöker** (ör. sayfa 3'te ESI 5xx) — 1–2. sayfanın refs'i
   kalmalı, damga yazılmamalı. Test: Task 4 / Task 10
   `failure_mid_walk_keeps_refs_and_no_stamp`.
4. **Karakter `characters` tablosunda yok** (yeni login, enrichment
   gelmedi) — kurum işi hata vermemeli, damga + ack. Test: Task 4 / Task 10
   `missing_character_row_skips_corporation`.
5. **Detay worker'ı kapalı** — yayıncı sayaçları tüketmemeli. Test: Task 6 /
   Task 11 `no_consumer_skips_the_tick`.

---

### Task 1: Veritabanı — `killmail_refs` ve `users.corp_killmails_denied_at`

**Files:**

- Create: `backend/prisma/schema/killmailRef.prisma`
- Modify: `backend/prisma/schema/user.prisma` (`corp_killmails_denied_at DateTime?`)
- Create: `backend/prisma/migrations/<timestamp>_killmail_refs/migration.sql`

**Interfaces:**

- Produces: tablo `killmail_refs(killmail_id integer PK, killmail_hash text NOT NULL, source text NOT NULL, discovered_at timestamp(3) NOT NULL, queued_count integer NOT NULL DEFAULT 0, last_queued_at timestamp(3) NULL)`; index `(last_queued_at)`; `users.corp_killmails_denied_at timestamp(3) NULL`. Prisma model `KillmailRef`, `@@map("killmail_refs")`. Foreign key yok.

- [ ] **Step 1:** `database` agent'ına ver: prosedürün 1–6. adımları (satır
      sayıları önce/sonra, `migrate diff`, beş tablonun `DROP`'ları silinir,
      `migrate deploy`). Yeni ifade yalnızca `CREATE TABLE`, `CREATE INDEX`,
      `ALTER TABLE users ADD COLUMN` olmalı.
- [ ] **Step 2:** `yarn workspace backend prisma generate` ve
      `yarn workspace backend build` → temiz.
- [ ] **Step 3:** Rust fixture'larını üret (`pg_dump --schema-only`, mevcut
      fixture başlığıyla): `killmail_refs.sql`, güncel `users.sql`, `characters.sql`
      — Task 9–11 kullanır; `backend-rs/crates/killmail-refs/tests/fixtures/`.
- [ ] **Step 4: Commit** — `feat(db): killmail_refs table and users.corp_killmails_denied_at`.

### Task 2: Node token — kilit, karşılaştırmalı yazma, ölü/geçici

**Files:**

- Modify: `backend/src/services/eve-sso.ts` (`refreshAccessToken`)
- Modify: `backend/src/services/user-credentials.ts`
- Modify: `backend/src/resolvers/auth/mutations.ts` (yalnızca `refreshSession`'ın hata eşlemesi)
- Modify: `backend/src/handlers/auth-callback.handler.ts` (upsert `update`'ine `corp_killmails_denied_at: null`)
- Test: `backend/src/services/user-credentials.spec.ts`, `eve-sso` için yeni spec

**Interfaces:**

- Produces:

  ```ts
  // eve-sso.ts
  export class SsoGrantRevokedError extends Error {}   // 400 + body.error === 'invalid_grant'
  export class SsoUnavailableError extends Error {}    // ağ, 5xx, timeout, diğer 4xx
  refreshAccessToken(refreshToken): Promise<{access_token, expires_in, refresh_token?}> // yukarıdakileri fırlatır; 10 s timeout
  // user-credentials.ts
  export type UserCredentials =
    | { ok: true; user: UserSyncRow; accessToken: string; expiresAt: Date }
    | { ok: false; reason: 'not-found' | 'no-refresh-token' | 'token-revoked' };
  export async function loadUserCredentials(userId: number, client: PrismaClient): Promise<UserCredentials>;
  // SsoUnavailableError dışarı fırlar.
  ```

  Akış: kilitsiz oku → `needsRefresh` değilse dön. Gerekiyorsa
  `client.$transaction`: `SELECT … FROM users WHERE id = $1 FOR UPDATE` →
  yeniden `needsRefresh` (başkası yenilediyse onu dön) → SSO → `UPDATE … WHERE
id = $1 AND refresh_token = $eski` → commit. `SsoGrantRevokedError` →
  aynı transaction'da `refresh_token = NULL`, `{ok:false, reason:'token-revoked'}`.
  `UserSyncRow`'a `last_killmail_sync_at`, `last_corp_killmail_sync_at`
  eklenir (tam sync kararı için).
  `refreshSession`: `ok:false` → UNAUTHENTICATED (bugünkü gibi);
  `SsoUnavailableError` → `GraphQLError('SSO unavailable', {code: 'SERVICE_UNAVAILABLE'})`.

- [ ] **Step 1: Testler** (mevcut spec'in mock düzeninde; `$transaction`
      mock'u callback'i tx ile çağırır):
  - `fresh_token_needs_no_lock`: süresi uzun → `$transaction` çağrılmaz.
  - `refresh_writes_with_compare_and_swap`: UPDATE `refresh_token = eski` koşulu.
  - `concurrent_refresh_calls_sso_once`: kilitten sonra yeniden okunan satır
    taze → `refreshAccessToken` çağrılmaz, taze token döner.
  - `invalid_grant_clears_the_refresh_token`: `token-revoked`, `refresh_token = NULL`.
  - `transient_sso_error_throws_and_keeps_token`: `SsoUnavailableError`
    fırlar, UPDATE yok.
  - eve-sso: 400 `{"error":"invalid_grant"}` → `SsoGrantRevokedError`;
    503 ve ağ hatası → `SsoUnavailableError`.
  - auth callback: upsert `update`'i `corp_killmails_denied_at: null` içerir.
- [ ] **Step 2:** FAIL gör — `yarn workspace backend vitest run src/services/user-credentials.spec.ts src/services/eve-sso.spec.ts`.
- [ ] **Step 3:** Uygula.
- [ ] **Step 4:** `yarn workspace backend test`, `yarn workspace backend build`.
- [ ] **Step 5: Commit** — `fix(auth): lock token refresh, compare-and-swap the write, tell a revoked grant from an outage`.

### Task 3: Node refs çekirdeği — kayıt, sayfa okuma, gezinti

**Files:**

- Create: `backend/src/helpers/utc-timestamp.ts`, `backend/src/services/killmail-refs.ts`, `backend/src/services/killmail-walk.ts`
- Modify: `backend/src/services/character/character.service.ts`, `backend/src/services/corporation/corporation.service.ts` (yeni sayfa fonksiyonları; eski `get*Killmails` kalır)
- Test: her biri için `.spec.ts`

**Interfaces:**

- Produces:

  ```ts
  export function utcTimestamp(d: Date): string;          // '2026-11-26 10:00:00.000'
  export type RefSource = 'character' | 'corporation';
  export interface KillmailRef { killmail_id: number; killmail_hash: string }
  /** INSERT … SELECT FROM UNNEST … ON CONFLICT DO NOTHING RETURNING killmail_id */
  export async function recordRefs(refs: KillmailRef[], source: RefSource, now: Date): Promise<number>; // yeni eklenen sayısı
  export interface KillmailPage { refs: KillmailRef[]; pages: number | null } // null = X-Pages yok
  CharacterService.getKillmailPage(characterId: number, token: string, page: number): Promise<KillmailPage | null>; // 404 → null
  CorporationService.getKillmailPage(corporationId: number, token: string, characterId: number, page: number): Promise<KillmailPage | null>; // bucketKey = characterId; 403 fırlar
  export const MAX_PAGES = 14;
  export interface WalkResult { pages: number; found: number; inserted: number; capped: boolean }
  export async function walkKillmails(
    fetchPage: (page: number) => Promise<KillmailPage | null>,
    record: (refs: KillmailRef[]) => Promise<number>,
    fullSync: boolean,
  ): Promise<WalkResult>;
  ```

  Gezinti: sayfa 1..14; `null` ya da boş → dur; kaydet; `!fullSync && inserted === 0` → dur; `pages !== null && page >= pages` → dur; 14'te bitmediyse `capped: true`.

- [ ] **Step 1: Testler:**
  - utc: `2026-11-26T10:00:00.123Z` → `'2026-11-26 10:00:00.123'`.
  - recordRefs: `$executeRaw`/`$queryRaw` parametreleri (id dizisi, hash dizisi, source, utc string); boş dizide sorgu yok, 0.
  - getKillmailPage: `Authorization: Bearer`, `bucketKey`, `params.page`; `x-pages` okunur; 404 → `null`; diğer hata fırlar.
  - walk: `stops_on_a_fully_known_page`, `full_sync_ignores_known_pages`, `stops_at_x_pages`, `stops_on_404_and_empty`, `caps_at_14_pages` (`capped`), `failure_mid_walk_keeps_refs_and_no_stamp` (sayfa 3 fırlar → `record` 2 kez çağrılmış, hata dışarı).
- [ ] **Step 2:** FAIL gör.
- [ ] **Step 3:** Uygula.
- [ ] **Step 4:** İlgili spec'ler + `build`.
- [ ] **Step 5: Commit** — `feat(killmails): killmail_refs recording and the authenticated page walk`.

### Task 4: Node worker'ları

**Files:**

- Modify: `backend/src/workers/worker-esi-user-killmails.ts`, `backend/src/workers/worker-esi-corporation-killmails.ts`
- Delete: `backend/src/services/killmail-cursor.ts`, `killmail-cursor.spec.ts`; `killmail-sync-message.ts`'teki yorum referansı düzelir
- Test: `worker-esi-corporation-killmails.spec.ts` (güncellenir), yeni `worker-esi-user-killmails.spec.ts`

**Interfaces:**

- Consumes: Task 2 `loadUserCredentials`, Task 3 `walkKillmails`, `recordRefs`, `getKillmailPage`.
- Produces (test için dışa açılır):

  ```ts
  export async function syncUser(
    message: KillmailSyncMessage,
    now: Date,
  ): Promise<'synced' | 'skipped'>;
  export async function syncCorporation(
    message: KillmailSyncMessage,
    now: Date,
  ): Promise<'synced' | 'skipped' | 'denied'>;
  ```

  Kurum: `SELECT corporation_id FROM characters WHERE id = $character_id`;
  yok ya da NPC → damga, `'skipped'`. 403 → `corp_killmails_denied_at = now`,
  `'denied'` (`settleForbidden` bunu yapacak şekilde değişir). Damga her
  başarılı gezintiden sonra, liste boşken de. 10 s uyku ve
  `publishKillmailDetails` çağrısı kalkar; consumer callback'i ack/`handleWorkerError`
  ile aynı kalır. `token-revoked`/`no-refresh-token`/`not-found` → ack, atla.

- [ ] **Step 1: Testler:** her iki worker için: refs `source` doğru;
      tam sync damga NULL iken ya da `fullSync` iken; boş listede damga;
      `failure_mid_walk_keeps_refs_and_no_stamp`; ölü token → `'skipped'`,
      ESI çağrılmaz. Kurum: `missing_character_row_skips_corporation`, NPC kurumu,
      403 → `corp_killmails_denied_at` yazılır ve ack.
- [ ] **Step 2:** FAIL gör. **Step 3:** Uygula. **Step 4:** `yarn workspace backend test`, `build`.
- [ ] **Step 5: Commit** — `fix(killmails): user and corporation syncs record refs instead of publishing`.

### Task 5: Node cron

**Files:**

- Modify: `backend/src/services/killmail-sync-cron.ts` (`usersDue`, `TOKEN_BUFFER_MINUTES` kalkar)
- Test: `backend/src/services/killmail-sync-cron.spec.ts`

- [ ] **Step 1: Testler:** `findMany` `where`'i `expires_at` içermez;
      kullanıcı işinde `refresh_token: {not: null}` + bayat damga; kurum işinde
      ek olarak `corp_killmails_denied_at: null`, `corporation_id` koşulu yok.
- [ ] **Step 2–4:** FAIL → uygula → `test`, `build`.
- [ ] **Step 5: Commit** — `fix(killmails): select users by refresh token, not by access token lifetime`.

### Task 6: Node yayıncı + timer

**Files:**

- Create: `backend/src/queues/queue-killmail-refs.ts`, `queue-killmail-refs.spec.ts`
- Modify: `backend/package.json` (`queue:killmail-refs`)
- Create: `deploy/systemd/killreport-queue-killmail-refs.service`, `.timer` (`OnCalendar=*-*-* *:00/5:00 UTC`, mevcut `queue-prices` unit'lerinin kalıbında)
- Modify: `backend/src/ops/systemd-units.guard.spec.ts` (`job('queue:killmail-refs', '*-*-* *:00/5:00 UTC')`), `backend/docs/ops/systemd.md` (tablo + `enable` satırı)

**Interfaces:**

- Consumes: `skipReason`/`getQueueStats` ilk koşulu olarak yalnızca `consumerCount === 0` (mesaj bekliyor olması tur atlatmaz); `buildDetailMessage`; onaylı kanal `getRabbitMQConfirmChannel`.
- Produces: `export async function publishPendingRefs(now: Date): Promise<number>` — seçim (Global Constraints), her mesaj `buildDetailMessage(id, hash, false)`, priority 5, `waitForConfirms`, sonra `UPDATE killmail_refs SET queued_count = queued_count + 1, last_queued_at = $now WHERE killmail_id = ANY($ids)`.

- [ ] **Step 1: Testler:** `no_consumer_skips_the_tick` (SQL çağrılmaz);
      seçim SQL'inin üç dalı ve `LIMIT 5000`; `announce: false`; onay
      reddedilirse sayaç güncellenmez; boş seçimde yayın yok.
- [ ] **Step 2–4:** FAIL → uygula → `test`, `build` (guard spec dahil).
- [ ] **Step 5: Commit** — `feat(killmails): queue:killmail-refs publisher on a 5-minute timer`.

### Task 7: Rust — `esi` token'lı sayfa, `runner` `userId` ve mesaj erişimi

**Files:**

- Modify: `backend-rs/crates/esi/src/client.rs`, `lib.rs`
- Modify: `backend-rs/crates/runner/src/message.rs`, `lib.rs`, `process.rs`
- Test: `crates/esi/tests/`, `crates/runner/tests/message.rs`

**Interfaces:**

- Produces:

  ```rust
  pub struct Page<T> { pub items: Vec<T>, pub pages: Option<u32> }
  impl EsiClient {
      /// Authorization header'ı loglara ve hatalara girmez. 404 → Ok(None).
      pub async fn get_page_authed<T: DeserializeOwned>(&self, path: &str, page: u32, access_token: &str, bucket_key: &str) -> Result<Option<Page<T>>, EsiError>;
  }
  // runner
  pub struct EntityQueueMessage { pub entity_id: i32, #[serde(default, rename = "fullSync")] pub full_sync: bool }
  // alias'lar: "killmailId", "userId"
  trait Worker { fn handle_message(&self, message: &EntityQueueMessage, ctx: &Context<'_>) -> impl Future<Output = anyhow::Result<Processed>> + Send { self.handle(message.entity_id, ctx) } }
  ```

  `process_one` `handle_message`'ı çağırır; diğer worker'lar değişmez.
  403, `EsiError::Http { status: 403, .. }` olarak döner.

- [ ] **Step 1: Testler:** wiremock: header, `page`, `x-pages`, 404 → `None`, 403 → `Http{403}`, hata metninde token yok; runner: `{"userId":7,"fullSync":true}` → 7/true, `fullSync` yokken false, mevcut `entityId` testleri geçer.
- [ ] **Step 2–4:** FAIL → uygula → `cargo test` (workspace), clippy, fmt.
- [ ] **Step 5: Commit** — `feat(rust): authenticated ESI pages and userId/fullSync queue messages`.

### Task 8: Rust `crates/sso`

**Files:**

- Create: `backend-rs/crates/sso/{Cargo.toml,src/lib.rs}`, `tests/refresh.rs`, `tests/credentials.rs`, fixtures (`users.sql`)
- Modify: `backend-rs/Cargo.toml` (workspace dep)

**Interfaces:**

- Produces:

  ```rust
  pub struct SsoClient { /* reqwest, token_url, client_id, client_secret */ }
  impl SsoClient { pub fn from_env() -> anyhow::Result<Self>; pub fn with_token_url(id, secret, url) -> Self; }
  pub enum Credentials { Ok { user: SyncUser, access_token: String }, NotFound, NoRefreshToken, Revoked }
  pub struct SyncUser { pub id: i32, pub character_id: i32, pub character_name: String, pub last_killmail_sync_at: Option<NaiveDateTime>, pub last_corp_killmail_sync_at: Option<NaiveDateTime> }
  /// Node'daki akışın aynısı; geçici SSO hatası Err.
  pub async fn load_credentials(pool: &PgPool, sso: &SsoClient, user_id: i32, now: NaiveDateTime) -> anyhow::Result<Credentials>;
  ```

  Token URL `https://login.eveonline.com/v2/oauth/token`, Basic auth, form
  `grant_type=refresh_token`, 10 s timeout, yenileme eşiği 5 dakika.

- [ ] **Step 1: Testler** (`#[sqlx::test]` + wiremock): taze token SSO'suz;
      yenileme ve CAS; `concurrent_refresh_calls_sso_once` (iki `tokio::join!`,
      wiremock `expect(1)`); `invalid_grant` → `Revoked`, `refresh_token` NULL;
      503 → Err, token aynı; yanıtta `refresh_token` yoksa eskisi kalır.
- [ ] **Step 2–4:** FAIL → uygula → test, clippy, fmt.
- [ ] **Step 5: Commit** — `feat(rust): sso crate with locked token refresh`.

### Task 9: Rust `crates/killmail-refs`

**Files:**

- Create: `backend-rs/crates/killmail-refs/{Cargo.toml,src/lib.rs}`, `tests/record.rs`, `tests/walk.rs`, `tests/pending.rs`, fixtures

**Interfaces:**

- Produces:

  ```rust
  pub const MAX_PAGES: u32 = 14;
  #[derive(Deserialize, Clone)] pub struct Ref { pub killmail_id: i32, pub killmail_hash: String }
  pub async fn record(pool: &PgPool, refs: &[Ref], source: &str, now: NaiveDateTime) -> sqlx::Result<u64>; // eklenen
  pub struct Walk { pub pages: u32, pub found: usize, pub inserted: u64, pub capped: bool }
  pub async fn walk<F, Fut>(fetch: F, pool: &PgPool, source: &str, full_sync: bool, now: NaiveDateTime) -> anyhow::Result<Walk>
      where F: FnMut(u32) -> Fut, Fut: Future<Output = Result<Option<esi::Page<Ref>>, esi::EsiError>>;
  pub async fn pending(pool: &PgPool, now: NaiveDateTime) -> sqlx::Result<Vec<Ref>>;
  pub async fn mark_queued(pool: &PgPool, ids: &[i32], now: NaiveDateTime) -> sqlx::Result<u64>;
  ```

  Kurallar Task 3 ve Global Constraints ile birebir.

- [ ] **Step 1: Testler:** record çakışma; walk'ın Task 3'teki altı durumu;
      pending'in üç dalı, `killmails`'teki ref seçilmez, `LIMIT`, sıra; mark_queued.
- [ ] **Step 2–4:** FAIL → uygula → test, clippy, fmt.
- [ ] **Step 5: Commit** — `feat(rust): killmail-refs crate`.

### Task 10: Rust worker'ları

**Files:**

- Create: `backend-rs/workers/worker-user-killmails/`, `backend-rs/workers/worker-corporation-killmails/` (lib + main + tests)
- Modify: `backend/package.json` (`worker:user-killmails:rs`, `worker:corporation-killmails:rs`)

**Interfaces:**

- Consumes: Task 7, 8, 9.
- Produces: `UserKillmailWorker { pool, esi, sso }` (`QUEUE_NAME = "esi_user_killmails_queue"`, `ENTITY = "user"`), `CorporationKillmailWorker` (`"esi_corporation_killmails_queue"`); ikisi de `handle_message`'ı uygular. Davranış Task 4'le birebir; `Outcome::Updated` (sync), `Unchanged` (atlandı/denied), detail'de `found/inserted/pages`.

- [ ] **Step 1: Testler** (`#[sqlx::test]` + wiremock, SSO de mock): Task 4'ün
      bütün durumları, `failure_mid_walk_keeps_refs_and_no_stamp`,
      `missing_character_row_skips_corporation`.
- [ ] **Step 2–4:** FAIL → uygula → test, clippy, fmt.
- [ ] **Step 5: Commit** — `feat(rust): user and corporation killmail workers`.

### Task 11: Rust yayıncı

**Files:**

- Create: `backend-rs/queues/queue-killmail-refs/` (lib + main + tests)
- Modify: `backend/package.json` (`queue:killmail-refs:rs`)

**Interfaces:**

- Consumes: Task 9 `pending`, `mark_queued`; `mq::connect`, onaylı yayın; consumer sayısı `queue_declare` passive ile.
- Produces: Node yayıncısıyla aynı mesaj `{"killmailId","killmailHash","announce":false}`, priority 5.

- [ ] **Step 1: Testler:** `no_consumer_skips_the_tick` (consumer sayısını
      döndüren fonksiyon enjekte edilir); mesaj gövdesi Node'unkiyle birebir;
      yayın başarısızsa `mark_queued` çağrılmaz.
- [ ] **Step 2–4:** FAIL → uygula → test, clippy, fmt.
- [ ] **Step 5: Commit** — `feat(rust): queue-killmail-refs publisher`.

### Task 12: Dokümanlar

**Files:**

- Create: `backend/docs/workers/killmail-refs.md` (akış, tablo, seçim kuralları, bekleyenleri gösteren SQL, `:rs` script'leri)
- Modify: `backend/docs/README.md` (link)

- [ ] **Step 1:** Yaz; `npx prettier --check`, link grep'i.
- [ ] **Step 2: Commit** — `docs(killmails): killmail_refs sync`.

### Bitiş

- `qa` agent'ı arka planda tam set (cargo fmt/clippy/test, backend test/build, prettier).
- Tek final reviewer (en yetenekli model), Review Focus ile.
- Kullanıcı elle dener: kendi hesabıyla `worker:user-killmails:rs`, sonra
  `queue:killmail-refs:rs`; "merge" derse PR → CI → squash → #315'te iki satır.
