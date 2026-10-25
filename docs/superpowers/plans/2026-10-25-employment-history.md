# Karakter Employment History sekmesi — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Hedef:** Karakter detay sayfasına, karakterin bulunduğu corporation'ları oyundaki biçimle listeleyen bir Employment History sekmesi eklemek.

**Mimari:** ESI `/characters/{id}/corporationhistory/` → haftalık enrichment queue script'i → tek worker → `character_corporation_history` tablosu. Okuma: Redis önbellekli düz fonksiyon servis → üst seviye `characterCorporationHistory` sorgusu → sekme aktifken çalışan Apollo sorgusu → sunum bileşeni.

**Teknoloji:** Prisma (elle yazılmış migration), RabbitMQ (amqplib), GraphQL Yoga + codegen, Redis (ioredis), Next.js App Router, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-25-employment-history-design.md`

**Branch:** `feat/character-employment-history`

## Genel kısıtlar

- `prisma migrate dev` / `migrate reset` yok. Migration: `migrate diff` → beş yönetilmeyen tablonun `DROP`'larını sil → `migrate deploy`. Satır sayıları önce/sonra.
- Yarn, npm değil. Generated dosyalar elle düzenlenmez.
- Worker ve queue script'i `@services/prisma-worker`; servis ve resolver `@services/prisma`.
- Kuyruk adı `esi_character_corporation_history_queue`, `ALL_QUEUES`'a eklenir (declaration `x-max-priority: 10` oradan gelir; `assertQueue` elle çağrılmaz).
- Resolver ve servis ESI çağırmaz.
- Backend adları `CharacterCorporationHistory`; "Employment History" yalnızca sekme başlığı ve `EmploymentHistoryList` bileşeni.
- Haftalık iş eşiği **6 gün**; servis önbelleği anahtarı `character:corporation-history:{characterId}`, TTL **7200** sn.
- Sıralama `start_date DESC, record_id DESC`. NPC corp'lar dahil hiçbir satır gizlenmez.
- Tarih `YYYY.MM.DD HH:mm` UTC (`formatEveDateTime`, `frontend/src/utils/date.ts:116`), gün sayısı aşağı yuvarlanır.
- Commit mesajları İngilizce, `type(scope):` sonrası küçük harf, Claude atfı yok.

## İnceleme odağı

1. **Geçmişi hiç çekilmemiş karakter** → sorgu `[]` döner, sekme boş durum metni gösterir (Görev 5 ve 6 testleri).
2. **Corporation veritabanında yok** → `corporation: null`; satırda corp ID'si link olmadan yazılır (Görev 6 testi).
3. **Aynı `start_date`'li iki kayıt** → `record_id` büyük olan üstte, bitiş tarihleri tutarlı (Görev 5 testi).
4. **ESI yanıtında `is_deleted` yok** → `false` yazılır, `(Closed)` görünmez (Görev 2 testi).
5. **Bugünkü corp** → `endDate: null`, "to this day", gün sayısı şimdiye göre (Görev 5 ve 6 testleri).

---

### Görev 1: Prisma modeli ve migration

**Dosyalar:**

- Oluştur: `backend/prisma/schema/characterCorporationHistory.prisma`
- Oluştur: `backend/prisma/migrations/<UTC zaman damgası>_character_corporation_history/migration.sql`

**Arayüzler:**

- Üretir: Prisma modeli `CharacterCorporationHistory` (`prismaWorker.characterCorporationHistory`), alanlar spec §3'teki gibi: `record_id BigInt @id`, `character_id Int`, `corporation_id Int`, `start_date DateTime`, `is_deleted Boolean @default(false)`, `fetched_at DateTime`, `@@index([character_id])`, `@@map("character_corporation_history")`.

Bu görevi `database` agent'ına ver.

- [ ] **Adım 1:** Beş yönetilmeyen tablonun (`killmail_filters`, `character_kill_stats`, `corporation_kill_stats`, `alliance_kill_stats`, `refresh_log`) satır sayılarını kaydet.
- [ ] **Adım 2:** Model dosyasını yaz, `npx prisma migrate diff --from-config-datasource prisma.config.ts --to-schema prisma/schema --script > /tmp/diff.sql`.
- [ ] **Adım 3:** Çıktıdan yalnızca `character_corporation_history` tablosunu ve index'ini oluşturan ifadeleri migration dosyasına al. Doğrula: `grep -n "^[^-]*DROP" backend/prisma/migrations/*_character_corporation_history/migration.sql` boş.
- [ ] **Adım 4:** `npx prisma migrate deploy && npx prisma generate`. Beklenen: migration uygulandı.
- [ ] **Adım 5:** Adım 1'deki sayıları tekrar al; hiçbiri azalmamış olmalı. `psql "$DB" -c '\d character_corporation_history'` tabloyu ve `character_id` index'ini gösterir.
- [ ] **Adım 6:** Commit: `feat(characters): add the character_corporation_history table`

---

### Görev 2: ESI çağrısı ve yazıcı

**Dosyalar:**

- Değiştir: `backend/src/services/character/character.service.ts` (sınıfa yeni static metot)
- Oluştur: `backend/src/services/character/character-corporation-history-writer.ts`
- Test: `backend/src/services/character/character-corporation-history-writer.spec.ts`

**Arayüzler:**

- Üretir:

  ```ts
  // character.service.ts
  export interface EsiCorporationHistoryRecord {
    corporation_id: number;
    record_id: number;
    start_date: string;
    is_deleted?: boolean;
  }
  static getCorporationHistory(characterId: number): Promise<EsiCorporationHistoryRecord[]>
  // esiRateLimiter.execute + axios.get(`${ESI_BASE_URL}/characters/${id}/corporationhistory/`), getCharacterInfo gibi

  // character-corporation-history-writer.ts (prismaWorker kullanır)
  export async function saveCorporationHistory(
    characterId: number,
    records: EsiCorporationHistoryRecord[],
    fetchedAt: Date,
  ): Promise<void>
  export async function findMissingCorporationIds(ids: number[]): Promise<number[]>
  ```

- [ ] **Adım 1: Başarısız testleri yaz** (`vi.mock('@services/prisma-worker')`, `$transaction` mock'u aldığı diziyi çalıştırır/kaydeder):
  - `saveCorporationHistory` her kayıt için `record_id`'yi `BigInt` olarak anahtar alan bir upsert üretir; `create` ve `update` içinde `corporation_id`, `start_date: new Date(...)`, `fetched_at: fetchedAt` var.
  - `is_deleted` alanı olmayan kayıt `is_deleted: false` ile, `is_deleted: true` olan `true` ile yazılır.
  - Upsert'lerin ardından aynı transaction'da `updateMany({ where: { character_id }, data: { fetched_at: fetchedAt } })` çağrılır.
  - `findMissingCorporationIds([1, 2, 2, 3])`, `corporation.findMany` `[{id: 2}]` döndüğünde `[1, 3]` döner (tekilleştirilmiş); boş dizi verilirse veritabanına gitmeden `[]` döner.
- [ ] **Adım 2:** `yarn workspace backend vitest run src/services/character/character-corporation-history-writer.spec.ts` — FAIL (modül yok).
- [ ] **Adım 3:** Metodu ve iki fonksiyonu yaz; yazımlar tek `prismaWorker.$transaction([...])` içinde.
- [ ] **Adım 4:** Aynı komut — PASS.
- [ ] **Adım 5:** Commit: `feat(characters): fetch and store a character's corporation history`

---

### Görev 3: Kuyruk ve worker

**Dosyalar:**

- Değiştir: `backend/src/services/queue-names.ts` (`ALL_QUEUES`, "ESI info workers" grubu)
- Oluştur: `backend/src/workers/worker-character-corporation-history.ts`
- Test: `backend/src/workers/worker-character-corporation-history.spec.ts`
- Değiştir: `backend/package.json` (`"worker:character-corporation-history": "tsx src/workers/worker-character-corporation-history.ts"`)
- Değiştir: `backend/src/resolvers/worker/helpers.ts` (`QUEUE_WORKER_MAP`: `['worker:character-corporation-history', 'worker-character-corporation-history']`)
- Değiştir: `ecosystem.config.js` (`worker-characters` girdisinin kopyası, ad `worker-character-corporation-history`)

**Arayüzler:**

- Tüketir: Görev 2'deki `CharacterService.getCorporationHistory`, `saveCorporationHistory`, `findMissingCorporationIds`.
- Üretir:
  ```ts
  export const QUEUE_NAME = 'esi_character_corporation_history_queue';
  export async function processCharacter(
    channel: amqp.Channel,
    characterId: number,
  ): Promise<{ records: number; missingCorporations: number }>;
  ```
  `processCharacter`: ESI'den çek → `saveCorporationHistory(id, records, new Date())` → eksik corp ID'lerini `esi_corporation_info_queue`'ya `{ entityId, queuedAt, source: 'worker-character-corporation-history' }` ve `{ persistent: true }` ile gönder.

Worker gövdesi `worker-info-characters.ts`'in kopyası (yeniden bağlanma döngüsü, `PREFETCH_COUNT = 5`, `handleWorkerError` ile hata yönetimi); fark: başlatma `if (require.main === module)` arkasında, böylece test import edebilir (`worker-esi-corporation-killmails.ts:310` gibi).

- [ ] **Adım 1: Başarısız testleri yaz** (`worker-esi-corporation-killmails.spec.ts`'teki `vi.hoisted` + `vi.mock` kalıbı; `CharacterService`, writer, logger, rabbitmq mock):
  - Üç kayıt, biri eksik corp: `saveCorporationHistory` `(42, records, any Date)` ile çağrılır; `channel.sendToQueue` tam bir kez `'esi_corporation_info_queue'` ve `entityId` eksik ID olan bir mesajla çağrılır; dönüş `{ records: 3, missingCorporations: 1 }`.
  - Eksik corp yoksa `sendToQueue` çağrılmaz.
  - `getCorporationHistory` hata fırlatırsa `saveCorporationHistory` çağrılmaz ve hata yukarı fırlar (yönetimi `handleWorkerError`'a kalır).
- [ ] **Adım 2:** `yarn workspace backend vitest run src/workers/worker-character-corporation-history.spec.ts` — FAIL.
- [ ] **Adım 3:** Worker'ı, kuyruk adını, script'i, `QUEUE_WORKER_MAP` ve PM2 girdisini ekle.
- [ ] **Adım 4:** Aynı komut — PASS. `yarn workspace backend vitest run src/resolvers/worker/helpers.spec.ts` — PASS.
- [ ] **Adım 5:** Commit: `feat(workers): add the character corporation history worker`

---

### Görev 4: Haftalık queue script'i

**Dosyalar:**

- Oluştur: `backend/src/queues/queue-character-corporation-history.ts`
- Değiştir: `backend/package.json` (`"queue:character-corporation-history": "tsx src/queues/queue-character-corporation-history.ts"`)
- Değiştir: `ecosystem.config.js` (`queue-characters` girdisinin kopyası; ad `queue-character-corporation-history`, `cron_restart: '0 3 * * 1'`, `autorestart: false`)
- Değiştir: `backend/docs/ops/pm2.md` (Scheduled Tasks bölümüne girdi; genel bakıştaki sayıları güncelle)

**Arayüzler:**

- Tüketir: Görev 3'teki `QUEUE_NAME` (kendi sabitini tanımlar, CLAUDE.md: her script kuyruk adını sabit olarak taşır).
- Üretir: `yarn queue:character-corporation-history [id ...]`.

Davranış `queue-characters.ts` gibi: argüman varsa o ID'ler; yoksa `prismaWorker.$queryRaw` ile şu seçim:

```sql
SELECT c.id FROM characters c
LEFT JOIN (
  SELECT character_id, MAX(fetched_at) AS fetched_at
  FROM character_corporation_history GROUP BY character_id
) h ON h.character_id = c.id
WHERE h.fetched_at IS NULL OR h.fetched_at < NOW() - INTERVAL '6 days'
ORDER BY c.id
```

Mesaj `{ entityId, queuedAt, source: 'queue-character-corporation-history' }`, `{ persistent: true }`, öncelik verilmez.

- [ ] **Adım 1:** Script'i, package script'ini, PM2 girdisini ve dokümanı yaz.
- [ ] **Adım 2: Gerçek veritabanıyla doğrula.** `cd backend && yarn queue:character-corporation-history 95465499`, sonra `yarn worker:character-corporation-history` (birkaç saniye, Ctrl+C). Beklenen: `SELECT corporation_id, record_id, start_date FROM character_corporation_history WHERE character_id = 95465499 ORDER BY start_date DESC` → `98221968 / 109299958 / 1000171`, üçünde aynı `fetched_at`.
- [ ] **Adım 3: Seçimi doğrula** (kuyruğa atmadan): yukarıdaki SQL'i `psql` ile `COUNT(*)` olarak çalıştır. Beklenen: 120.415'ten bir eksik (95465499 artık taze).
- [ ] **Adım 4:** `npx prettier --check backend/docs/ops/pm2.md ecosystem.config.js`.
- [ ] **Adım 5:** Commit: `feat(queues): queue characters whose corporation history is stale`

---

### Görev 5: Okuma servisi ve GraphQL

**Dosyalar:**

- Oluştur: `backend/src/services/character/character-corporation-history.service.ts`
- Test: `backend/src/services/character/character-corporation-history.service.spec.ts`
- Değiştir: `backend/src/services/character/index.ts` (`export * as CharacterCorporationHistoryService from './character-corporation-history.service';`)
- Oluştur: `backend/src/schemas/CharacterCorporationHistory.graphql` (spec §5'teki şema aynen)
- Oluştur: `backend/src/resolvers/character/corporation-history.ts`
- Değiştir: `backend/src/resolvers/character/index.ts`, `backend/src/resolvers/index.ts`

**Arayüzler:**

- Üretir:

  ```ts
  export interface CorporationHistoryRow {
    recordId: number;
    corporationId: number;
    startDate: string; // ISO
    endDate: string | null; // ISO
    isDeleted: boolean;
  }
  export async function getCorporationHistory(
    characterId: number,
  ): Promise<CorporationHistoryRow[]>;
  ```

  Resolver'lar: `characterCorporationHistoryQueries: QueryResolvers` (`characterCorporationHistory`) ve `characterCorporationHistoryFields: CharacterCorporationHistoryResolvers` (`corporation` → `context.loaders.corporation.load(parent.corporationId)`, yoksa `null`, `date_founded` dönüşümü `character/fields.ts:9-21` gibi). `index.ts`'te `Query`'ye yayılır, `CharacterCorporationHistory: characterCorporationHistoryFields` olarak eklenir. `corporationId` şemada olduğu için parent üzerinden tipli okunur; codegen `mappers` gerekmiyor.

- [ ] **Adım 1: Başarısız testleri yaz** (`@services/prisma` ve `@services/redis` mock):
  - Önbellekte varsa `JSON.parse` edilmiş değer döner, `findMany` çağrılmaz.
  - Önbellek boşsa `findMany` `{ where: { character_id }, orderBy: [{ start_date: 'desc' }, { record_id: 'desc' }] }` ile çağrılır; sonuç `setex('character:corporation-history:42', 7200, ...)` ile yazılır.
  - Üç satır (en yeni ilk): ilkinin `endDate`'i `null`, ikincisininki ilkinin `startDate`'i, üçüncününkü ikincinin `startDate`'i; `recordId` `number` tipinde (`BigInt` değil).
  - Aynı `start_date`'li iki satırda `endDate` zinciri yine sıradaki satırdan gelir.
  - Satır yoksa `[]` döner (ve `[]` önbelleğe yazılır).
- [ ] **Adım 2:** `yarn workspace backend vitest run src/services/character/character-corporation-history.service.spec.ts` — FAIL.
- [ ] **Adım 3:** Servisi, şemayı, resolver'ları yaz; `yarn workspace backend codegen`.
- [ ] **Adım 4:** Aynı test — PASS; `yarn workspace backend test` ve `yarn workspace backend build` — PASS.
- [ ] **Adım 5: GraphQL ile doğrula** (backend çalışırken):
  ```graphql
  {
    characterCorporationHistory(characterId: 95465499) {
      recordId
      corporationId
      startDate
      endDate
      isDeleted
      corporation {
        name
      }
    }
  }
  ```
  Beklenen: üç satır, `endDate`'ler `null`, `2026-06-05T14:57:00.000Z`, `2015-03-24T11:44:00.000Z`.
- [ ] **Adım 6:** Commit: `feat(characters): expose characterCorporationHistory`

---

### Görev 6: Frontend sekmesi

**Dosyalar:**

- Oluştur: `frontend/src/graphql/CharacterCorporationHistory.graphql`
- Oluştur: `frontend/src/utils/employmentDays.ts`, test `frontend/src/utils/employmentDays.spec.ts`
- Oluştur: `frontend/src/components/EmploymentHistoryList/EmploymentHistoryList.tsx`, test `EmploymentHistoryList.spec.tsx`
- Değiştir: `frontend/src/app/characters/[id]/page.tsx` (`TabType`, `TAB_IDS`, `TAB_LABELS`, sorgu, panel)

**Arayüzler:**

- Tüketir: Görev 5'in sorgusu → `useCharacterCorporationHistoryQuery` (`yarn workspace frontend codegen` sonrası).
- Üretir:
  ```ts
  export const employmentDays = (startDate: string, endDate: string | null, now: Date = new Date()): number
  // Math.floor((end - start) / 86_400_000); end yoksa now
  export default function EmploymentHistoryList(props: {
    entries: CharacterCorporationHistoryQuery['characterCorporationHistory'];
    now?: Date;
  })
  ```

Sorgu belgesi: `characterCorporationHistory(characterId: $characterId) { recordId startDate endDate isDeleted corporationId corporation { id name } }`.

- [ ] **Adım 1: Başarısız testleri yaz.**
  - `employmentDays('2022-09-18T09:56:00Z', '2026-01-17T18:13:00Z')` → `1217`; `('2007-04-30T17:47:00Z', '2007-05-15T18:38:00Z')` → `15`; `('2026-10-24T12:00:00Z', null, new Date('2026-10-25T11:59:00Z'))` → `0`.
  - `EmploymentHistoryList`: Kenshin satırı `Kenshin.` metinli, `href="/corporations/98148202"` olan bir link, `2022.09.18 09:56` ve `2026.01.17 18:13` `<b>` içinde, `(1217 Days)`.
  - `isDeleted: true` satırında `(Closed)` var, diğerlerinde yok.
  - `endDate: null` satırında `to this day` var.
  - `corporation: null` satırında link yok, metin `corporationId` (ör. `1024623120`).
  - `entries: []` → boş durum metni `No employment history yet.`
- [ ] **Adım 2:** `yarn workspace frontend vitest run src/utils/employmentDays.spec.ts src/components/EmploymentHistoryList` — FAIL.
- [ ] **Adım 3:** Util'i ve bileşeni yaz; tarih için `formatEveDateTime`. Sayfada `TabType`'a `'employment'`, `TAB_IDS` sonuna, etiket `Employment History`; sorgu `skip: activeTab !== 'employment'`; panel diğer panellerin `role="tabpanel"` / `id="panel-employment"` / `aria-labelledby="tab-employment"` kalıbında, yüklenirken `Loader`.
- [ ] **Adım 4:** Aynı testler — PASS. Ardından `yarn workspace frontend test`, `yarn workspace frontend typecheck`, `yarn workspace frontend lint` (sayı `main` ile karşılaştırılır, değişen dosyalarda yeni girdi yok), `yarn workspace frontend build:check` (dev sunucusu çalışıyorsa `build` değil).
- [ ] **Adım 5:** Commit: `feat(characters): add the employment history tab`

---

### Görev 7: Son doğrulama ve PR

- [ ] **Adım 1:** Tam seti `qa` agent'ına arka planda ver: `yarn test`, backend `build` ve `codegen`, frontend `codegen`, `lint`, `build:check`, `npx prettier --check` değişen dosyalar üzerinde.
- [ ] **Adım 2:** Kullanıcıya bakması gereken yeri söyle: `/characters/95465499?tab=employment` ve kendi karakteri.
- [ ] **Adım 3:** Spec ve plan dahil push, PR (İngilizce, `#195/#196` gibi düzyazı bölümler).
