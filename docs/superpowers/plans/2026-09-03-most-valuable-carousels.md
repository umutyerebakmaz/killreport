# Most Valuable Carousels + `killmail_filters` Tamiri — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `killmail_filters` tablosundaki boş `region_id`/`constellation_id` kolonlarını
onarmak, tabloya `victim_ship_group_id` ve `total_value` eklemek, ve killmails sayfasına
tek sorguyla beslenen bağımsız bir sekmeli "Most Valuable" carousel'ı koymak.

**Architecture:** Üç iş. İş 1 tabloyu elle yazılmış bir migration ve `insertKillmailFilter`
düzeltmesiyle onarır. İş 3, aynı ingest yolunda iki küçük düzeltme yapar. İş 2, onarılmış
tablo üzerinde tek indeksli sorguyla çalışan `mostValuableKillmails` sorgusunu ve onu
tüketen bağımsız `MostValuableCarousel` bileşenini kurar.

**Tech Stack:** GraphQL Yoga + graphql-codegen, Prisma 7 (`$queryRaw` / `$executeRaw`),
PostgreSQL, Redis, Next.js App Router + Apollo Client, Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-02-most-valuable-carousels-design.md`

## Global Constraints

- **Test koşucusu yoktur.** Bu depoda hiçbir workspace'te test dosyası veya test
  komutu yok. Bu planda her görevin "testi", çalıştırılıp çıktısı okunacak somut bir
  doğrulama komutudur: `psql` sorgusu, GraphQL sorgusu veya derleme komutu. Adımı
  atlamak yasaktır; çıktı okunmadan görev tamamlanmış sayılmaz.
- **Yarn, asla npm.** `yarn install`, `yarn add`, `yarn workspace <ws> <script>`.
- **`prisma migrate dev` yasak** — `yarn prisma:migrate` de onun takma adıdır.
  Yalnızca `npx prisma migrate deploy` kullanılır. Gerekçe: `killmail_filters`,
  `character_kill_stats`, `corporation_kill_stats`, `alliance_kill_stats` ve
  `refresh_log` tabloları `prisma/schema/` altında tanımlı değildir; `migrate dev`
  bunları drift sayıp düşürmeyi teklif eder.
- **Veri kaybı yasak.** Hiçbir migration'da `DROP TABLE`, `DROP COLUMN`, `DELETE` veya
  `TRUNCATE` bulunmayacak. Yalnızca `ADD COLUMN`, `UPDATE`, `CREATE INDEX`.
- **Üretilmiş dosyalar elle düzenlenmez:** `backend/src/generated-types.ts`,
  `backend/src/generated-schema.graphql`, `frontend/src/generated/graphql.ts`.
  Kaynak `.graphql` değiştirilip codegen çalıştırılır.
- **Codegen sırası:** önce `yarn workspace backend codegen`, sonra
  `yarn workspace frontend codegen`. Frontend, backend'in ürettiği şemayı okur.
- **İki Prisma istemcisi:** resolver ve servisler `@services/prisma` (5 bağlantı),
  worker'lar `@services/prisma-worker` (2 bağlantı). Karıştırmak havuzu tüketir.
- **`.env` düzenlenmez.** Değişiklik gerekiyorsa kullanıcıya hangi satır olduğu söylenir.
- **Commit mesajları İngilizce**, Claude atıfsız (`Co-Authored-By` yok, "Generated with"
  yok).
- **Dal:** `feature/most-valuable-carousels`.
- **Tarayıcı sürülmez.** Görsel doğrulama kullanıcıya aittir.

## Dosya Yapısı

**Oluşturulacak:**

| Dosya                                                                             | Sorumluluk                                                 |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `backend/prisma/migrations/<ts>_killmail_filters_repair_and_enrich/migration.sql` | İki kolon, dört backfill, iki index                        |
| `backend/src/config/ship-groups.ts`                                               | Structure / capsule / capital grup ID kümeleri             |
| `backend/src/schemas/MostValuable.graphql`                                        | `MostValuableScope` enum + `mostValuableKillmails` sorgusu |
| `backend/src/services/killmail/most-valuable.service.ts`                          | Tek tabloda tek sorgu + Redis                              |
| `frontend/src/graphql/MostValuableKillmails.graphql`                              | Kartın kullandığı alanlar, `attackers` yok                 |
| `frontend/src/components/MostValuableCarousel/MostValuableCarousel.tsx`           | Sekmeler, kaydırma, kendi veri çekmesi                     |

**Değiştirilecek:**

| Dosya                                               | Değişiklik                                           |
| --------------------------------------------------- | ---------------------------------------------------- |
| `backend/src/services/killmail-filters-realtime.ts` | Join'den türetme, arayüz, `DO UPDATE`                |
| `backend/src/workers/worker-backfill-values.ts`     | `killmail_filters.total_value` senkronu              |
| `backend/src/workers/worker-redisq-stream.ts`       | `data.esi` kullanımı, `faction_id`                   |
| `backend/src/services/killmail/index.ts`            | Yeni servisi dışa aktar                              |
| `backend/src/resolvers/killmail/queries.ts`         | `mostValuableKillmails` resolver'ı                   |
| `backend/src/config/cache.ts`                       | `PUBLIC_CACHE_QUERIES` + `TTL_PER_SCHEMA_COORDINATE` |
| `frontend/src/app/killmails/page.tsx`               | Carousel mantığının tamamı çıkar                     |

**Silinecek:**

| Dosya                                                           | Gerekçe                                                  |
| --------------------------------------------------------------- | -------------------------------------------------------- |
| `frontend/src/components/KillmailCarousel/KillmailCarousel.tsx` | Yerini `MostValuableCarousel` alır; başka tüketicisi yok |

---

# İş 1 — `killmail_filters` tamiri ve zenginleştirmesi

### Task 1: Migration — iki kolon, backfill, index

**Files:**

- Create: `backend/prisma/migrations/<timestamp>_killmail_filters_repair_and_enrich/migration.sql`

**Interfaces:**

- Consumes: —
- Produces: `killmail_filters` tablosunda `victim_ship_group_id INT` ve
  `total_value DOUBLE PRECISION` kolonları; dolu `region_id`, `constellation_id`,
  `security_status`, `security_class`. Task 2, 3 ve 6 bunlara dayanır.

- [ ] **Step 1: Migration öncesi satır sayılarını kaydet**

Beş korumasız tablonun tamamı sayılır. Bu sayılar Step 6’da birebir karşılaştırılacak.

```bash
cd backend
DB=$(grep -m1 '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
psql "$DB" -c "
SELECT 'killmail_filters' AS t, count(*) FROM killmail_filters
UNION ALL SELECT 'character_kill_stats',   count(*) FROM character_kill_stats
UNION ALL SELECT 'corporation_kill_stats', count(*) FROM corporation_kill_stats
UNION ALL SELECT 'alliance_kill_stats',    count(*) FROM alliance_kill_stats
UNION ALL SELECT 'refresh_log',            count(*) FROM refresh_log;"
```

Çıktıyı bir yere not et. Canlı ingest çalışıyorsa `killmail_filters` sayısı artabilir;
**azalamaz.** Karşılaştırma ölçütü budur.

- [ ] **Step 2: NULL sayılarını kaydet**

```bash
psql "$DB" -c "
SELECT count(*) FILTER (WHERE region_id IS NULL)        AS null_region,
       count(*) FILTER (WHERE constellation_id IS NULL) AS null_constellation,
       count(*) FILTER (WHERE security_status IS NULL)  AS null_secstatus,
       count(*) AS total
FROM killmail_filters;"
```

Beklenen mertebe: ~37.781 null_region, ~37.781 null_constellation, ~116 null_secstatus.

- [ ] **Step 3: Migration dosyasını yaz**

```bash
cd backend
mkdir -p prisma/migrations/$(date -u +%Y%m%d%H%M%S)_killmail_filters_repair_and_enrich
```

Oluşan dizine `migration.sql` olarak:

```sql
-- killmail_filters: repair NULL location columns and add two derived columns.
--
-- region_id and constellation_id have been NULL on every row written since the
-- materialized view became a real table (migration 20260226000000): the join that
-- derived them was not carried into insertKillmailFilter, which expects them from
-- callers that never pass them. 37,781 of 44,493 rows were affected.
--
-- victim_ship_group_id and total_value are new. They let a scope-and-value query run
-- against this table alone, without joining types or killmails.
--
-- This migration only adds columns, fills columns and creates indexes. It drops
-- nothing and deletes nothing; row counts are unchanged.

ALTER TABLE killmail_filters
  ADD COLUMN IF NOT EXISTS victim_ship_group_id INT,
  ADD COLUMN IF NOT EXISTS total_value          DOUBLE PRECISION;

-- Location and security, derived the way the original materialized view did.
-- Runs over every row and is idempotent.
UPDATE killmail_filters f
SET constellation_id = ss.constellation_id,
    region_id        = c.region_id,
    security_status  = ss.security_status,
    security_class   = ss.security_class
FROM solar_systems ss
LEFT JOIN constellations c ON c.constellation_id = ss.constellation_id
WHERE ss.system_id = f.solar_system_id;

-- Victim ship group. A type's group never changes, so this needs no later sync.
UPDATE killmail_filters f
SET victim_ship_group_id = t.group_id
FROM types t
WHERE t.id = f.victim_ship_type_id;

-- Cached ISK value. worker-backfill-values.ts keeps this in step from here on.
UPDATE killmail_filters f
SET total_value = k.total_value
FROM killmails k
WHERE k.killmail_id = f.killmail_id;

CREATE INDEX IF NOT EXISTS idx_kmfilters_victim_group_time
  ON killmail_filters(victim_ship_group_id, killmail_time DESC);

CREATE INDEX IF NOT EXISTS idx_kmfilters_time_value
  ON killmail_filters(killmail_time DESC, total_value DESC);
```

- [ ] **Step 4: Yıkıcı ifade taraması — boş dönmeli**

```bash
grep -n "DROP\|DELETE\|TRUNCATE" prisma/migrations/*_killmail_filters_repair_and_enrich/migration.sql
```

Beklenen: **hiçbir satır**. Bir eşleşme çıkarsa migration'ı uygulama, düzelt.

- [ ] **Step 5: Uygula**

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

Beklenen: "1 migration found" ve uygulandığına dair satır. Hata varsa dur, uygulama.

- [ ] **Step 6: Satır sayılarını doğrula**

Step 1'deki sorguyu aynen tekrar çalıştır. **Beş sayının hiçbiri azalmamış olmalı.**

- [ ] **Step 7: NULL'ların kapandığını doğrula**

```bash
psql "$DB" -c "
SELECT count(*) FILTER (WHERE region_id IS NULL)            AS null_region,
       count(*) FILTER (WHERE constellation_id IS NULL)     AS null_constellation,
       count(*) FILTER (WHERE security_status IS NULL)      AS null_secstatus,
       count(*) FILTER (WHERE victim_ship_group_id IS NULL) AS null_group,
       count(*) FILTER (WHERE total_value IS NULL)          AS null_value
FROM killmail_filters;"
```

Beklenen: ilk dördü **0**. `null_value`, `killmails`'teki NULL sayısına eşit olmalı
(bu ölçümde ~6.712) — bu bir kusur değil, `worker-backfill-values`'ın bitmemiş işidir:

```bash
psql "$DB" -c "SELECT count(*) FROM killmails WHERE total_value IS NULL;"
```

- [ ] **Step 8: Region filtresinin canlandığını doğrula**

Spec'teki ölçümün karşılığı. İki sayı artık eşit olmalı:

```bash
psql "$DB" -c "
SELECT (SELECT count(*) FROM killmail_filters
        WHERE killmail_time >= now() - interval '7 days' AND region_id = 10000002) AS tablodan,
       (SELECT count(*) FROM killmail_filters f
        JOIN solar_systems ss ON ss.system_id = f.solar_system_id
        JOIN constellations c ON c.constellation_id = ss.constellation_id
        WHERE f.killmail_time >= now() - interval '7 days' AND c.region_id = 10000002) AS joinden;"
```

Migration öncesi `tablodan` 0 idi. Şimdi ikisi eşit olmalı.

- [ ] **Step 9: Commit**

```bash
git add backend/prisma/migrations
git commit -m "fix(db): repair killmail_filters location columns, add group and value

region_id and constellation_id have been NULL on every row written since the
materialized view became a table: the join that derived them never made it into
insertKillmailFilter, which expects them from callers that do not pass them.
37,781 of 44,493 rows were affected, so the region and constellation filters on
the killmails page have returned nothing for five months.

Backfills both from the solar_systems -> constellations chain, along with the
116 rows whose security_status was never filled, and adds victim_ship_group_id
and total_value so a scope-and-value query can run against this table alone.

Adds columns, fills columns, creates indexes. Drops nothing."
```

---

### Task 2: `insertKillmailFilter` — join'den türetme

**Files:**

- Modify: `backend/src/services/killmail-filters-realtime.ts:21-127`

**Interfaces:**

- Consumes: Task 1'in eklediği `victim_ship_group_id` ve `total_value` kolonları.
- Produces: `insertKillmailFilter(data: KillmailFilterData): Promise<void>` — arayüzden
  `constellation_id` ve `region_id` alanları **kaldırılmış** hâli. Dört çağıran worker
  bu iki alanı zaten göndermiyor, dolayısıyla çağıran tarafta değişiklik gerekmez.

- [ ] **Step 1: Arayüzden iki alanı çıkar**

`KillmailFilterData` içinden şu iki satır silinir:

```ts
    constellation_id?: number | null;
    region_id?: number | null;
```

- [ ] **Step 2: SQL'i yeniden yaz**

`prismaWorker.$executeRaw` çağrısının tamamı aşağıdakiyle değiştirilir. Değişenler:
`data_row`'dan iki alan çıktı, `INSERT` sütun listesine iki yeni kolon girdi, `SELECT`
konum/grup/değer alanlarını join'den okuyor, ve `ON CONFLICT` hedefli `DO UPDATE` oldu.

```ts
await prismaWorker.$executeRaw`
      WITH data_row AS (
        SELECT
          ${data.killmail_id}::bigint as killmail_id,
          ${data.killmail_time}::timestamp as killmail_time,
          ${data.solar_system_id}::int as solar_system_id,
          ${data.attacker_count}::int as attacker_count,
          ${data.victim_ship_type_id}::int as victim_ship_type_id,
          ${data.victim_character_id}::int as victim_character_id,
          ${data.victim_corporation_id}::int as victim_corporation_id,
          ${data.victim_alliance_id}::int as victim_alliance_id,
          ${shipIds}::int[] as attacker_ship_type_ids,
          ${charIds}::int[] as attacker_character_ids,
          ${corpIds}::int[] as attacker_corporation_ids,
          ${allianceIds}::int[] as attacker_alliance_ids
      )
      INSERT INTO killmail_filters (
        killmail_id,
        killmail_time,
        solar_system_id,
        constellation_id,
        region_id,
        attacker_count,
        victim_ship_type_id,
        victim_character_id,
        victim_corporation_id,
        victim_alliance_id,
        attacker_ship_type_ids,
        attacker_character_ids,
        attacker_corporation_ids,
        attacker_alliance_ids,
        security_status,
        security_class,
        victim_ship_group_id,
        total_value
      )
      SELECT
        d.killmail_id,
        d.killmail_time,
        d.solar_system_id,
        ss.constellation_id,
        c.region_id,
        d.attacker_count,
        d.victim_ship_type_id,
        d.victim_character_id,
        d.victim_corporation_id,
        d.victim_alliance_id,
        d.attacker_ship_type_ids,
        d.attacker_character_ids,
        d.attacker_corporation_ids,
        d.attacker_alliance_ids,
        ss.security_status,
        ss.security_class,
        t.group_id,
        k.total_value
      FROM data_row d
      LEFT JOIN solar_systems  ss ON ss.system_id       = d.solar_system_id
      LEFT JOIN constellations c  ON c.constellation_id = ss.constellation_id
      LEFT JOIN types          t  ON t.id               = d.victim_ship_type_id
      LEFT JOIN killmails      k  ON k.killmail_id      = d.killmail_id
      ON CONFLICT (killmail_id) DO UPDATE SET
        constellation_id     = EXCLUDED.constellation_id,
        region_id            = EXCLUDED.region_id,
        security_status      = EXCLUDED.security_status,
        security_class       = EXCLUDED.security_class,
        victim_ship_group_id = EXCLUDED.victim_ship_group_id,
        total_value          = EXCLUDED.total_value
      WHERE killmail_filters.region_id       IS NULL
         OR killmail_filters.security_status IS NULL
         OR killmail_filters.total_value     IS NULL
    `;
```

- [ ] **Step 3: Dosya başındaki yorumu güncelle**

Dosyanın tepesindeki blok yorumda `Strategy` listesine şu madde eklenir:

```
 * - Location, victim ship group and cached value are derived from joins, not from
 *   the caller. The callers never had them; expecting them there is what left
 *   region_id and constellation_id NULL on every row for five months.
```

- [ ] **Step 4: Derle**

```bash
yarn workspace backend build
```

Beklenen: hata yok. `constellation_id`/`region_id` alanlarını gönderen bir çağıran
kalmışsa `tsc` burada bağırır — dördü de göndermediği için bağırmamalı.

- [ ] **Step 5: Yeni satırların dolu geldiğini doğrula**

Worker'ı kısa süre çalıştır:

```bash
cd backend && timeout 120 yarn worker:redisq
```

Sonra son yazılan satırlara bak:

```bash
psql "$DB" -c "
SELECT killmail_id, region_id, constellation_id, victim_ship_group_id, total_value
FROM killmail_filters ORDER BY killmail_time DESC LIMIT 5;"
```

Beklenen: `region_id`, `constellation_id` ve `victim_ship_group_id` dolu. Wormhole
sistemlerinde `region_id` dolu ama `security_class` NULL olabilir — bu normaldir.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/killmail-filters-realtime.ts
git commit -m "fix(killmails): derive filter location from joins, not from callers

insertKillmailFilter took constellation_id and region_id from its argument, but
all four ingest workers call it without them, so every row it wrote had both
NULL. The same statement already read security_status correctly from a
solar_systems join; this extends that chain by one hop to constellations and
drops the two fields from the interface.

Also fills the two columns added alongside, and softens ON CONFLICT DO NOTHING
into an update that touches only the derived columns and only where they are
still NULL, so a row written before its solar system existed can heal itself.
Attacker arrays are never rewritten."
```

---

### Task 3: `worker-backfill-values` — `total_value` senkronu

**Files:**

- Modify: `backend/src/workers/worker-backfill-values.ts:170-176`

**Interfaces:**

- Consumes: Task 1'in eklediği `killmail_filters.total_value`.
- Produces: — (yan etki: iki tablo tutarlı kalır)

- [ ] **Step 1: Güncellemeyi ekle**

`prismaWorker.killmail.update({...})` çağrısının **hemen ardına**, doğrulama bloğundan
önce:

```ts
// killmail_filters carries a denormalized copy for scope-and-value queries.
// This worker is its second writer; without this the copy goes stale.
await prismaWorker.$executeRaw`
          UPDATE killmail_filters
          SET total_value = ${values.totalValue}
          WHERE killmail_id = ${killmailId}
        `;
```

- [ ] **Step 2: Derle**

```bash
yarn workspace backend build
```

Beklenen: hata yok.

- [ ] **Step 3: İki tablonun tutarlılığını doğrula**

```bash
psql "$DB" -c "
SELECT count(*) AS uyusmayan
FROM killmail_filters f JOIN killmails k USING (killmail_id)
WHERE f.total_value IS DISTINCT FROM k.total_value;"
```

Beklenen: **0** (Task 1'in backfill'i az önce eşitledi). Bu sorgu, worker
çalıştırıldıktan sonra da 0 kalmalı — kalıcı ölçüt budur.

- [ ] **Step 4: Commit**

```bash
git add backend/src/workers/worker-backfill-values.ts
git commit -m "fix(workers): keep killmail_filters.total_value in step with killmails

This worker recomputes total_value for historical killmails long after they were
saved, which makes it the second writer of the denormalized copy that
killmail_filters now carries. Without this the copy silently drifts for exactly
the rows the backfill exists to correct."
```

---

# İş 3 — `worker-redisq-stream` düzeltmeleri

### Task 4: R2Z2 payload'ındaki ESI killmail'ini kullan

**Files:**

- Modify: `backend/src/workers/worker-redisq-stream.ts:57-80` (arayüzler),
  `:215-250` (`pollR2Z2`), `:255-270` (`processKillmail`)

**Interfaces:**

- Consumes: —
- Produces: `pollR2Z2(): Promise<RedisQPackage | null>` — dönüşe `esi?: KillmailDetail`
  alanı eklenmiş hâli. Başka görev buna dayanmaz.

- [ ] **Step 1: `RedisQPackage`'a `esi` alanı ekle**

`RedisQPackage` arayüzüne:

```ts
interface RedisQPackage {
  killID: number;
  zkb: {/* ...değişmiyor... */};
  /**
   * The full ESI killmail, as shipped inside the R2Z2 payload. Present in
   * normal operation; absent only if the payload shape changes, in which case
   * processKillmail falls back to fetching it from ESI.
   */
  esi?: KillmailDetail;
}
```

`R2Z2Killmail` arayüzündeki `esi: unknown;` satırı da şununla değişir:

```ts
esi: unknown; // validated in pollR2Z2 before being passed on
```

- [ ] **Step 2: `pollR2Z2` dönüşünü genişlet**

Mevcut `return { killID: ..., zkb: ... } as RedisQPackage;` bloğu şununla değişir:

```ts
// Advance the cursor only after a successful read
currentSequence!++;

return {
  killID: data.killmail_id,
  zkb: { ...data.zkb, hash: data.zkb?.hash ?? data.hash },
  esi: isUsableEsiKillmail(data.esi) ? data.esi : undefined,
} as RedisQPackage;
```

Ve dosyaya, `pollR2Z2`'nin hemen üstüne bir doğrulayıcı eklenir:

```ts
/**
 * R2Z2 ships the complete ESI killmail alongside the zkb block, so the worker does
 * not have to fetch it again. Guard the shape anyway: if the feed ever changes,
 * processKillmail falls back to ESI rather than saving a half-formed killmail.
 */
function isUsableEsiKillmail(esi: unknown): esi is KillmailDetail {
  if (!esi || typeof esi !== 'object') return false;
  const k = esi as Partial<KillmailDetail>;
  return (
    typeof k.killmail_id === 'number' &&
    typeof k.killmail_time === 'string' &&
    typeof k.solar_system_id === 'number' &&
    !!k.victim &&
    typeof k.victim.ship_type_id === 'number' &&
    Array.isArray(k.attackers)
  );
}
```

- [ ] **Step 3: `processKillmail`'i payload'ı kullanacak şekilde değiştir**

Mevcut iki satır:

```ts
logger.info(`📥 Fetching: ${killID} (${formatISK(zkb.totalValue)} ISK)`);
const killmail = await KillmailService.getKillmailDetail(killID, zkb.hash);
```

şununla değişir:

```ts
// R2Z2 already carries the ESI killmail; only fall back to a fetch if the
// payload did not carry a usable one.
let killmail: KillmailDetail;
if (pkg.esi) {
  logger.info(`📥 From payload: ${killID} (${formatISK(zkb.totalValue)} ISK)`);
  killmail = pkg.esi;
} else {
  logger.info(
    `📥 Fetching from ESI: ${killID} (${formatISK(zkb.totalValue)} ISK)`,
  );
  killmail = await KillmailService.getKillmailDetail(killID, zkb.hash);
}
```

`processKillmail`'in imzasındaki yıkım (`const { killID, zkb } = pkg;`) korunur; `pkg`
zaten parametre adıdır.

- [ ] **Step 4: Derle**

```bash
yarn workspace backend build
```

Beklenen: hata yok. `KillmailService` importu hâlâ kullanıldığı için (yedek yol) durur.

- [ ] **Step 5: Worker'ı çalıştırıp log'u oku**

```bash
cd backend && timeout 120 yarn worker:redisq
```

Beklenen: `📥 From payload:` satırları. `📥 Fetching from ESI:` satırı **görünmemeli**;
görünüyorsa `isUsableEsiKillmail` gereğinden katı demektir, hangi alanın eksik olduğuna
bak.

- [ ] **Step 6: Kaydedilen verinin aynı olduğunu doğrula**

Bu değişikliğin veriyi bozmadığı, kaydedilen killmail'in eksiksizliğiyle ölçülür:

```bash
psql "$DB" -c "
SELECT k.killmail_id, k.attacker_count,
       (SELECT count(*) FROM attackers a WHERE a.killmail_id = k.killmail_id) AS attacker_rows,
       (SELECT count(*) FROM victims v WHERE v.killmail_id = k.killmail_id)   AS victim_rows,
       k.total_value IS NOT NULL AS has_value
FROM killmails k ORDER BY k.created_at DESC LIMIT 5;"
```

Beklenen: her satırda `attacker_rows = attacker_count`, `victim_rows = 1`,
`has_value = t`.

- [ ] **Step 7: Commit**

```bash
git add backend/src/workers/worker-redisq-stream.ts
git commit -m "perf(workers): use the ESI killmail R2Z2 already sends

Every R2Z2 payload carries the complete ESI killmail next to the zkb block, and
its shape is exactly KillmailDetail. The worker was discarding it and fetching
the same killmail from ESI again, deliberately, to guarantee an identical
downstream shape. The payload gives that shape already, so the fetch is one
avoidable request per killmail on the critical path of a serial loop.

Validates the payload before trusting it and falls back to the old fetch if the
feed ever changes shape, so an upstream change costs latency rather than
ingestion."
```

---

### Task 5: `faction_id`'yi yaz — victim ve attacker

**Files:**

- Modify: `backend/src/workers/worker-redisq-stream.ts:682` (victim), `:700` (attacker)

**Interfaces:**

- Consumes: —
- Produces: —

- [ ] **Step 1: Victim tarafını düzelt**

`saveKillmail` içindeki `tx.victim.create` bloğunda, `position_z` satırından sonra gelen:

```ts
          faction_id: null,
```

şununla değişir:

```ts
          faction_id: victim.faction_id ?? null,
```

- [ ] **Step 2: Attacker tarafını düzelt**

`tx.attacker.createMany` içindeki `data: attackers.map(...)` bloğunda, `security_status`
satırından sonra gelen:

```ts
            faction_id: null,
```

şununla değişir:

```ts
            faction_id: attacker.faction_id ?? null,
```

Bu satır victim'inkiyle aynı görünüyor ama farklı bir blokta ve farklı bir değişkenden
okuyor — ikisini de değiştir, birini atlama.

- [ ] **Step 3: Derle**

```bash
yarn workspace backend build
```

Beklenen: hata yok. `KillmailDetail` her ikisini de `faction_id?: number` olarak tanımlı
tutuyor — victim için `killmail.service.ts:22`, attacker için `:49`.

- [ ] **Step 4: Doğrula**

Önce mevcut durumu kaydet — ikisi de bugün 0:

```bash
psql "$DB" -c "
SELECT (SELECT count(*) FROM victims   WHERE faction_id IS NOT NULL) AS victim_dolu,
       (SELECT count(*) FROM attackers WHERE faction_id IS NOT NULL) AS attacker_dolu;"
```

Sonra worker'ı bir süre çalıştır:

```bash
cd backend && timeout 300 yarn worker:redisq
```

ve aynı sorguyu tekrarla. **`attacker_dolu` sıfırdan çıkmış olmalı** — NPC saldırganlar
sık, 300.642 attacker satırının 4.850'i NPC görünümlü. `victim_dolu` hâlâ 0 olabilir;
faction'lı _kayıp_ seyrektir ve bu tek başına hata anlamına gelmez.

Kesin doğrulama, R2Z2'den bir payload alıp elle karşılaştırmaktır:

```bash
SEQ=$(curl -s -A 'Killreport Real-Time Sync - github.com/umutyerebakmaz/killreport' \
  https://r2z2.zkillboard.com/ephemeral/sequence.json \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["sequence"]-1)')
curl -s -A 'Killreport Real-Time Sync - github.com/umutyerebakmaz/killreport' \
  "https://r2z2.zkillboard.com/ephemeral/$SEQ.json" | python3 -c "
import sys, json
d = json.load(sys.stdin)['esi']
print('killmail_id:', d['killmail_id'])
print('victim faction:', d['victim'].get('faction_id'))
print('attacker factions:', [a.get('faction_id') for a in d['attackers']])"
```

Çıktıda `None` olmayan bir değer varsa, o killmail veritabanına düştüğünde ilgili satırın
`faction_id`'si de aynı değeri taşımalı.

- [ ] **Step 5: Commit**

```bash
git add backend/src/workers/worker-redisq-stream.ts
git commit -m "fix(workers): store the faction ids ESI sends

Both columns exist, KillmailDetail carries both fields and ESI populates them
for faction and NPC participants, but saveKillmail wrote an unconditional null
on each. All 45,035 victim rows and all 300,642 attacker rows are empty as a
result, and 4,850 of those attackers look like NPCs, which is exactly the set
ESI would have carried a faction for."
```

---

# İş 2 — Sekmeli, bağımsız Most Valuable carousel'ı

### Task 6: Backend — şema, grup yapılandırması, servis, resolver

**Files:**

- Create: `backend/src/config/ship-groups.ts`
- Create: `backend/src/schemas/MostValuable.graphql`
- Create: `backend/src/services/killmail/most-valuable.service.ts`
- Modify: `backend/src/services/killmail/index.ts`
- Modify: `backend/src/resolvers/killmail/queries.ts`
- Modify: `backend/src/config/cache.ts`

**Interfaces:**

- Consumes: Task 1'in `victim_ship_group_id` ve `total_value` kolonları.
- Produces:
  - `MostValuableScope` enum'u — `SHIPS | STRUCTURES | CAPITALS | SOLO`
  - `mostValuableKillmails(scope: MostValuableScope!, days: Int = 7, limit: Int = 20): [Killmail!]!`
  - `getMostValuableKillmails(scope, days, limit)` servisi
  - Task 7 bu sorguyu tüketir.

- [ ] **Step 1: Grup yapılandırmasını oluştur**

`backend/src/config/ship-groups.ts`:

```ts
/**
 * EVE inventory group ids, for scoping killmails by what the victim was flying.
 * Reference: https://www.fuzzwork.co.uk/dump/latest/invGroups.csv
 *
 * The frontend keeps its own copy in utils/shipGroups.ts for the filter UI. This
 * one is the server's, because scope is decided server-side.
 */

/** Citadels, engineering complexes, refineries and the two starbase groups. */
export const STRUCTURE_GROUP_IDS: number[] = [
  365, // Control Tower
  404, // Starbase Structure
  1657, // Citadel
  1404, // Engineering Complex
  1406, // Refinery
];

/** Pods. Cheap and numerous; they drown out a value ranking. */
export const CAPSULE_GROUP_IDS: number[] = [
  29, // Capsule
];

/** Carriers through titans, plus the capital industrial hull. */
export const CAPITAL_GROUP_IDS: number[] = [
  547, // Carrier
  485, // Dreadnought
  659, // Supercarrier
  30, // Titan
  1538, // Force Auxiliary
  883, // Capital Industrial Ship
];

/** What the SHIPS and SOLO scopes leave out. */
export const NON_SHIP_GROUP_IDS: number[] = [
  ...STRUCTURE_GROUP_IDS,
  ...CAPSULE_GROUP_IDS,
];
```

- [ ] **Step 2: Şemayı oluştur**

`backend/src/schemas/MostValuable.graphql`:

```graphql
"Which losses a Most Valuable shelf ranks. Always the victim's hull."
enum MostValuableScope {
  "Everything except structures and pods. Capitals are included."
  SHIPS
  "Citadels, engineering complexes, refineries and starbases."
  STRUCTURES
  "Carriers, dreadnoughts, supercarriers, titans, FAXes, capital industrials."
  CAPITALS
  "Kills with a single attacker, excluding structures and pods."
  SOLO
}

extend type Query {
  """
  Top killmails by ISK value in a trailing window, most valuable first.
  Scope is matched against the victim's hull, never an attacker's.
  """
  mostValuableKillmails(
    scope: MostValuableScope!
    "Length of the trailing window in days."
    days: Int = 7
    "Capped at 50."
    limit: Int = 20
  ): [Killmail!]!
}
```

- [ ] **Step 3: Backend codegen**

```bash
yarn workspace backend codegen
```

Beklenen: hata yok. `MostValuableScope` artık `src/generated-types.ts` içinde bir TS
enum'u olarak var — `Ships = 'SHIPS'` biçiminde.

- [ ] **Step 4: Servisi yaz**

`backend/src/services/killmail/most-valuable.service.ts`:

```ts
import { CACHE_TTL } from '@config/cache';
import {
  CAPITAL_GROUP_IDS,
  NON_SHIP_GROUP_IDS,
  STRUCTURE_GROUP_IDS,
} from '@config/ship-groups';
import { Prisma } from '@generated/prisma/client';
import { MostValuableScope } from '@generated-types';
import prisma from '@services/prisma';
import redis from '@services/redis';

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;
const DEFAULT_DAYS = 7;

/**
 * One indexed query against killmail_filters, which carries the victim's ship
 * group and the cached ISK value alongside killmail_time. No joins: the field
 * resolvers pull victim, solarSystem and finalBlow through DataLoaders from the
 * id and solarSystemId returned here.
 */
interface MostValuableRow {
  killmail_id: number;
  killmail_time: Date;
  solar_system_id: number | null;
  total_value: number | null;
  attacker_count: number | null;
}

/**
 * Scope predicates. `<> ALL(...)` is the array form of NOT IN; a NULL group would
 * make it NULL rather than true, so the IS NOT NULL guard keeps unresolved hulls
 * out of the ship scopes instead of silently dropping the row.
 */
const SCOPE_PREDICATE: Record<MostValuableScope, Prisma.Sql> = {
  SHIPS: Prisma.sql`victim_ship_group_id IS NOT NULL
                      AND victim_ship_group_id <> ALL(${NON_SHIP_GROUP_IDS}::int[])`,
  STRUCTURES: Prisma.sql`victim_ship_group_id = ANY(${STRUCTURE_GROUP_IDS}::int[])`,
  CAPITALS: Prisma.sql`victim_ship_group_id = ANY(${CAPITAL_GROUP_IDS}::int[])`,
  SOLO: Prisma.sql`attacker_count = 1
                     AND victim_ship_group_id IS NOT NULL
                     AND victim_ship_group_id <> ALL(${NON_SHIP_GROUP_IDS}::int[])`,
};

export async function getMostValuableKillmails(
  scope: MostValuableScope,
  days?: number | null,
  limit?: number | null,
) {
  const cappedLimit = Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const window = days ?? DEFAULT_DAYS;

  const cacheKey = `killmails:mostvaluable:${scope}:${window}:${cappedLimit}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const since = new Date(Date.now() - window * 24 * 60 * 60 * 1000);

  const rows = await prisma.$queryRaw<MostValuableRow[]>`
      SELECT killmail_id, killmail_time, solar_system_id, total_value, attacker_count
      FROM killmail_filters
      WHERE killmail_time >= ${since}
        AND total_value IS NOT NULL
        AND ${SCOPE_PREDICATE[scope]}
      ORDER BY total_value DESC
      LIMIT ${cappedLimit}
    `;

  const items = rows.map((row) => ({
    id: row.killmail_id.toString(),
    killmailTime: row.killmail_time.toISOString(),
    totalValue: row.total_value,
    solarSystemId: row.solar_system_id,
    attackerCount: row.attacker_count ?? 0,
  }));

  // Rolling window, so the key carries no date and the TTL keeps it honest.
  await redis.setex(
    cacheKey,
    Math.floor(CACHE_TTL.KILLMAIL_LIST / 1000),
    JSON.stringify(items),
  );
  return items;
}
```

- [ ] **Step 5: Servisi dışa aktar**

`backend/src/services/killmail/index.ts` dosyasına ekle:

```ts
export { getMostValuableKillmails } from './most-valuable.service';
```

- [ ] **Step 6: Resolver'ı ekle**

`backend/src/resolvers/killmail/queries.ts` — import satırlarına:

```ts
import { getMostValuableKillmails } from '@services/killmail';
```

ve `killmailQueries` nesnesinin içine, `killmails` resolver'ından sonra:

```ts
    mostValuableKillmails: async (_, { scope, days, limit }) => {
        return getMostValuableKillmails(scope, days, limit) as any;
    },
```

- [ ] **Step 7: Önbellek yapılandırmasını güncelle**

`backend/src/config/cache.ts` — `PUBLIC_CACHE_QUERIES` dizisinde `'Killmails'`
satırının hemen ardına:

```ts
    'MostValuableKillmails',
```

ve `TTL_PER_SCHEMA_COORDINATE` içinde `'Query.killmailsDateCounts'` satırının ardına:

```ts
    'Query.mostValuableKillmails': CACHE_TTL.KILLMAIL_LIST,
```

- [ ] **Step 8: Derle**

```bash
yarn workspace backend build
```

Beklenen: hata yok. `SCOPE_PREDICATE` dört anahtarın hepsini içermezse `tsc` burada
bağırır — `Record<MostValuableScope, …>` bunu zorunlu kılar.

- [ ] **Step 9: Dört kapsamı canlı sorgula**

Backend'i ayağa kaldır:

```bash
yarn dev:backend
```

Başka bir kabukta, dört kapsam tek tek:

```bash
for S in SHIPS STRUCTURES CAPITALS SOLO; do
  echo "--- $S"
  curl -s http://localhost:4000/graphql -H 'content-type: application/json' \
    -d "{\"query\":\"{ mostValuableKillmails(scope: $S, limit: 5) { id totalValue attackerCount victim { shipType { name group { id name } } } } }\"}" \
    | python3 -m json.tool
done
```

Beklenen ölçütler:

- `SHIPS`: dönen kayıtların hiçbirinin grup id'si 365, 404, 1657, 1404, 1406 veya 29
  olmamalı.
- `STRUCTURES`: hepsinin grup id'si o beş structure grubundan biri olmalı.
- `CAPITALS`: hepsi 547, 485, 659, 30, 1538, 883 kümesinde olmalı. Az kayıt dönmesi
  normaldir — spec §2.7'de ölçüldü, son 7 günde toplam ~21 capital kaybı var.
- `SOLO`: hepsinde `attackerCount` **1** olmalı.
- Dördünde de `totalValue` azalan sırada olmalı.

- [ ] **Step 10: Önbelleğin çalıştığını doğrula**

Aynı sorguyu ikinci kez çalıştır; ikinci çağrı gözle görülür biçimde hızlı dönmeli.
Anahtarı doğrula:

```bash
redis-cli --scan --pattern 'killmails:mostvaluable:*'
```

Beklenen: `killmails:mostvaluable:SHIPS:7:5` biçiminde anahtarlar.

- [ ] **Step 11: Commit**

```bash
git add backend/src/config/ship-groups.ts backend/src/schemas/MostValuable.graphql \
        backend/src/services/killmail/most-valuable.service.ts \
        backend/src/services/killmail/index.ts \
        backend/src/resolvers/killmail/queries.ts backend/src/config/cache.ts \
        backend/src/generated-types.ts backend/src/generated-schema.graphql
git commit -m "feat(killmails): add mostValuableKillmails, one query per shelf

The killmails page built its two Most Valuable shelves out of the general
killmails query, which cost it three separate problems: the ships shelf fetched
fifty rows and dropped structures and pods in JavaScript, the structures shelf
matched ship groups on the attacker side as well as the victim, and the date
filter never reached the id lookup so the whole history of structure kills was
materialized before being cut to seven days.

A dedicated query sidesteps all three. Scope is matched against
victim_ship_group_id, so it is the victim's hull by construction, and
killmail_time filters on an indexed column of the same table. It follows the
topLast7Days* family already serving the sidebar."
```

---

### Task 7: Frontend GraphQL dokümanı

**Files:**

- Create: `frontend/src/graphql/MostValuableKillmails.graphql`

**Interfaces:**

- Consumes: Task 6'nın `mostValuableKillmails` sorgusu.
- Produces: `useMostValuableKillmailsQuery` hook'u ve `MostValuableScope` enum'u,
  `frontend/src/generated/graphql.ts` içinde. Task 8 bunları kullanır.

- [ ] **Step 1: Dokümanı yaz**

`frontend/src/graphql/MostValuableKillmails.graphql`. Alan listesi
`KillmailCardData`'nın gerçekten okuduklarıyla sınırlı; **`attackers` yok** — kart onu
kullanmıyor ve structure kill'lerinde killmail başına binlerce satır demek.

```graphql
query MostValuableKillmails(
  $scope: MostValuableScope!
  $days: Int
  $limit: Int
) {
  mostValuableKillmails(scope: $scope, days: $days, limit: $limit) {
    id
    killmailTime
    totalValue
    victim {
      character {
        id
        name
      }
      corporation {
        id
        name
      }
      alliance {
        id
        name
      }
      shipType {
        id
        name
        group {
          name
        }
        dogmaAttributes(ids: [422, 1692]) {
          attribute_id
          value
        }
      }
      damageTaken
    }
    solarSystem {
      id
      name
      securityStatus
      constellation {
        id
        name
        region {
          id
          name
        }
      }
    }
    finalBlow {
      character {
        id
        name
      }
      corporation {
        id
        name
      }
      alliance {
        id
        name
      }
    }
  }
}
```

- [ ] **Step 2: Frontend codegen**

```bash
yarn workspace frontend codegen
```

Beklenen: hata yok. Backend codegen'i Task 6 Step 3'te zaten çalıştı; çalışmadıysa
önce onu çalıştır.

- [ ] **Step 3: Üretilen hook'u doğrula**

```bash
grep -n "useMostValuableKillmailsQuery\|export enum MostValuableScope" -A 6 \
  frontend/src/generated/graphql.ts | head -20
```

Beklenen: `export enum MostValuableScope { Capitals = 'CAPITALS', Ships = 'SHIPS',
Solo = 'SOLO', Structures = 'STRUCTURES' }` ve
`useMostValuableKillmailsQuery` fonksiyonu.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/graphql/MostValuableKillmails.graphql frontend/src/generated/graphql.ts
git commit -m "feat(frontend): add the Most Valuable killmails document

Asks for what the card renders and nothing else. The shelves previously reused
the Killmails document, which pulls every killmail's full attackers array for a
card that never shows it."
```

---

### Task 8: `MostValuableCarousel` bileşeni

**Files:**

- Create: `frontend/src/components/MostValuableCarousel/MostValuableCarousel.tsx`

**Interfaces:**

- Consumes: Task 7'nin `useMostValuableKillmailsQuery` hook'u ve `MostValuableScope`
  enum'u; mevcut `KillmailCard`, `Card`, `SectionTitle` bileşenleri.
- Produces: `<MostValuableCarousel />` — **prop almaz.** Task 9 bunu yerleştirir.

- [ ] **Step 1: Bileşeni yaz**

`frontend/src/components/MostValuableCarousel/MostValuableCarousel.tsx`:

```tsx
'use client';

import KillmailCard, {
  KillmailCardData,
} from '@/components/KillmailCard/KillmailCard';
import Card from '@/components/ui/Card';
import SectionTitle from '@/components/ui/SectionTitle';
import {
  MostValuableScope,
  useMostValuableKillmailsQuery,
} from '@/generated/graphql';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useCallback, useEffect, useRef, useState } from 'react';

const WINDOW_DAYS = 7;
const CARD_COUNT = 20;

/** Card width (w-80 = 320px) plus the flex gap (gap-4 = 16px). */
const CARD_PITCH = 336;

interface Tab {
  scope: MostValuableScope;
  label: string;
  emptyText: string;
}

const TABS: Tab[] = [
  {
    scope: MostValuableScope.Ships,
    label: 'Ships',
    emptyText: 'No ship losses in the last 7 days',
  },
  {
    scope: MostValuableScope.Structures,
    label: 'Structures',
    emptyText: 'No structure losses in the last 7 days',
  },
  {
    scope: MostValuableScope.Capitals,
    label: 'Capitals',
    emptyText: 'No capital losses in the last 7 days',
  },
  {
    scope: MostValuableScope.Solo,
    label: 'Solo',
    emptyText: 'No solo kills in the last 7 days',
  },
];

/**
 * The Most Valuable shelf on the killmails page. Self-contained: it owns its tab
 * state, its scrolling and its own query, so the page only has to place it.
 *
 * Only the active tab queries. Apollo keeps what previous tabs fetched, so moving
 * back to one is instant.
 */
export default function MostValuableCarousel() {
  const [activeScope, setActiveScope] = useState<MostValuableScope>(
    MostValuableScope.Ships,
  );

  const { data, loading } = useMostValuableKillmailsQuery({
    variables: { scope: activeScope, days: WINDOW_DAYS, limit: CARD_COUNT },
  });

  const killmails = (data?.mostValuableKillmails ??
    []) as unknown as KillmailCardData[];

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // The old carousel assumed it could scroll right and never measured on mount,
  // so the arrow stayed lit even when nothing overflowed.
  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, killmails.length]);

  // A new tab starts at the beginning of its own shelf.
  useEffect(() => {
    scrollRef.current?.scrollTo({ left: 0 });
  }, [activeScope]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    // Move by whole cards so they never come to rest half out of view.
    const cardsPerView = Math.max(1, Math.floor(el.clientWidth / CARD_PITCH));
    const delta = cardsPerView * CARD_PITCH * (direction === 'right' ? 1 : -1);
    el.scrollTo({ left: el.scrollLeft + delta, behavior: 'smooth' });
  };

  const activeTab = TABS.find((t) => t.scope === activeScope)!;

  return (
    <Card>
      <SectionTitle
        subtitle="Last 7 days, by ISK destroyed"
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className={`p-2 transition-all ${
                canScrollLeft
                  ? 'bg-white/10 hover:bg-white/20 text-white'
                  : 'bg-white/5 text-gray-600 cursor-not-allowed'
              }`}
              aria-label="Scroll left"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className={`p-2 transition-all ${
                canScrollRight
                  ? 'bg-white/10 hover:bg-white/20 text-white'
                  : 'bg-white/5 text-gray-600 cursor-not-allowed'
              }`}
              aria-label="Scroll right"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        }
      >
        Most Valuable
      </SectionTitle>

      <div
        role="tablist"
        aria-label="Most valuable scope"
        className="flex gap-1 pb-3 mb-4 border-b border-white/5"
      >
        {TABS.map((tab) => (
          <button
            key={tab.scope}
            role="tab"
            aria-selected={tab.scope === activeScope}
            onClick={() => setActiveScope(tab.scope)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab.scope === activeScope
                ? 'bg-white/10 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        // Skeletons rather than a centred spinner: the shelf keeps its height, so
        // switching tabs does not make the page jump.
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex-none w-80 h-[420px] bg-white/5 animate-pulse"
            />
          ))}
        </div>
      ) : killmails.length === 0 ? (
        <div className="flex items-center justify-center h-[420px] text-gray-500">
          <p className="text-sm font-medium">{activeTab.emptyText}</p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={measure}
          className="flex gap-4 overflow-x-auto hide-scrollbar snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {killmails.map((killmail, index) => (
            <div key={killmail.id} className="flex-none w-80 snap-start">
              <KillmailCard killmail={killmail} rank={index + 1} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: `hide-scrollbar` sınıfının yerinde durduğunu teyit et**

Sınıf `frontend/src/app/globals.css:286-290`'da tanımlı ve Task 9 eski carousel'ı
sildikten sonra da orada kalmalı — yeni bileşen onu kullanıyor.

```bash
grep -n "hide-scrollbar" frontend/src/app/globals.css
```

Beklenen: iki satır (`::-webkit-scrollbar` kuralı ve sınıfın kendisi). `globals.css`
bu görevde değiştirilmiyor.

- [ ] **Step 3: Lint ve derle**

```bash
yarn workspace frontend lint
yarn workspace frontend build
```

Beklenen: ikisi de temiz. `KillmailCardData` ile üretilen tipin uyuşmadığı bir yer
varsa `build` burada bağırır.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/MostValuableCarousel
git commit -m "feat(frontend): add the tabbed Most Valuable carousel

One shelf with four scopes instead of one shelf per scope, so four scopes cost
the page no vertical space and the table stays near the top. Only the active tab
queries; Apollo keeps what the others fetched.

Fixes what the old carousel got wrong about scrolling along the way. It assumed
it could scroll right and never measured on mount, so the arrow stayed lit over
content that did not overflow, and it scrolled by 400px against a 336px card
pitch, which left cards resting half out of view. Loading is skeletons at the
shelf's own height rather than a centred spinner, so switching tabs does not
make the page jump."
```

---

### Task 9: `page.tsx` temizliği ve eski carousel'ın kaldırılması

**Files:**

- Modify: `frontend/src/app/killmails/page.tsx:1-27` (importlar), `:96-140`
  (carousel sorguları ve filtreleme), `:408-425` (kullanım)
- Delete: `frontend/src/components/KillmailCarousel/KillmailCarousel.tsx`

**Interfaces:**

- Consumes: Task 8'in `<MostValuableCarousel />` bileşeni.
- Produces: —

- [ ] **Step 1: Carousel veri mantığını sil**

`page.tsx` içinden şunların tamamı çıkar:

- `sevenDaysAgo` ve `today` `useMemo`'ları (`// Calculate date 7 days ago for carousels`
  yorumundan `const today = ...` satırının sonuna kadar)
- `structuresData` / `structuresLoading` `useKillmailsQuery` çağrısı
- `allShipsData` / `shipsLoading` `useKillmailsQuery` çağrısı
- `shipsData` `useMemo`'su (client-side filtreleme)

- [ ] **Step 2: Kullanımı değiştir**

`{/* Most Valuable Carousels - Last 7 Days */}` yorumundan başlayıp iki
`<KillmailCarousel ... />` bloğunu saran `<div className="mt-8 space-y-6">` öğesinin
tamamı şununla değişir:

```tsx
<div className="mt-8">
  <MostValuableCarousel />
</div>
```

- [ ] **Step 3: Importları düzelt**

Şu satır silinir:

```tsx
import KillmailCarousel from '@/components/KillmailCarousel/KillmailCarousel';
```

Yerine:

```tsx
import MostValuableCarousel from '@/components/MostValuableCarousel/MostValuableCarousel';
```

`STRUCTURE_GROUPS` / `CAPSULE_GROUPS` importunun başka kullanımı kalmadığını doğrula ve
kalmadıysa sil:

```bash
grep -n "STRUCTURE_GROUPS\|CAPSULE_GROUPS" frontend/src/app/killmails/page.tsx
```

Çıktı boşsa şu satırı sil:

```tsx
import { CAPSULE_GROUPS, STRUCTURE_GROUPS } from '@/utils/shipGroups';
```

`KillmailOrderBy` ve `useKillmailsQuery` importları **kalır** — sayfanın tablosu
onları kullanmaya devam ediyor. Teyit et:

```bash
grep -n "KillmailOrderBy\|useKillmailsQuery" frontend/src/app/killmails/page.tsx
```

- [ ] **Step 4: Eski carousel'ı sil**

Başka tüketicisi olmadığını önce doğrula:

```bash
grep -rn "KillmailCarousel" frontend/src
```

Beklenen: **hiçbir eşleşme yok** (Step 3'ten sonra). Sonra:

```bash
git rm -r frontend/src/components/KillmailCarousel
```

`frontend/src/utils/shipGroups.ts` **silinmez** — `KillmailFilters` bileşeni onu
kullanmaya devam ediyor. Teyit et:

```bash
grep -rn "shipGroups" frontend/src --include='*.tsx' --include='*.ts' | grep -v generated
```

- [ ] **Step 5: Lint ve derle**

```bash
yarn workspace frontend lint
yarn workspace frontend build
```

Beklenen: ikisi de temiz. Kullanılmayan bir import kaldıysa `lint` bağırır.

- [ ] **Step 6: Kullanıcıya bak dedir**

Bu noktada `yarn dev:backend` ve `yarn dev:frontend` çalışır hâlde bırakılır ve
kullanıcıdan `http://localhost:3000/killmails` adresine bakması istenir. Kontrol
edilecekler: dört sekme geçiş yapıyor mu, oklar doğru anda sönük mü, kartlar tam
hizalanıyor mu, Capitals sekmesi az kartla da düzgün duruyor mu. **Tarayıcı sürülmez.**

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/killmails/page.tsx
git commit -m "refactor(frontend): move the Most Valuable shelves off the page

The page held both shelves' queries, their date window and the JavaScript that
dropped structures and pods out of the ships list. All of it belongs to the
carousel, which now fetches its own data, so the page is left with its filters,
its live feed and its table.

Removes KillmailCarousel, whose only two consumers were the shelves this
replaces."
```

---

## Kapanış doğrulaması

Dokuz görev bittikten sonra, dalın tamamı için:

- [ ] **Tam derleme zinciri**

```bash
yarn workspace backend build
yarn workspace backend codegen
yarn workspace frontend codegen
yarn workspace frontend lint
yarn workspace frontend build
```

Beşi de temiz olmalı. Codegen'den sonra `git status` kirli çıkarsa üretilmiş dosyalar
commit'lenmemiş demektir — ekle ve commit'le.

- [ ] **Veri bütünlüğü — son kontrol**

```bash
cd backend
DB=$(grep -m1 '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
psql "$DB" -c "
SELECT (SELECT count(*) FROM killmails k LEFT JOIN killmail_filters f USING (killmail_id)
        WHERE f.killmail_id IS NULL)                                   AS eksik_satir,
       (SELECT count(*) FROM killmail_filters WHERE region_id IS NULL) AS null_region,
       (SELECT count(*) FROM killmail_filters
        WHERE victim_ship_group_id IS NULL)                            AS null_group,
       (SELECT count(*) FROM killmail_filters f JOIN killmails k USING (killmail_id)
        WHERE f.total_value IS DISTINCT FROM k.total_value)            AS deger_uyusmazligi;"
```

Dördü de **0** olmalı.

- [ ] **Bilinen ve kabul edilen sonuç**

Structures sekmesinin sıralaması eksiktir: son 7 günün 50 structure kaybının 21'i
`total_value = 0` taşıyor ve listenin dibinde kalıyor. Bu bir hata değil, spec §7
madde 6'da gerekçesiyle kapsam dışı bırakılan `market_prices` kapsamı meselesidir.
Kullanıcıya teslim ederken bu açıkça söylenir.
