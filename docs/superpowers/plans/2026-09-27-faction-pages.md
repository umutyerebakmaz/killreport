# Faction sayfaları — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/factions` liste sayfasını ve Attributes / Killmails / Members
sekmeli `/factions/[id]` detay sayfasını, arkasındaki veri katmanı ve GraphQL
API'siyle birlikte eklemek.

**Architecture:** `killmail_filters` iki faction kolonu kazanır (backfill aynı
migration'da, yeni killmail'ler `insertKillmailFilter` üzerinden). Okuma yolu
yeni `services/faction/faction-stats.service.ts`'tedir (düz `async function`,
`redis.get` → sorgu → `redis.setex`); resolver'lar yalnızca delege eder.
`KillmailFilter` ve `CorporationFilter` `factionId` kazanır, frontend alliance
sayfasının iskeletini izler.

**Tech Stack:** Prisma 7 + PostgreSQL, GraphQL Yoga + graphql-codegen, Redis,
Vitest 5, Next.js App Router + Apollo Client, Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-24-faction-pages-design.md`

## Global Constraints

- `prisma migrate dev` ve `migrate reset` yasak. Migration elle yazılır,
  `prisma migrate deploy` ile uygulanır; beş elle yönetilen tablonun
  (`killmail_filters`, `character_kill_stats`, `corporation_kill_stats`,
  `alliance_kill_stats`, `refresh_log`) satır sayısı hiçbir adımda azalmaz.
- `killmail_filters` Prisma şemasına **girmez**; yeni kolonları yalnızca
  migration SQL'inde yaşar.
- Yarn, asla npm. `.env`'e dokunulmaz. Üretilmiş dosyalar
  (`generated-types.ts`, `generated-schema.graphql`,
  `frontend/src/generated/graphql.ts`) elle düzenlenmez.
- Resolver'lar API client'ı `@services/prisma`'yı, worker'lar
  `@services/prisma-worker`'ı kullanır.
- Top sorgularının cache anahtarı
  `faction_stats:${factionId}:${statType}:${filter ?? 'ALL_TIME'}`, TTL:
  TODAY 120, LAST_7_DAYS 300, LAST_90_DAYS 900, ALL_TIME 3600 sn.
- Sayaç anahtarı `faction_stats:${factionId}:${counter}`, TTL 7200 sn.
- 500021 ESI'nin "Unknown" yer tutucusudur; kolonlara ham yazılır, okuyan
  ayıklar.
- Faction logosu `EveImage kind="corporation" id={faction.id}` ile çizilir.
- `topFactions` sorgusuna dokunulmaz.
- Commit mesajları İngilizce, `type(scope):` sonrası tamamen küçük harf,
  Claude atfı yok. Branch: `feat/faction-pages`, draft PR #256.
- Frontend doğrulaması `typecheck` / `lint` / `test` ve dev sunucusu
  çalışırken `build:check` ile yapılır, `build` ile değil.

## Review Focus

Spec'in ima ettiği ama hiçbir görevin ana testinin doğrudan hedeflemediği,
bir kullanıcıyı en çok ısırabilecek beş durum. Her birinin testi sahibi olan
göreve eklendi.

1. **Üye corporation sayacı ile Members sekmesi farklı sayar.** `corporations`
   resolver'ı `id >= 2000000` ile NPC corporation'ları eliyor
   (`resolvers/corporation/queries.ts:46`); veritabanında `faction_id`'si dolu
   6 NPC corporation var. Sayaç da aynı eşiği kullanmalı, yoksa rozet 463 der,
   sekme 457 listeler. → Görev 4, sayaç testi.
2. **Faction'ın corporation'ı veritabanında yok.** 27 faction'ın yalnızca
   18'inin `corporation_id`'si `corporations` tablosunda. Alan hata değil
   `null` dönmeli, sayfa "N/A" göstermeli. → Görev 5, fields testi.
3. **`corporation_id` / `solar_system_id` NULL.** `DataLoader.load(null)`
   hata fırlatır; resolver loader'a gitmeden `null` dönmeli. → Görev 5.
4. **Top Target Factions kendi faction'ını ya da "Unknown"u listeler.** Amarr
   militia'sı Amarr'lı bir pilotu da vurabilir; 500021 hiçbir yere link
   vermemeli. → Görev 4, sorgu testi.
5. **Attacker'ları kaydedilmemiş killmail'in dizisi NULL kalır.** Spec'in
   backfill'i yalnızca `attackers`'ta satırı olan killmail'leri günceller;
   geri kalan satırlar NULL kalır ve 7.2'deki "NULL kalmaz" kontrolü düşer.
   Migration üçüncü bir `UPDATE ... SET '{}' WHERE IS NULL` ile kapatır;
   yeni satırlar için `insertKillmailFilter` boş dizi yazar. → Görev 1 ve
   Görev 3.

## Spec'ten bilinçli sapmalar

- **`FactionCard` yolu.** Spec `components/FactionCard/FactionCard.tsx` diyor;
  `AllianceCard` ve diğer kartlar `components/Card/` altında. Kart
  `components/Card/FactionCard.tsx` olur.
- **Header'daki FACTIONS satırı bu planda yok.** ENTITIES menüsü henüz main'de
  değil (spec 5.3: menü PR'ı merge edilene kadar bekler).
- **Üçüncü backfill `UPDATE`'i** (Review Focus 5).

---

## Dosya haritası

**Backend**

| Dosya                                                             | Değişiklik                    |
| ----------------------------------------------------------------- | ----------------------------- |
| `backend/prisma/schema/faction.prisma`                            | üç yeni alan                  |
| `backend/prisma/schema/corporation.prisma`, `character.prisma`    | `@@index([faction_id])`       |
| `backend/prisma/migrations/<ts>_add_faction_pages/migration.sql`  | yeni                          |
| `backend/src/workers/worker-factions.ts`                          | üç alanı upsert eder          |
| `backend/src/services/killmail-filters-realtime.ts` (+ spec)      | iki kolon                     |
| `backend/src/services/killmail-derived.ts` (+ spec)               | iki alan                      |
| `backend/src/services/faction/faction-stats.service.ts` (+ spec)  | yeni                          |
| `backend/src/schemas/Faction.graphql`                             | yeni alanlar                  |
| `backend/src/schemas/FactionStats.graphql`                        | yeni                          |
| `backend/src/schemas/FactionTopTarget.graphql`                    | yeni                          |
| `backend/src/resolvers/faction/fields.ts` (+ spec)                | yeni alan resolver'ları       |
| `backend/src/resolvers/faction/stats-queries.ts`                  | yeni                          |
| `backend/src/resolvers/faction/index.ts`, `resolvers/index.ts`    | bağlama                       |
| `backend/src/schemas/KillmailFilter.graphql`                      | `factionId`                   |
| `backend/src/resolvers/killmail/filters-materialized.ts` (+ spec) | faction dalı                  |
| `backend/src/resolvers/killmail/queries.ts`                       | iki uyumluluk listesi         |
| `backend/src/schemas/Corporation.graphql`                         | `CorporationFilter.factionId` |
| `backend/src/resolvers/corporation/queries.ts` (+ spec)           | `where.faction_id`            |

**Frontend**

| Dosya                                                                  | Değişiklik      |
| ---------------------------------------------------------------------- | --------------- |
| `frontend/src/components/TopFactionsCard/TopFactionsCard.tsx` (+ spec) | satır link olur |
| `frontend/src/components/Footer/Footer.tsx`                            | "Factions"      |
| `frontend/src/graphql/Faction.graphql`                                 | yeni            |
| `frontend/src/graphql/FactionStats.graphql`                            | yeni            |
| `frontend/src/components/SovSystemBadge/SovSystemBadge.tsx`            | yeni            |
| `frontend/src/components/Card/FactionCard.tsx`                         | yeni            |
| `frontend/src/app/factions/page.tsx`                                   | yeni            |
| `frontend/src/app/factions/[id]/page.tsx`                              | yeni            |

---

### Görev 1: Migration — faction kolonları, backfill, index'ler

**Files:**

- Modify: `backend/prisma/schema/faction.prisma`
- Modify: `backend/prisma/schema/corporation.prisma`
- Modify: `backend/prisma/schema/character.prisma`
- Create: `backend/prisma/migrations/<timestamp>_add_faction_pages/migration.sql`

**Interfaces:**

- Produces: `killmail_filters.victim_faction_id int`,
  `killmail_filters.attacker_faction_ids int[]` (GIN index'li);
  `factions.solar_system_id`, `station_count`, `station_system_count`
  (Prisma alanları aynı adla); `corporations_faction_id_idx`,
  `characters_faction_id_idx`.

Bu görev test değil veri doğrulamasıyla kapanır. Tüm komutlar `backend/`
içinden.

- [ ] **Adım 1: Satır sayılarını kaydet**

```bash
cd backend
DB=$(grep -m1 '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
psql "$DB" -Atc "SELECT
  (SELECT COUNT(*) FROM killmail_filters),
  (SELECT COUNT(*) FROM character_kill_stats),
  (SELECT COUNT(*) FROM corporation_kill_stats),
  (SELECT COUNT(*) FROM alliance_kill_stats),
  (SELECT COUNT(*) FROM refresh_log);" | tee /tmp/faction-rowcounts-before.txt
```

2026-09-27'de: `112238|96315|31688|8085|13`. Worker'lar çalışıyorsa sayılar
artabilir, azalamaz.

- [ ] **Adım 2: Prisma şemasını güncelle**

`backend/prisma/schema/faction.prisma`:

```prisma
model Faction {
  id                     Int      @id
  name                   String
  description            String?
  corporation_id         Int?
  militia_corporation_id Int?
  solar_system_id        Int?
  station_count          Int?
  station_system_count   Int?
  created_at             DateTime @default(now())
  updated_at             DateTime @updatedAt

  @@map("factions")
}
```

`backend/prisma/schema/corporation.prisma`, mevcut `@@index([alliance_id])`
satırının altına:

```prisma
  @@index([faction_id])
```

`backend/prisma/schema/character.prisma`, `@@map("characters")` satırının
üstüne:

```prisma
  @@index([faction_id])
```

- [ ] **Adım 3: DDL'i üret ve incele**

```bash
npx prisma migrate diff --from-config-datasource prisma.config.ts \
  --to-schema prisma/schema --script > /tmp/faction-diff.sql
grep -n "^DROP\|^ALTER\|^CREATE" /tmp/faction-diff.sql
```

Beklenen: elle yönetilen beş tablo için `DROP TABLE` satırları, üç
`ALTER TABLE "factions" ADD COLUMN` (tek bir `ALTER TABLE` içinde de
gelebilir), `CREATE INDEX "corporations_faction_id_idx"` ve
`CREATE INDEX "characters_faction_id_idx"`. **Bunların dışında bir satır
varsa dur ve kullanıcıya sor**; başka bir drift'i bu migration'a karıştırma.

- [ ] **Adım 4: Migration dosyasını yaz**

```bash
TS=$(date -u +%Y%m%d%H%M%S)
mkdir -p prisma/migrations/${TS}_add_faction_pages
```

`prisma/migrations/${TS}_add_faction_pages/migration.sql` — diff'ten yalnızca
`factions` ve iki index bloğunu al, `DROP`'ların hiçbirini alma, sonra elle
yazılan kısmı ekle:

```sql
-- AlterTable
ALTER TABLE "factions" ADD COLUMN     "solar_system_id" INTEGER,
ADD COLUMN     "station_count" INTEGER,
ADD COLUMN     "station_system_count" INTEGER;

-- CreateIndex
CREATE INDEX "corporations_faction_id_idx" ON "corporations"("faction_id");

-- CreateIndex
CREATE INDEX "characters_faction_id_idx" ON "characters"("faction_id");

-- killmail_filters is not in prisma/schema/ (see CLAUDE.md, Database
-- migrations), so its faction columns are written by hand. They mirror
-- victim_alliance_id / attacker_alliance_ids: nullable, no default.
ALTER TABLE killmail_filters
  ADD COLUMN victim_faction_id    int,
  ADD COLUMN attacker_faction_ids int[];

CREATE INDEX idx_kmfilters_victim_faction
  ON killmail_filters(victim_faction_id);
CREATE INDEX idx_kmfilters_attacker_factions
  ON killmail_filters USING GIN(attacker_faction_ids);

-- Backfill. The raw ids are stored, 500021 ("Unknown") included; readers
-- filter it out.
UPDATE killmail_filters kf
SET    victim_faction_id = v.faction_id
FROM   victims v
WHERE  v.killmail_id = kf.killmail_id
  AND  v.faction_id IS NOT NULL;

UPDATE killmail_filters kf
SET    attacker_faction_ids = COALESCE(a.ids, '{}')
FROM   (SELECT killmail_id,
               array_agg(DISTINCT faction_id)
                 FILTER (WHERE faction_id IS NOT NULL) AS ids
        FROM   attackers
        GROUP  BY killmail_id) a
WHERE  a.killmail_id = kf.killmail_id;

-- A killmail whose attackers were never saved has no row in the subquery
-- above. insertKillmailFilter writes '{}' for it, so the backfill does too.
UPDATE killmail_filters
SET    attacker_faction_ids = '{}'
WHERE  attacker_faction_ids IS NULL;
```

Diff'in `factions` bloğu yukarıdakinden biçimce farklıysa diff'in çıktısını
kullan; içerik aynı olmalı.

- [ ] **Adım 5: Çalıştırılabilir DROP kalmadığını doğrula**

```bash
grep -n "^[^-]*DROP" prisma/migrations/*_add_faction_pages/migration.sql
```

Beklenen: çıktı yok.

- [ ] **Adım 6: Uygula ve client'ı üret**

```bash
npx prisma migrate deploy
npx prisma generate
```

Beklenen: `1 migration found ... applied`. `migrate deploy` hiçbir şey
silmez.

- [ ] **Adım 7: Satır sayılarını ve backfill'i doğrula**

```bash
psql "$DB" -Atc "SELECT
  (SELECT COUNT(*) FROM killmail_filters),
  (SELECT COUNT(*) FROM character_kill_stats),
  (SELECT COUNT(*) FROM corporation_kill_stats),
  (SELECT COUNT(*) FROM alliance_kill_stats),
  (SELECT COUNT(*) FROM refresh_log);"
cat /tmp/faction-rowcounts-before.txt
```

Beklenen: her sayı Adım 1'dekine eşit ya da büyük.

```bash
psql "$DB" -Atc "SELECT
  (SELECT COUNT(*) FROM killmail_filters WHERE attacker_faction_ids <> '{}'),
  (SELECT COUNT(DISTINCT killmail_id) FROM attackers WHERE faction_id IS NOT NULL),
  (SELECT COUNT(*) FROM killmail_filters WHERE victim_faction_id IS NOT NULL),
  (SELECT COUNT(*) FROM victims v JOIN killmail_filters kf USING (killmail_id)
     WHERE v.faction_id IS NOT NULL),
  (SELECT COUNT(*) FROM killmail_filters WHERE attacker_faction_ids IS NULL);"
```

Beklenen: 1. = 2., 3. = 4., 5. = 0. (Spec'teki 12.014, victim'ı
`killmail_filters`'ta satırı olanlarla sınırlanınca biraz farklı olabilir; 4.
sütun bu yüzden join'li.)

- [ ] **Adım 8: Commit**

```bash
git add backend/prisma/schema/faction.prisma backend/prisma/schema/corporation.prisma \
  backend/prisma/schema/character.prisma backend/prisma/migrations/*_add_faction_pages
git commit -m "feat(factions): add faction columns to killmail_filters and factions"
```

---

### Görev 2: `worker-factions` merkez sistemi ve istasyon sayılarını kaydeder

**Files:**

- Modify: `backend/src/workers/worker-factions.ts:22-35`

**Interfaces:**

- Consumes: `ESIFaction.solar_system_id?`, `station_count?`,
  `station_system_count?` (`services/faction/faction.service.ts`'te zaten var);
  Görev 1'in Prisma alanları.
- Produces: `factions` satırlarında dolu üç kolon.

Worker modül yüklenirken çalışıp `process.exit` çağırdığı için birim testi
yok; doğrulama worker'ı çalıştırıp tabloyu okumaktır.

- [ ] **Adım 1: Upsert'e üç alanı ekle**

`worker-factions.ts`'teki upsert:

```ts
const data = {
  name: faction.name,
  description: faction.description,
  corporation_id: faction.corporation_id ?? null,
  militia_corporation_id: faction.militia_corporation_id ?? null,
  solar_system_id: faction.solar_system_id ?? null,
  station_count: faction.station_count ?? null,
  station_system_count: faction.station_system_count ?? null,
};
await prismaWorker.faction.upsert({
  where: { id: faction.faction_id },
  create: { id: faction.faction_id, ...data },
  update: data,
});
```

- [ ] **Adım 2: Tip kontrolü**

Run: `yarn workspace backend build`
Expected: hatasız biter.

- [ ] **Adım 3: Worker'ı bir kez çalıştır**

Run: `cd backend && yarn worker:factions`
Expected: `✅ Faction sync completed! Total: 27`

- [ ] **Adım 4: Tabloyu oku**

```bash
psql "$DB" -Atc "SELECT COUNT(*), COUNT(solar_system_id), COUNT(station_count)
                 FROM factions;"
```

Expected: `27|N|M`, N ve M sıfırdan büyük (ESI bazı faction'lar için
alanları vermiyor, 27 olmaları gerekmez).

- [ ] **Adım 5: Commit**

```bash
git add backend/src/workers/worker-factions.ts
git commit -m "feat(factions): store each faction's home system and station counts"
```

---

### Görev 3: Yeni killmail'ler faction kolonlarını yazar

**Files:**

- Modify: `backend/src/services/killmail-filters-realtime.ts`
- Modify: `backend/src/services/killmail-filters-realtime.spec.ts`
- Modify: `backend/src/services/killmail-derived.ts`
- Modify: `backend/src/services/killmail-derived.spec.ts`

**Interfaces:**

- Consumes: `KillmailDetail.victim.faction_id?`,
  `KillmailDetail.attackers[].faction_id?`
  (`services/killmail/killmail.service.ts:22,49`).
- Produces: `KillmailFilterData.victim_faction_id: number | null`,
  `KillmailFilterData.attacker_faction_ids: (number | null)[]`. Bağlanan
  değerlerin sırası: 8 skaler, **`victim_faction_id` dokuzuncu**, sonra beş
  dizi, **`attacker_faction_ids` en sonda** (toplam 14).

- [ ] **Adım 1: `killmail-filters-realtime.spec.ts`'i güncelle (başarısız test)**

`BASE`'e iki alan ekle:

```ts
  victim_alliance_id: 99005338,
  victim_faction_id: 500003 as number | null,
  attacker_ship_type_ids: [] as (number | null)[],
  attacker_character_ids: [] as (number | null)[],
  attacker_corporation_ids: [] as (number | null)[],
  attacker_alliance_ids: [] as (number | null)[],
  attacker_faction_ids: [] as (number | null)[],
```

`arrays()` yardımcısını beş diziye çıkar:

```ts
/** The five attacker arrays, which are the last five bound values. */
function arrays() {
  const bound = values();
  const [ships, characters, corporations, alliances, factions] = bound.slice(
    -5,
  ) as [number[], number[], number[], number[], number[]];
  return { ships, characters, corporations, alliances, factions };
}
```

Mevcut iki `toEqual({ ships, characters, corporations, alliances })`
beklentisine `factions: []` ekle ve ilk teste `attacker_faction_ids: [500003,
null, 500003, 500021]` girdisiyle `factions: [500003, 500021]` beklentisini
koy. NPC testine `attacker_faction_ids: [null]` ekle.

"binds every caller-supplied column" testini dokuz değere çıkar:

```ts
expect(values().slice(0, 9)).toEqual([
  130000001n,
  BASE.killmail_time,
  30000142,
  3,
  587,
  95465499,
  98000001,
  99005338,
  500003,
]);
```

"derives location…" testinde `expect(values()).toHaveLength(14);` ve yorumu
"Fourteen bound values" yap. "never rewrites the attacker arrays" testine:

```ts
expect(onConflict).not.toContain('attacker_faction_ids');
expect(onConflict).not.toContain('victim_faction_id');
```

Yeni test (`describe('the statement')` içine):

```ts
it('writes both faction columns', async () => {
  await insert();
  const insertPart = sql().split('ON CONFLICT')[0];

  expect(insertPart).toContain('victim_faction_id');
  expect(insertPart).toContain('attacker_faction_ids');
});
```

- [ ] **Adım 2: Başarısız olduğunu gör**

Run: `yarn workspace backend test src/services/killmail-filters-realtime.spec.ts`
Expected: FAIL — `values()` 12 uzunlukta, `factions` undefined.

- [ ] **Adım 3: `insertKillmailFilter`'ı güncelle**

`KillmailFilterData`:

```ts
  victim_alliance_id: number | null;
  victim_faction_id: number | null;
  attacker_ship_type_ids: (number | null)[];
  attacker_character_ids: (number | null)[];
  attacker_corporation_ids: (number | null)[];
  attacker_alliance_ids: (number | null)[];
  attacker_faction_ids: (number | null)[];
```

`allianceIds`'in altına:

```ts
const factionIds = [
  ...new Set(
    data.attacker_faction_ids.filter((id): id is number => id !== null),
  ),
];
```

`data_row` CTE'sinde `victim_alliance_id` satırının altına
`${data.victim_faction_id}::int as victim_faction_id,` ve
`attacker_alliance_ids` satırını `${allianceIds}::int[] as attacker_alliance_ids,`
yapıp altına `${factionIds}::int[] as attacker_faction_ids`. `INSERT` kolon
listesinde `victim_alliance_id,` altına `victim_faction_id,`,
`attacker_alliance_ids,` altına `attacker_faction_ids,`. `SELECT` listesinde
aynı yerlere `d.victim_faction_id,` ve `d.attacker_faction_ids,`. `ON
CONFLICT` bloğuna dokunma.

- [ ] **Adım 4: Testin geçtiğini gör**

Run: `yarn workspace backend test src/services/killmail-filters-realtime.spec.ts`
Expected: PASS.

- [ ] **Adım 5: `killmail-derived.spec.ts`'e başarısız test ekle**

`detail()` içinde victim'a `faction_id: 500003`, ilk attacker'a
`faction_id: 500003` ekle (ikincisi faction'sız kalır). `describe('toFilterInput')`
içine:

```ts
it('carries the victim faction, and a missing one as null', () => {
  expect(toFilterInput(detail()).victim_faction_id).toBe(500003);
  expect(
    toFilterInput(
      detail({
        victim: {
          corporation_id: 98000001,
          ship_type_id: 670,
          damage_taken: 1,
        },
      }),
    ).victim_faction_id,
  ).toBeNull();
});

it('passes the attacker factions through unreduced', () => {
  expect(toFilterInput(detail()).attacker_faction_ids).toEqual([500003, null]);
});
```

- [ ] **Adım 6: Başarısız olduğunu gör**

Run: `yarn workspace backend test src/services/killmail-derived.spec.ts`
Expected: FAIL — `victim_faction_id` undefined. (Tip hatası da verebilir;
Vitest yine de çalışır.)

- [ ] **Adım 7: `toFilterInput`'u güncelle**

```ts
    victim_alliance_id: orNull(detail.victim.alliance_id),
    victim_faction_id: orNull(detail.victim.faction_id),
    ...
    attacker_alliance_ids: detail.attackers.map((a) => orNull(a.alliance_id)),
    attacker_faction_ids: detail.attackers.map((a) => orNull(a.faction_id)),
```

- [ ] **Adım 8: Backend testlerinin ve tiplerin geçtiğini gör**

Run: `yarn workspace backend test && yarn workspace backend build`
Expected: tümü PASS, `tsc` hatasız. (`repair-killmail-derived.ts` da
`toFilterInput` üzerinden geçtiği için ayrıca değişiklik gerekmez; `tsc`
aksi halde onu yakalar.)

- [ ] **Adım 9: Migration ile bu görev arasında yazılan satırları kapat**

Görev 1 ile bu görevin arasında çalışan bir worker eski kodla satır yazmış
olabilir. İki backfill'i yalnızca eksik satırlar için tekrar çalıştır:

```bash
psql "$DB" -c "
UPDATE killmail_filters kf SET victim_faction_id = v.faction_id
FROM victims v
WHERE v.killmail_id = kf.killmail_id AND v.faction_id IS NOT NULL
  AND kf.victim_faction_id IS NULL;
UPDATE killmail_filters kf SET attacker_faction_ids = COALESCE(a.ids, '{}')
FROM (SELECT killmail_id, array_agg(DISTINCT faction_id)
             FILTER (WHERE faction_id IS NOT NULL) AS ids
      FROM attackers GROUP BY killmail_id) a
WHERE a.killmail_id = kf.killmail_id AND kf.attacker_faction_ids IS NULL;
UPDATE killmail_filters SET attacker_faction_ids = '{}'
WHERE attacker_faction_ids IS NULL;"
```

Sonra Görev 1 Adım 7'deki ikinci sorguyu tekrar çalıştır; aynı eşitlikler
tutmalı. Çalışan bir worker yoksa `UPDATE 0` döner.

- [ ] **Adım 10: Commit**

```bash
git add backend/src/services/killmail-filters-realtime.ts \
  backend/src/services/killmail-filters-realtime.spec.ts \
  backend/src/services/killmail-derived.ts backend/src/services/killmail-derived.spec.ts
git commit -m "feat(factions): write victim and attacker factions to killmail_filters"
```

---

### Görev 4: `faction-stats.service.ts`

**Files:**

- Create: `backend/src/services/faction/faction-stats.service.ts`
- Create: `backend/src/services/faction/faction-stats.service.spec.ts`

**Interfaces:**

- Consumes: Görev 1'in kolonları.
- Produces (hepsi `(factionId: number, filter?: string | null)` alır,
  sayaçlar yalnızca `factionId`):
  - `getFactionTopCharacters` →
    `Promise<Array<{ killCount: number; character: { id: number; name: string; security_status: number | null; corporation_id: number; alliance_id: number | null } }>>`
  - `getFactionTopCorporations` →
    `Promise<Array<{ killCount: number; corporation: { id: number; name: string; ticker: string } }>>`
  - `getFactionTopShips`, `getFactionTopShipTargets` →
    `Promise<Array<{ killCount: number; shipType: { id: number; name: string } }>>`
  - `getFactionTopFactionTargets` →
    `Promise<Array<{ killCount: number; faction: { id: number; name: string } }>>`
  - `getMemberCorporationCount`, `getMemberCharacterCount`,
    `getSovereigntySystemCount` → `Promise<number>`

Karakter satırı Prisma kolon adlarıyla (`security_status`, `corporation_id`,
`alliance_id`) döner; `characterFields` bunları `securityStatus`,
`corporation`, `alliance`'a kendisi çevirir
(`resolvers/character/fields.ts:9-58`).

- [ ] **Adım 1: Başarısız testleri yaz**

`backend/src/services/faction/faction-stats.service.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The faction read service: Redis get, then the database, then Redis setex,
 * with every filter parameter in the key. What is pinned here is what would
 * return a wrong number rather than throw: a key that loses the filter, a
 * BigInt that reaches JSON.stringify, a member count that disagrees with the
 * Members tab, and a target list that includes the faction itself.
 */

const { prisma, redis } = vi.hoisted(() => ({
  prisma: {
    $queryRaw: vi.fn(),
    corporation: { count: vi.fn() },
    character: { count: vi.fn() },
    sovereigntyMapCurrent: { count: vi.fn() },
  },
  redis: { get: vi.fn(), setex: vi.fn() },
}));

vi.mock('@services/prisma', () => ({ default: prisma }));
vi.mock('@services/redis', () => ({ default: redis, redis }));

import * as FactionStats from './faction-stats.service';

const AMARR = 500003;

function querySql(call = 0) {
  const [strings] = prisma.$queryRaw.mock.calls[call] as [TemplateStringsArray];
  return strings.join(' ? ').replace(/\s+/g, ' ');
}

/** Bound values, flattened through nested Prisma.sql fragments. */
function queryValues(call = 0): unknown[] {
  const [, ...values] = prisma.$queryRaw.mock.calls[call] as [
    TemplateStringsArray,
    ...unknown[],
  ];
  return values.flatMap((v) =>
    v && typeof v === 'object' && 'values' in v
      ? (v as { values: unknown[] }).values
      : [v],
  );
}

beforeEach(() => {
  redis.get.mockResolvedValue(null);
  redis.setex.mockResolvedValue('OK');
  prisma.$queryRaw.mockResolvedValue([]);
  prisma.corporation.count.mockResolvedValue(0);
  prisma.character.count.mockResolvedValue(0);
  prisma.sovereigntyMapCurrent.count.mockResolvedValue(0);
});

const TOP_QUERIES = [
  ['getFactionTopCharacters', 'characters'],
  ['getFactionTopCorporations', 'corporations'],
  ['getFactionTopShips', 'top_ships'],
  ['getFactionTopFactionTargets', 'factions'],
  ['getFactionTopShipTargets', 'ships'],
] as const;

describe.each(TOP_QUERIES)('%s', (fn, statType) => {
  const call = (filter?: string | null) =>
    (FactionStats[fn] as (id: number, f?: string | null) => Promise<unknown>)(
      AMARR,
      filter,
    );

  it('serves a cache hit without touching the database', async () => {
    redis.get.mockResolvedValue(JSON.stringify([{ killCount: 7 }]));

    await expect(call('LAST_7_DAYS')).resolves.toEqual([{ killCount: 7 }]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('keys the cache on faction, stat type and filter', async () => {
    await call('LAST_7_DAYS');

    expect(redis.get).toHaveBeenCalledWith(
      `faction_stats:${AMARR}:${statType}:LAST_7_DAYS`,
    );
  });

  it('keys a missing filter as ALL_TIME', async () => {
    await call(null);

    expect(redis.get).toHaveBeenCalledWith(
      `faction_stats:${AMARR}:${statType}:ALL_TIME`,
    );
  });

  it.each([
    ['TODAY', 120],
    ['LAST_7_DAYS', 300],
    ['LAST_90_DAYS', 900],
    [null, 3600],
  ])('caches %s for %i seconds', async (filter, ttl) => {
    await call(filter);

    expect(redis.setex).toHaveBeenCalledWith(
      expect.any(String),
      ttl,
      expect.any(String),
    );
  });

  it('binds the faction id rather than interpolating it', async () => {
    await call('LAST_7_DAYS');

    expect(queryValues()).toContain(AMARR);
    expect(querySql()).not.toContain(String(AMARR));
  });

  it('narrows to the faction through the GIN-indexed array', async () => {
    await call('LAST_7_DAYS');

    expect(querySql()).toContain('ANY(kf.attacker_faction_ids)');
  });
});

describe('the attacker-side queries', () => {
  it.each([
    'getFactionTopCharacters',
    'getFactionTopCorporations',
    'getFactionTopShips',
  ] as const)(
    '%s counts only attackers who fought for the faction',
    async (fn) => {
      await FactionStats[fn](AMARR, 'LAST_7_DAYS');

      // The array says which factions were on the killmail, not which pilot
      // fought for which one.
      expect(querySql()).toContain('a.faction_id = ?');
    },
  );

  it('converts BigInt counts before caching', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        character_id: 90000001,
        character_name: 'Pilot',
        security_status: -1.2,
        corporation_id: 1000179,
        alliance_id: null,
        kill_count: 42n,
      },
    ]);

    const result = await FactionStats.getFactionTopCharacters(AMARR, null);

    expect(result).toEqual([
      {
        killCount: 42,
        character: {
          id: 90000001,
          name: 'Pilot',
          security_status: -1.2,
          corporation_id: 1000179,
          alliance_id: null,
        },
      },
    ]);
    expect(() => JSON.parse(redis.setex.mock.calls[0][2])).not.toThrow();
  });

  it('counts a corporation once per killmail, not once per pilot', async () => {
    await FactionStats.getFactionTopCorporations(AMARR, null);

    expect(querySql()).toContain('COUNT(DISTINCT kf.killmail_id)');
  });
});

describe('getFactionTopFactionTargets', () => {
  it('leaves out the faction itself and the Unknown placeholder', async () => {
    await FactionStats.getFactionTopFactionTargets(AMARR, null);

    expect(querySql()).toContain('kf.victim_faction_id <> ?');
    expect(queryValues().filter((v) => v === AMARR).length).toBe(2);
    expect(queryValues()).toContain(500021);
  });

  it('maps rows to a faction and a numeric count', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        victim_faction_id: 500001,
        faction_name: 'Caldari State',
        kill_count: 3n,
      },
    ]);

    await expect(
      FactionStats.getFactionTopFactionTargets(AMARR, null),
    ).resolves.toEqual([
      { killCount: 3, faction: { id: 500001, name: 'Caldari State' } },
    ]);
  });
});

describe('the counters', () => {
  it('counts only player corporations, matching the Members tab', async () => {
    prisma.corporation.count.mockResolvedValue(457);

    await expect(FactionStats.getMemberCorporationCount(AMARR)).resolves.toBe(
      457,
    );
    expect(prisma.corporation.count).toHaveBeenCalledWith({
      where: { faction_id: AMARR, id: { gte: 2000000 } },
    });
  });

  it.each([
    ['getMemberCorporationCount', 'member_corporations'],
    ['getMemberCharacterCount', 'member_characters'],
    ['getSovereigntySystemCount', 'sov_systems'],
  ] as const)('%s caches under %s for two hours', async (fn, counter) => {
    await FactionStats[fn](AMARR);

    expect(redis.setex).toHaveBeenCalledWith(
      `faction_stats:${AMARR}:${counter}`,
      7200,
      expect.any(String),
    );
  });

  it('treats a cached zero as a hit', async () => {
    redis.get.mockResolvedValue('0');

    await expect(FactionStats.getSovereigntySystemCount(AMARR)).resolves.toBe(
      0,
    );
    expect(prisma.sovereigntyMapCurrent.count).not.toHaveBeenCalled();
  });

  it('counts characters and sovereignty systems by faction_id', async () => {
    await FactionStats.getMemberCharacterCount(AMARR);
    await FactionStats.getSovereigntySystemCount(AMARR);

    expect(prisma.character.count).toHaveBeenCalledWith({
      where: { faction_id: AMARR },
    });
    expect(prisma.sovereigntyMapCurrent.count).toHaveBeenCalledWith({
      where: { faction_id: AMARR },
    });
  });
});
```

- [ ] **Adım 2: Başarısız olduğunu gör**

Run: `yarn workspace backend test src/services/faction/faction-stats.service.spec.ts`
Expected: FAIL — `Cannot find module './faction-stats.service'`.

- [ ] **Adım 3: Servisi yaz**

`backend/src/services/faction/faction-stats.service.ts`:

```ts
/**
 * Faction Statistics Service
 *
 * The read path behind the faction pages: five top lists for the Killmails
 * tab and three counters for the header and the /factions cards. Every
 * function is redis.get → query → redis.setex, with every filter parameter
 * in the key.
 *
 * A killmail belongs to a faction by the faction ids on the killmail itself
 * (killmail_filters.victim_faction_id / attacker_faction_ids), as ESI
 * recorded them at the time of the kill. The counters use today's
 * faction_id on corporations and characters instead.
 */

import { Prisma } from '@generated/prisma/client';
import prisma from '@services/prisma';
import redis from '@services/redis';

/** ESI's placeholder faction. Its name is literally "Unknown". */
const UNKNOWN_FACTION_ID = 500021;

/**
 * NPC corporations sit below this id. The corporations resolver drops them
 * (resolvers/corporation/queries.ts), so the counter must too, or the header
 * would count corporations the Members tab never lists.
 */
const PLAYER_CORPORATION_MIN_ID = 2_000_000;

const COUNTER_TTL = 7200;

function timeFilter(filter: string | null | undefined): Prisma.Sql {
  switch (filter) {
    case 'LAST_90_DAYS':
      return Prisma.sql`AND kf.killmail_time >= NOW() - INTERVAL '90 days'`;
    case 'LAST_7_DAYS':
      return Prisma.sql`AND kf.killmail_time >= NOW() - INTERVAL '7 days'`;
    case 'TODAY':
      return Prisma.sql`AND DATE(kf.killmail_time) = CURRENT_DATE`;
    default:
      return Prisma.sql``; // ALL_TIME – no constraint
  }
}

function calculateTTL(filter?: string | null): number {
  switch (filter) {
    case 'TODAY':
      return 120;
    case 'LAST_7_DAYS':
      return 300;
    case 'LAST_90_DAYS':
      return 900;
    default:
      return 3600;
  }
}

function topKey(
  factionId: number,
  statType: string,
  filter?: string | null,
): string {
  return `faction_stats:${factionId}:${statType}:${filter || 'ALL_TIME'}`;
}

async function cached<T>(
  key: string,
  ttl: number,
  load: () => Promise<T>,
): Promise<T> {
  const hit = await redis.get(key);
  if (hit) return JSON.parse(hit);

  const value = await load();
  await redis.setex(key, ttl, JSON.stringify(value));
  return value;
}

/** Top 10 pilots by kills made while flying for the faction. */
export async function getFactionTopCharacters(
  factionId: number,
  filter?: string | null,
) {
  type Row = {
    character_id: number;
    character_name: string;
    security_status: number | null;
    corporation_id: number;
    alliance_id: number | null;
    kill_count: bigint;
  };

  return cached(
    topKey(factionId, 'characters', filter),
    calculateTTL(filter),
    async () => {
      const rows = await prisma.$queryRaw<Row[]>`
        SELECT
          a.character_id,
          ch.name AS character_name,
          ch.security_status,
          ch.corporation_id,
          ch.alliance_id,
          COUNT(*)::BIGINT AS kill_count
        FROM killmail_filters kf
        INNER JOIN attackers a ON a.killmail_id = kf.killmail_id
        INNER JOIN characters ch ON ch.id = a.character_id
        WHERE ${factionId} = ANY(kf.attacker_faction_ids)
          AND a.faction_id = ${factionId}
          AND a.character_id IS NOT NULL
          ${timeFilter(filter)}
        GROUP BY a.character_id, ch.name, ch.security_status,
                 ch.corporation_id, ch.alliance_id
        ORDER BY kill_count DESC
        LIMIT 10
      `;

      return rows.map((row) => ({
        killCount: Number(row.kill_count),
        character: {
          id: row.character_id,
          name: row.character_name,
          security_status: row.security_status,
          corporation_id: row.corporation_id,
          alliance_id: row.alliance_id,
        },
      }));
    },
  );
}

/** Top 10 corporations by killmails their pilots made for the faction. */
export async function getFactionTopCorporations(
  factionId: number,
  filter?: string | null,
) {
  type Row = {
    corporation_id: number;
    corporation_name: string;
    corporation_ticker: string;
    kill_count: bigint;
  };

  return cached(
    topKey(factionId, 'corporations', filter),
    calculateTTL(filter),
    async () => {
      const rows = await prisma.$queryRaw<Row[]>`
        SELECT
          a.corporation_id,
          co.name AS corporation_name,
          co.ticker AS corporation_ticker,
          COUNT(DISTINCT kf.killmail_id)::BIGINT AS kill_count
        FROM killmail_filters kf
        INNER JOIN attackers a ON a.killmail_id = kf.killmail_id
        INNER JOIN corporations co ON co.id = a.corporation_id
        WHERE ${factionId} = ANY(kf.attacker_faction_ids)
          AND a.faction_id = ${factionId}
          ${timeFilter(filter)}
        GROUP BY a.corporation_id, co.name, co.ticker
        ORDER BY kill_count DESC
        LIMIT 10
      `;

      return rows.map((row) => ({
        killCount: Number(row.kill_count),
        corporation: {
          id: row.corporation_id,
          name: row.corporation_name,
          ticker: row.corporation_ticker,
        },
      }));
    },
  );
}

/** Top 10 ship types the faction's pilots flew on kills. */
export async function getFactionTopShips(
  factionId: number,
  filter?: string | null,
) {
  type Row = { ship_type_id: number; ship_name: string; kill_count: bigint };

  return cached(
    topKey(factionId, 'top_ships', filter),
    calculateTTL(filter),
    async () => {
      const rows = await prisma.$queryRaw<Row[]>`
        SELECT
          a.ship_type_id,
          t.name AS ship_name,
          COUNT(*)::BIGINT AS kill_count
        FROM killmail_filters kf
        INNER JOIN attackers a ON a.killmail_id = kf.killmail_id
        INNER JOIN types t ON t.id = a.ship_type_id
        WHERE ${factionId} = ANY(kf.attacker_faction_ids)
          AND a.faction_id = ${factionId}
          AND a.ship_type_id IS NOT NULL
          ${timeFilter(filter)}
        GROUP BY a.ship_type_id, t.name
        ORDER BY kill_count DESC
        LIMIT 10
      `;

      return rows.map((row) => ({
        killCount: Number(row.kill_count),
        shipType: { id: row.ship_type_id, name: row.ship_name },
      }));
    },
  );
}

/**
 * Top 10 other factions whose pilots the faction killed. The faction itself
 * and the Unknown placeholder are left out.
 */
export async function getFactionTopFactionTargets(
  factionId: number,
  filter?: string | null,
) {
  type Row = {
    victim_faction_id: number;
    faction_name: string;
    kill_count: bigint;
  };

  return cached(
    topKey(factionId, 'factions', filter),
    calculateTTL(filter),
    async () => {
      const rows = await prisma.$queryRaw<Row[]>`
        SELECT
          kf.victim_faction_id,
          f.name AS faction_name,
          COUNT(*)::BIGINT AS kill_count
        FROM killmail_filters kf
        INNER JOIN factions f ON f.id = kf.victim_faction_id
        WHERE ${factionId} = ANY(kf.attacker_faction_ids)
          AND kf.victim_faction_id <> ${factionId}
          AND kf.victim_faction_id <> ${UNKNOWN_FACTION_ID}
          ${timeFilter(filter)}
        GROUP BY kf.victim_faction_id, f.name
        ORDER BY kill_count DESC
        LIMIT 10
      `;

      return rows.map((row) => ({
        killCount: Number(row.kill_count),
        faction: { id: row.victim_faction_id, name: row.faction_name },
      }));
    },
  );
}

/** Top 10 victim ship types on the faction's kills. */
export async function getFactionTopShipTargets(
  factionId: number,
  filter?: string | null,
) {
  type Row = {
    victim_ship_type_id: number;
    ship_name: string;
    kill_count: bigint;
  };

  return cached(
    topKey(factionId, 'ships', filter),
    calculateTTL(filter),
    async () => {
      const rows = await prisma.$queryRaw<Row[]>`
        SELECT
          kf.victim_ship_type_id,
          t.name AS ship_name,
          COUNT(*)::BIGINT AS kill_count
        FROM killmail_filters kf
        INNER JOIN types t ON t.id = kf.victim_ship_type_id
        WHERE ${factionId} = ANY(kf.attacker_faction_ids)
          AND kf.victim_ship_type_id IS NOT NULL
          ${timeFilter(filter)}
        GROUP BY kf.victim_ship_type_id, t.name
        ORDER BY kill_count DESC
        LIMIT 10
      `;

      return rows.map((row) => ({
        killCount: Number(row.kill_count),
        shipType: { id: row.victim_ship_type_id, name: row.ship_name },
      }));
    },
  );
}

export async function getMemberCorporationCount(
  factionId: number,
): Promise<number> {
  return cached(
    `faction_stats:${factionId}:member_corporations`,
    COUNTER_TTL,
    () =>
      prisma.corporation.count({
        where: {
          faction_id: factionId,
          id: { gte: PLAYER_CORPORATION_MIN_ID },
        },
      }),
  );
}

export async function getMemberCharacterCount(
  factionId: number,
): Promise<number> {
  return cached(
    `faction_stats:${factionId}:member_characters`,
    COUNTER_TTL,
    () => prisma.character.count({ where: { faction_id: factionId } }),
  );
}

export async function getSovereigntySystemCount(
  factionId: number,
): Promise<number> {
  return cached(`faction_stats:${factionId}:sov_systems`, COUNTER_TTL, () =>
    prisma.sovereigntyMapCurrent.count({ where: { faction_id: factionId } }),
  );
}
```

- [ ] **Adım 4: Testlerin geçtiğini gör**

Run: `yarn workspace backend test src/services/faction/faction-stats.service.spec.ts`
Expected: PASS. `queryValues()` yardımcısı `timeFilter`'ın döndüğü iç içe
`Prisma.sql`'i düzleştirir; `querySql()` iç içe parçayı `?` olarak gösterir,
bu yüzden `'a.faction_id = ?'` beklentisi tutar.

- [ ] **Adım 5: Commit**

```bash
git add backend/src/services/faction/faction-stats.service.ts \
  backend/src/services/faction/faction-stats.service.spec.ts
git commit -m "feat(factions): add the faction stats read service"
```

---

### Görev 5: GraphQL — `Faction` alanları ve beş stats sorgusu

**Files:**

- Modify: `backend/src/schemas/Faction.graphql`
- Create: `backend/src/schemas/FactionTopTarget.graphql`
- Create: `backend/src/schemas/FactionStats.graphql`
- Modify: `backend/src/resolvers/faction/fields.ts`
- Modify: `backend/src/resolvers/faction/fields.spec.ts`
- Create: `backend/src/resolvers/faction/stats-queries.ts`
- Modify: `backend/src/resolvers/faction/index.ts`
- Modify: `backend/src/resolvers/index.ts:35,84`

**Interfaces:**

- Consumes: Görev 4'ün sekiz fonksiyonu;
  `context.loaders.solarSystem`, `context.loaders.corporation`.
- Produces: GraphQL `Faction.{solarSystem, stationCount, stationSystemCount,
corporation, militiaCorporation, memberCorporationCount,
memberCharacterCount, sovereigntySystemCount}`; `Query.factionTopCharacters`,
  `factionTopCorporations`, `factionTopShips`, `factionTopFactionTargets`,
  `factionTopShipTargets` (hepsi `(factionId: Int!, filter: TopTargetFilter)`);
  `FactionTopTarget { faction: Faction!, killCount: Int! }`.

- [ ] **Adım 1: Şemayı yaz**

`backend/src/schemas/Faction.graphql`:

```graphql
type Faction {
  id: Int!
  name: String!
  description: String
  corporationId: Int
  militiaCorporationId: Int
  solarSystem: SolarSystem
  stationCount: Int
  stationSystemCount: Int
  corporation: Corporation
  militiaCorporation: Corporation
  memberCorporationCount: Int!
  memberCharacterCount: Int!
  sovereigntySystemCount: Int!
}

extend type Query {
  faction(id: Int!): Faction
  factions: [Faction!]!
}
```

`backend/src/schemas/FactionTopTarget.graphql`:

```graphql
type FactionTopTarget {
  faction: Faction!
  killCount: Int!
}
```

`backend/src/schemas/FactionStats.graphql`:

```graphql
# Faction statistics - independent top-level queries, like AllianceStats.
# A killmail belongs to a faction by the faction ids ESI recorded on it.

extend type Query {
  # Top 10 pilots by kills made while flying for the faction
  factionTopCharacters(
    factionId: Int!
    filter: TopTargetFilter
  ): [CharacterTopTarget!]!

  # Top 10 corporations by killmails their pilots made for the faction
  factionTopCorporations(
    factionId: Int!
    filter: TopTargetFilter
  ): [CorporationTopTarget!]!

  # Top 10 ship types the faction's pilots flew on kills
  factionTopShips(factionId: Int!, filter: TopTargetFilter): [ShipTopKill!]!

  # Top 10 other factions the faction killed (itself and Unknown excluded)
  factionTopFactionTargets(
    factionId: Int!
    filter: TopTargetFilter
  ): [FactionTopTarget!]!

  # Top 10 victim ship types on the faction's kills
  factionTopShipTargets(
    factionId: Int!
    filter: TopTargetFilter
  ): [ShipTopKill!]!
}
```

- [ ] **Adım 2: Codegen**

Run: `yarn workspace backend codegen`
Expected: `generated-types.ts` ve `generated-schema.graphql` yeniden yazılır,
hata yok.

- [ ] **Adım 3: `fields.spec.ts`'e başarısız testler ekle**

Mevcut `resolve()` yardımcısını ve testleri koru; dosyanın başına mock'ları,
sonuna yeni blokları ekle:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { stats } = vi.hoisted(() => ({
  stats: {
    getMemberCorporationCount: vi.fn(),
    getMemberCharacterCount: vi.fn(),
    getSovereigntySystemCount: vi.fn(),
  },
}));

vi.mock('@services/faction/faction-stats.service', () => stats);

import { factionFields } from './fields';
```

```ts
/** A field resolver called the way Yoga calls it. */
function resolveWith(field: keyof typeof factionFields, parent: unknown) {
  const resolver = factionFields[field] as (
    parent: unknown,
    args: unknown,
    context: unknown,
  ) => unknown;
  return resolver(parent, {}, context);
}

const context = {
  loaders: {
    solarSystem: { load: vi.fn() },
    corporation: { load: vi.fn() },
  },
};

beforeEach(() => {
  context.loaders.solarSystem.load.mockResolvedValue(null);
  context.loaders.corporation.load.mockResolvedValue(null);
});

describe('factionFields relations', () => {
  it('loads the home system through the DataLoader', async () => {
    const system = { system_id: 30002187, name: 'Amarr' };
    context.loaders.solarSystem.load.mockResolvedValue(system);

    await expect(
      resolveWith('solarSystem', { solar_system_id: 30002187 }),
    ).resolves.toBe(system);
    expect(context.loaders.solarSystem.load).toHaveBeenCalledWith(30002187);
  });

  it.each(['solarSystem', 'corporation', 'militiaCorporation'] as const)(
    '%s is null without calling the loader when the id is null',
    async (field) => {
      await expect(resolveWith(field, {})).resolves.toBeNull();
      expect(context.loaders.solarSystem.load).not.toHaveBeenCalled();
      expect(context.loaders.corporation.load).not.toHaveBeenCalled();
    },
  );

  it('is null when the corporation is not in the database', async () => {
    await expect(
      resolveWith('corporation', { corporation_id: 1000084 }),
    ).resolves.toBeNull();
  });

  it('returns the militia corporation with date_founded as a string', async () => {
    context.loaders.corporation.load.mockResolvedValue({
      id: 1000179,
      name: '24th Imperial Crusade',
      date_founded: new Date('2003-05-06T00:00:00.000Z'),
    });

    await expect(
      resolveWith('militiaCorporation', { militia_corporation_id: 1000179 }),
    ).resolves.toMatchObject({
      id: 1000179,
      date_founded: '2003-05-06T00:00:00.000Z',
    });
  });

  it('maps the station columns', () => {
    const parent = { station_count: 12, station_system_count: 4 };

    expect(resolveWith('stationCount', parent)).toBe(12);
    expect(resolveWith('stationSystemCount', parent)).toBe(4);
    expect(resolveWith('stationCount', {})).toBeNull();
  });
});

describe('factionFields counters', () => {
  it.each([
    ['memberCorporationCount', 'getMemberCorporationCount'],
    ['memberCharacterCount', 'getMemberCharacterCount'],
    ['sovereigntySystemCount', 'getSovereigntySystemCount'],
  ] as const)('%s delegates to %s', async (field, fn) => {
    stats[fn].mockResolvedValue(9);

    await expect(resolveWith(field, { id: 500003 })).resolves.toBe(9);
    expect(stats[fn]).toHaveBeenCalledWith(500003);
  });
});
```

(Dosyadaki eski `import { describe, expect, it } from 'vitest';` ve
`import { factionFields } from './fields';` satırlarını yukarıdakilerle
değiştir; iki import tekrar edilmemeli.)

- [ ] **Adım 4: Başarısız olduğunu gör**

Run: `yarn workspace backend test src/resolvers/faction/fields.spec.ts`
Expected: FAIL — `factionFields.solarSystem is not a function`.

- [ ] **Adım 5: `fields.ts`'i yaz**

```ts
import { FactionResolvers } from '@generated-types';
import * as FactionStatsService from '@services/faction/faction-stats.service';

/**
 * Loads a corporation by id, or null without touching the loader when the
 * id is null: DataLoader.load() throws on a null key. A faction's
 * corporation is often an NPC corporation that is not in the database, and
 * the loader answers null for those too.
 */
async function loadCorporation(context: any, id: number | null | undefined) {
  if (!id) return null;
  const corporation = await context.loaders.corporation.load(id);
  if (!corporation) return null;
  return {
    ...corporation,
    date_founded: corporation.date_founded?.toISOString() || null,
  };
}

/**
 * Faction Field Resolvers
 * Maps Prisma's snake_case columns to GraphQL's camelCase fields, follows
 * relations through DataLoaders and delegates counters to the stats service.
 */
export const factionFields: FactionResolvers = {
  // Map Prisma's corporation_id (snake_case) to GraphQL's corporationId
  corporationId: (parent) => {
    const prismaParent = parent as any;
    return prismaParent.corporation_id ?? null;
  },

  // Map Prisma's militia_corporation_id (snake_case) to GraphQL's militiaCorporationId
  militiaCorporationId: (parent) => {
    const prismaParent = parent as any;
    return prismaParent.militia_corporation_id ?? null;
  },

  stationCount: (parent) => (parent as any).station_count ?? null,

  stationSystemCount: (parent) => (parent as any).station_system_count ?? null,

  solarSystem: async (parent, _args, context) => {
    const id = (parent as any).solar_system_id;
    if (!id) return null;
    return context.loaders.solarSystem.load(id);
  },

  corporation: (parent, _args, context) =>
    loadCorporation(context, (parent as any).corporation_id),

  militiaCorporation: (parent, _args, context) =>
    loadCorporation(context, (parent as any).militia_corporation_id),

  memberCorporationCount: (parent) =>
    FactionStatsService.getMemberCorporationCount(parent.id),

  memberCharacterCount: (parent) =>
    FactionStatsService.getMemberCharacterCount(parent.id),

  sovereigntySystemCount: (parent) =>
    FactionStatsService.getSovereigntySystemCount(parent.id),
};
```

- [ ] **Adım 6: Testlerin geçtiğini gör**

Run: `yarn workspace backend test src/resolvers/faction/fields.spec.ts`
Expected: PASS.

- [ ] **Adım 7: Stats resolver'larını yaz ve bağla**

`backend/src/resolvers/faction/stats-queries.ts`:

```ts
/**
 * Faction Statistics Query Resolvers
 *
 * Independent top-level queries for the faction page's Killmails tab.
 * Orchestration only: every query delegates to the faction stats service.
 */

import { QueryResolvers } from '@generated-types';
import * as FactionStatsService from '@services/faction/faction-stats.service';

export const factionStatsQueries: QueryResolvers = {
  factionTopCharacters: async (_, { factionId, filter }) =>
    FactionStatsService.getFactionTopCharacters(factionId, filter) as any,

  factionTopCorporations: async (_, { factionId, filter }) =>
    FactionStatsService.getFactionTopCorporations(factionId, filter) as any,

  factionTopShips: async (_, { factionId, filter }) =>
    FactionStatsService.getFactionTopShips(factionId, filter) as any,

  factionTopFactionTargets: async (_, { factionId, filter }) =>
    FactionStatsService.getFactionTopFactionTargets(factionId, filter) as any,

  factionTopShipTargets: async (_, { factionId, filter }) =>
    FactionStatsService.getFactionTopShipTargets(factionId, filter) as any,
};
```

(`as any`: servis Prisma kolon adlı kısmi nesneler döner, alan resolver'ları
geri kalanını çözer; alliance stats resolver'ları da aynı gerekçeyle
`any` döndüren servisler kullanıyor.)

`backend/src/resolvers/faction/index.ts`:

```ts
export { factionFields } from './fields';
export { factionQueries } from './queries';
export { factionStatsQueries } from './stats-queries';
```

`backend/src/resolvers/index.ts`: satır 35'teki import
`import { factionFields, factionQueries, factionStatsQueries } from './faction';`
olur, `Query` içinde `...factionQueries,` satırının altına
`...factionStatsQueries,`.

- [ ] **Adım 8: Tüm backend testleri ve tipler**

Run: `yarn workspace backend test && yarn workspace backend build`
Expected: PASS, `tsc` hatasız.

- [ ] **Adım 9: Commit**

```bash
git add backend/src/schemas/Faction.graphql backend/src/schemas/FactionTopTarget.graphql \
  backend/src/schemas/FactionStats.graphql backend/src/resolvers/faction \
  backend/src/resolvers/index.ts backend/src/generated-types.ts \
  backend/src/generated-schema.graphql
git commit -m "feat(factions): expose faction relations, counters and top lists"
```

(Üretilmiş iki dosya repoda izleniyorsa commit'e girer; izlenmiyorsa `git add`
onları sessizce atlar.)

---

### Görev 6: `factionId` filtreleri — killmail'ler ve corporation'lar

**Files:**

- Modify: `backend/src/schemas/KillmailFilter.graphql`
- Modify: `backend/src/resolvers/killmail/filters-materialized.ts`
- Create: `backend/src/resolvers/killmail/filters-materialized.spec.ts`
- Modify: `backend/src/resolvers/killmail/queries.ts:85-96,443-453`
- Modify: `backend/src/schemas/Corporation.graphql:46-56`
- Modify: `backend/src/resolvers/corporation/queries.ts:65-67`
- Create: `backend/src/resolvers/corporation/queries.spec.ts`

**Interfaces:**

- Consumes: Görev 1'in kolonları.
- Produces: `KillmailFilter.factionId: Int`, `CorporationFilter.factionId: Int`.

- [ ] **Adım 1: Şemayı güncelle ve codegen**

`KillmailFilter.graphql`'da `allianceId: Int` altına `factionId: Int`.
`Corporation.graphql`'daki `CorporationFilter`'da `allianceId: Int` altına
`factionId: Int`.

Run: `yarn workspace backend codegen`

- [ ] **Adım 2: Başarısız testleri yaz**

`backend/src/resolvers/killmail/filters-materialized.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The killmail_filters WHERE builder. Only the faction branch is pinned
 * here: it is the one this file gained for the faction pages, and it must
 * match a killmail from either side, like the alliance branch.
 */

const { prisma } = vi.hoisted(() => ({
  prisma: { $queryRawUnsafe: vi.fn(), type: { findMany: vi.fn() } },
}));

vi.mock('@services/prisma', () => ({ default: prisma }));

import { filtersMaterialized } from './filters-materialized';

beforeEach(() => {
  prisma.$queryRawUnsafe.mockResolvedValue([]);
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

function call() {
  const [query, ...params] = prisma.$queryRawUnsafe.mock.calls[0] as [
    string,
    ...unknown[],
  ];
  return { query: query.replace(/\s+/g, ' '), params };
}

describe('filtersMaterialized factionId', () => {
  it('matches the faction as victim or among the attackers', async () => {
    await filtersMaterialized({ factionId: 500003 });

    expect(call().query).toContain(
      '(victim_faction_id = $1 OR $1 = ANY(attacker_faction_ids))',
    );
    expect(call().params).toEqual([500003]);
  });

  it('numbers its parameter after the ones before it', async () => {
    await filtersMaterialized({ allianceId: 99005338, factionId: 500003 });

    expect(call().query).toContain('victim_alliance_id = $1');
    expect(call().query).toContain('victim_faction_id = $2');
    expect(call().params).toEqual([99005338, 500003]);
  });

  it('adds nothing when factionId is absent', async () => {
    await filtersMaterialized({ allianceId: 99005338 });

    expect(call().query).not.toContain('faction');
  });
});
```

`backend/src/resolvers/corporation/queries.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** The corporations list, as the faction Members tab calls it. */

const { prisma } = vi.hoisted(() => ({
  prisma: { corporation: { findMany: vi.fn(), count: vi.fn() } },
}));

vi.mock('@services/prisma', () => ({ default: prisma }));
vi.mock('@services/redis', () => ({ default: {} }));

import { corporationQueries } from './queries';

beforeEach(() => {
  prisma.corporation.findMany.mockResolvedValue([]);
  prisma.corporation.count.mockResolvedValue(0);
});

const corporations = corporationQueries.corporations as (
  parent: unknown,
  args: unknown,
) => Promise<unknown>;

describe('corporations factionId filter', () => {
  it('filters on faction_id and still drops NPC corporations', async () => {
    await corporations({}, { filter: { factionId: 500003 } });

    const { where } = prisma.corporation.findMany.mock.calls[0][0];
    expect(where).toMatchObject({ faction_id: 500003, id: { gte: 2000000 } });
    expect(prisma.corporation.count).toHaveBeenCalledWith({ where });
  });

  it('leaves faction_id out when no factionId is given', async () => {
    await corporations({}, { filter: {} });

    const { where } = prisma.corporation.findMany.mock.calls[0][0];
    expect(where).not.toHaveProperty('faction_id');
  });
});
```

- [ ] **Adım 3: Başarısız olduğunu gör**

Run: `yarn workspace backend test src/resolvers/killmail/filters-materialized.spec.ts src/resolvers/corporation/queries.spec.ts`
Expected: FAIL — sorguda `victim_faction_id` yok; `where`'de `faction_id` yok.

- [ ] **Adım 4: Uygula**

`filters-materialized.ts` — destructuring'e `allianceId,` altına `factionId,`;
alliance dalının hemen altına:

```ts
// Faction filter (victim OR attacker)
if (factionId !== undefined && factionId !== null) {
  params.push(factionId);
  conditions.push(
    `(victim_faction_id = $${paramIndex} OR $${paramIndex} = ANY(attacker_faction_ids))`,
  );
  paramIndex++;
}
```

`resolvers/killmail/queries.ts` — iki `hasKillmailFiltersCompatibleFilter`
listesinde de `args.filter?.allianceId ||` satırının altına
`args.filter?.factionId ||`.

`resolvers/corporation/queries.ts` — `allianceId` bloğunun altına:

```ts
if (filter?.factionId) {
  where.faction_id = filter.factionId;
}
```

- [ ] **Adım 5: Testlerin ve tiplerin geçtiğini gör**

Run: `yarn workspace backend test && yarn workspace backend build`
Expected: PASS, `tsc` hatasız.

- [ ] **Adım 6: Commit**

```bash
git add backend/src/schemas/KillmailFilter.graphql backend/src/schemas/Corporation.graphql \
  backend/src/resolvers/killmail backend/src/resolvers/corporation \
  backend/src/generated-types.ts backend/src/generated-schema.graphql
git commit -m "feat(factions): filter killmails and corporations by faction"
```

---

### Görev 7: API doğrulaması

Kod değişikliği yok. Backend çalışıyor olmalı (`yarn dev:backend`).

- [ ] **Adım 1: Sorguları çalıştır**

```bash
cd backend
PORT=$(grep -m1 '^PORT' .env | cut -d= -f2)
gql() { curl -s "http://localhost:${PORT}/graphql" -H 'content-type: application/json' \
  --data "$(jq -n --arg q "$1" '{query:$q}')" | jq; }

gql '{ faction(id: 500003) { id name description stationCount stationSystemCount
  solarSystem { id name } corporation { id name } militiaCorporation { id name }
  memberCorporationCount memberCharacterCount sovereigntySystemCount } }'

gql '{ factionTopCharacters(factionId: 500003, filter: ALL_TIME) { killCount
  character { id name securityStatus corporation { id name } alliance { id name } } } }'
gql '{ factionTopCorporations(factionId: 500003, filter: ALL_TIME) { killCount corporation { id name } } }'
gql '{ factionTopShips(factionId: 500003, filter: ALL_TIME) { killCount shipType { id name } } }'
gql '{ factionTopFactionTargets(factionId: 500003, filter: ALL_TIME) { killCount faction { id name } } }'
gql '{ factionTopShipTargets(factionId: 500003, filter: ALL_TIME) { killCount shipType { id name } } }'

gql '{ killmails(filter: { factionId: 500003, limit: 3 }) { pageInfo { totalCount } items { id } } }'
gql '{ killmailsDateCounts(filter: { factionId: 500003 }) { date count } }'
gql '{ corporations(filter: { factionId: 500003, limit: 5 }) { pageInfo { totalCount } items { id name } } }'
```

Expected:

- `faction`: `errors` yok; `sovereigntySystemCount` 707 civarı;
  `memberCorporationCount` = `corporations` sorgusunun `totalCount`'u.
- Beş top sorgusu `errors` olmadan döner; `factionTopFactionTargets`'ta 500003
  ve 500021 yok; `securityStatus` null değil (karakterin değeri varsa).
- `killmails` `totalCount` > 0 ve şuna eşit:
  `psql "$DB" -Atc "SELECT COUNT(*) FROM killmail_filters WHERE victim_faction_id = 500003 OR 500003 = ANY(attacker_faction_ids);"`

Bir sorgu hata verirse ilgili görevin koduna dön; bu görevde yama yapma.

---

### Görev 8: `TopFactionsCard` link'leri ve footer

**Files:**

- Modify: `frontend/src/components/TopFactionsCard/TopFactionsCard.tsx:80-86`
- Create: `frontend/src/components/TopFactionsCard/TopFactionsCard.spec.tsx`
- Modify: `frontend/src/components/Footer/Footer.tsx:10-17`

**Interfaces:**

- Produces: `/factions/${id}?tab=killmails` link'leri (Görev 10'daki sayfa
  `tab` parametresini okur).

- [ ] **Adım 1: Başarısız testi yaz**

`frontend/src/components/TopFactionsCard/TopFactionsCard.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import TopFactionsCard from './TopFactionsCard';

// <Loader> pulls in lottie-web, which needs a canvas jsdom does not have.
vi.mock('lottie-react', () => ({ default: () => null }));

describe('TopFactionsCard', () => {
  it('links each faction to its killmails tab', () => {
    render(
      <TopFactionsCard
        title="Top Factions"
        factions={[
          { id: 500003, name: 'Amarr Empire', killCount: 12 },
          { id: 500001, name: 'Caldari State', killCount: 4 },
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: 'Amarr Empire' })).toHaveAttribute(
      'href',
      '/factions/500003?tab=killmails',
    );
    expect(screen.getByRole('link', { name: 'Caldari State' })).toHaveAttribute(
      'href',
      '/factions/500001?tab=killmails',
    );
  });
});
```

- [ ] **Adım 2: Başarısız olduğunu gör**

Run: `yarn workspace frontend test src/components/TopFactionsCard`
Expected: FAIL — `Unable to find an accessible element with the role "link"`.
(`toHaveAttribute` `vitest.setup.ts`'teki jest-dom'dan gelir.)

- [ ] **Adım 3: Satırı link yap**

`TopFactionsCard.tsx` importlarına:

```tsx
import Tooltip from '@/components/Tooltip/Tooltip';
import Link from 'next/link';
```

İsim `span`'ını `TopAllianceCard.tsx:78-89` ile aynı biçime çevir:

```tsx
<div className="flex items-center justify-between flex-1 min-w-0 gap-2">
  <div className="min-w-0 leading-tight">
    <Tooltip content="Show faction info" className="w-full! min-w-0">
      <Link
        href={`/factions/${faction.id}?tab=killmails`}
        className="block min-w-0 font-medium leading-tight text-ink-muted truncate hover:text-accent-link"
        prefetch={false}
      >
        {faction.name}
      </Link>
    </Tooltip>
  </div>
  <span className="text-base font-medium text-ink-muted tabular-nums whitespace-nowrap shrink-0">
    {faction.killCount}
  </span>
</div>
```

- [ ] **Adım 4: Testin geçtiğini gör**

Run: `yarn workspace frontend test src/components/TopFactionsCard`
Expected: PASS.

- [ ] **Adım 5: Footer**

`Footer.tsx` `explore` listesinde `Killmails` ile `Alliances` arasına:

```ts
    { name: 'Factions', href: '/factions' },
```

- [ ] **Adım 6: Commit**

```bash
git add frontend/src/components/TopFactionsCard frontend/src/components/Footer/Footer.tsx
git commit -m "feat(factions): link top factions rows and add factions to the footer"
```

---

### Görev 9: `/factions` liste sayfası

**Files:**

- Create: `frontend/src/graphql/Faction.graphql`
- Create: `frontend/src/components/SovSystemBadge/SovSystemBadge.tsx`
- Create: `frontend/src/components/Card/FactionCard.tsx`
- Create: `frontend/src/app/factions/page.tsx`

**Interfaces:**

- Consumes: Görev 5'in `Faction` alanları.
- Produces: `useFactionsQuery`, `FactionsQuery`; `SovSystemBadge({ count })`
  (Görev 10 başlıkta kullanır).

- [ ] **Adım 1: Belgeyi yaz ve codegen**

`frontend/src/graphql/Faction.graphql`:

```graphql
query Factions {
  factions {
    id
    name
    memberCorporationCount
    memberCharacterCount
    sovereigntySystemCount
  }
}
```

Run: `yarn workspace backend codegen && yarn workspace frontend codegen`
Expected: `frontend/src/generated/graphql.ts` `useFactionsQuery`'yi içerir.

- [ ] **Adım 2: `SovSystemBadge`**

`frontend/src/components/SovSystemBadge/SovSystemBadge.tsx`:

```tsx
import { GlobeAltIcon } from '@heroicons/react/24/outline';
import Tooltip from '../Tooltip/Tooltip';

type SovSystemBadgeProps = {
  count: number;
};

export default function SovSystemBadge({ count }: SovSystemBadgeProps) {
  return (
    <Tooltip content="Sovereignty Systems" position="top">
      <div className="flex items-center gap-2">
        <GlobeAltIcon className="w-5 h-5 text-emerald-400" />
        <span className="text-sm font-medium text-emerald-300">{count}</span>
      </div>
    </Tooltip>
  );
}
```

- [ ] **Adım 3: `FactionCard`**

`frontend/src/components/Card/FactionCard.tsx`:

```tsx
import Tooltip from '@/components/Tooltip/Tooltip';
import Card from '@/components/ui/Card';
import { FactionsQuery } from '@/generated/graphql';
import Link from 'next/link';
import SovSystemBadge from '../SovSystemBadge/SovSystemBadge';
import TotalCorporationBadge from '../TotalCorporationMember/TotalCorporationBadge';
import TotalMemberBadge from '../TotalMemberBadge/TotalMemberBadge';
import EveImage from '../ui/EveImage';

type Faction = FactionsQuery['factions'][number];

type FactionCardProps = {
  faction: Faction;
};

export default function FactionCard({ faction }: FactionCardProps) {
  return (
    <Card>
      <div className="px-4 py-5 sm:p-6">
        <div className="flex flex-col items-center gap-4">
          {/* Faction emblems are served from the corporation path; see TopFactionsCard. */}
          <EveImage
            kind="corporation"
            id={faction.id}
            name={faction.name}
            size={128}
          />
          <Tooltip content="Show Faction Info">
            <Link
              href={`/factions/${faction.id}?tab=killmails`}
              className="alliance-name"
              prefetch={false}
            >
              {faction.name}
            </Link>
          </Tooltip>

          <div className="card-metrics">
            <TotalCorporationBadge count={faction.memberCorporationCount} />
            <TotalMemberBadge count={faction.memberCharacterCount} />
            <SovSystemBadge count={faction.sovereigntySystemCount} />
          </div>
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Adım 4: Sayfa**

`frontend/src/app/factions/page.tsx`:

```tsx
'use client';

import FactionCard from '@/components/Card/FactionCard';
import Loader from '@/components/Loader';
import { useFactionsQuery } from '@/generated/graphql';

export default function FactionsPage() {
  const { data, loading, error } = useFactionsQuery();

  if (loading)
    return <Loader size="lg" text="Loading factions..." className="p-8" />;
  if (error) return <div className="p-8">Error: {error.message}</div>;

  const factions = data?.factions ?? [];

  return (
    <div>
      <h1 className="sr-only">Factions</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-5">
        {factions.map((faction) => (
          <FactionCard key={faction.id} faction={faction} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Adım 5: Tip ve lint**

Run: `yarn workspace frontend typecheck && yarn workspace frontend lint 2>&1 | tail -3`
Expected: `tsc` hatasız; lint sayısı main'deki sayıdan (141) fazla değil ve
hiçbir satır bu görevin dosyalarını adlandırmıyor.

- [ ] **Adım 6: Commit**

```bash
git add frontend/src/graphql/Faction.graphql frontend/src/components/SovSystemBadge \
  frontend/src/components/Card/FactionCard.tsx frontend/src/app/factions/page.tsx \
  frontend/src/generated/graphql.ts
git commit -m "feat(factions): add the factions list page"
```

---

### Görev 10: `/factions/[id]` detay sayfası

**Files:**

- Modify: `frontend/src/graphql/Faction.graphql`
- Create: `frontend/src/graphql/FactionStats.graphql`
- Create: `frontend/src/app/factions/[id]/page.tsx`

**Interfaces:**

- Consumes: Görev 5 ve 6'nın sorguları; `SovSystemBadge` (Görev 9);
  `CorporationTable` (`AllianceCorporationsQuery` öğe tipiyle yazılmış,
  bu yüzden `FactionCorporations` seçimi onunla birebir aynı);
  `KillmailsTable`.
- Produces: `useFactionQuery`, `useFactionKillmailsQuery`,
  `useFactionCorporationsQuery`, `useFactionTopCharactersQuery`,
  `useFactionTopCorporationsQuery`, `useFactionTopShipsQuery`,
  `useFactionTopFactionTargetsQuery`, `useFactionTopShipTargetsQuery`.

- [ ] **Adım 1: Belgeleri yaz**

`frontend/src/graphql/Faction.graphql`'a, `Factions`'ın üstüne:

```graphql
query Faction($id: Int!) {
  faction(id: $id) {
    id
    name
    description
    stationCount
    stationSystemCount
    memberCorporationCount
    memberCharacterCount
    sovereigntySystemCount
    solarSystem {
      id
      name
    }
    corporation {
      id
      name
    }
    militiaCorporation {
      id
      name
    }
  }
}
```

altına (seçimler `AllianceKillmails` ve `AllianceCorporations` ile birebir
aynı; tablolar o tiplerle yazılmış):

```graphql
query FactionKillmails($filter: KillmailFilter) {
  killmails(filter: $filter) {
    items {
      id
      killmailTime
      totalValue
      attackerCount
      solo
      npc
      isWarRelated
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
      attackers {
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
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      currentPage
      totalPages
      totalCount
    }
  }
}

query FactionCorporations($filter: CorporationFilter) {
  corporations(filter: $filter) {
    items {
      id
      name
      ticker
      member_count
      ceo {
        id
        name
      }
    }
    pageInfo {
      currentPage
      totalPages
      totalCount
      hasNextPage
      hasPreviousPage
    }
  }
}
```

`frontend/src/graphql/FactionStats.graphql`:

```graphql
# Independent faction statistics queries for the Killmails tab

query FactionTopCharacters($factionId: Int!, $filter: TopTargetFilter) {
  factionTopCharacters(factionId: $factionId, filter: $filter) {
    killCount
    character {
      id
      name
      securityStatus
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

query FactionTopCorporations($factionId: Int!, $filter: TopTargetFilter) {
  factionTopCorporations(factionId: $factionId, filter: $filter) {
    killCount
    corporation {
      id
      name
      ticker
    }
  }
}

query FactionTopShips($factionId: Int!, $filter: TopTargetFilter) {
  factionTopShips(factionId: $factionId, filter: $filter) {
    killCount
    shipType {
      id
      name
      dogmaAttributes(ids: [422, 1692]) {
        attribute_id
        value
      }
    }
  }
}

query FactionTopFactionTargets($factionId: Int!, $filter: TopTargetFilter) {
  factionTopFactionTargets(factionId: $factionId, filter: $filter) {
    killCount
    faction {
      id
      name
    }
  }
}

query FactionTopShipTargets($factionId: Int!, $filter: TopTargetFilter) {
  factionTopShipTargets(factionId: $factionId, filter: $filter) {
    killCount
    shipType {
      id
      name
      dogmaAttributes(ids: [422, 1692]) {
        attribute_id
        value
      }
    }
  }
}
```

Run: `yarn workspace frontend codegen`
Expected: hatasız; yukarıdaki sekiz hook üretilir.

- [ ] **Adım 2: Sayfayı yaz**

`frontend/src/app/factions/[id]/page.tsx`:

```tsx
'use client';

import CorporationTable from '@/components/CorporationsTable/CorporationsTable';
import KillmailsTable from '@/components/KillmailsTable';
import { Loader } from '@/components/Loader/Loader';
import Paginator from '@/components/Paginator/Paginator';
import SovSystemBadge from '@/components/SovSystemBadge/SovSystemBadge';
import TopCharacterCard from '@/components/TopCharacterCard/TopCharacterCard';
import TopShipsCard from '@/components/TopShipsCard';
import TopTargetsCard from '@/components/TopTargetsCard';
import TotalCorporationBadge from '@/components/TotalCorporationMember/TotalCorporationBadge';
import TotalMemberBadge from '@/components/TotalMemberBadge/TotalMemberBadge';
import EveImage from '@/components/ui/EveImage';
import {
  CorporationOrderBy,
  TopTargetFilter,
  useFactionCorporationsQuery,
  useFactionKillmailsQuery,
  useFactionQuery,
  useFactionTopCharactersQuery,
  useFactionTopCorporationsQuery,
  useFactionTopFactionTargetsQuery,
  useFactionTopShipsQuery,
  useFactionTopShipTargetsQuery,
  useKillmailsDateCountsQuery,
} from '@/generated/graphql';
import { useTabList } from '@/hooks/useTabList';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { use, useCallback, useEffect, useMemo, useState } from 'react';

interface FactionDetailPageProps {
  params: Promise<{ id: string }>;
}

type TabType = 'attributes' | 'killmails' | 'members';

const TAB_IDS: TabType[] = ['attributes', 'killmails', 'members'];

const TAB_LABELS: Record<TabType, string> = {
  attributes: 'Attributes',
  killmails: 'Killmails',
  members: 'Members',
};

export default function FactionDetailPage({ params }: FactionDetailPageProps) {
  const { id } = use(params);
  const factionId = parseInt(id);
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageFromUrl = Number(searchParams.get('page')) || 1;
  const pageSizeFromUrl = Number(searchParams.get('pageSize')) || 25;
  const tabFromUrl = (searchParams.get('tab') as TabType) || 'attributes';

  const [activeTab, setActiveTab] = useState<TabType>(tabFromUrl);
  const [currentPage, setCurrentPage] = useState(pageFromUrl);
  const [pageSize, setPageSize] = useState(pageSizeFromUrl);
  const { onKeyDown } = useTabList(TAB_IDS, activeTab, setActiveTab);

  const [corporationsPage, setCorporationsPage] = useState(1);
  const [corporationsPageSize, setCorporationsPageSize] = useState(100);

  const { data, loading, error } = useFactionQuery({
    variables: { id: factionId },
  });

  const statsVariables = { factionId, filter: TopTargetFilter.Last_7Days };

  const { data: topCharactersData, loading: topCharactersLoading } =
    useFactionTopCharactersQuery({ variables: statsVariables });

  const { data: topCorporationsData, loading: topCorporationsLoading } =
    useFactionTopCorporationsQuery({ variables: statsVariables });

  const { data: shipsData, loading: shipsLoading } = useFactionTopShipsQuery({
    variables: statsVariables,
  });

  const { data: factionTargetsData, loading: factionTargetsLoading } =
    useFactionTopFactionTargetsQuery({ variables: statsVariables });

  const { data: shipTargetsData, loading: shipTargetsLoading } =
    useFactionTopShipTargetsQuery({ variables: statsVariables });

  const { data: corporationsData, loading: corporationsLoading } =
    useFactionCorporationsQuery({
      variables: {
        filter: {
          factionId,
          page: corporationsPage,
          limit: corporationsPageSize,
          orderBy: CorporationOrderBy.MemberCountDesc,
        },
      },
      skip: activeTab !== 'members',
    });

  const { data: killmailsData, loading: killmailsLoading } =
    useFactionKillmailsQuery({
      variables: {
        filter: { factionId, page: currentPage, limit: pageSize },
      },
      skip: activeTab !== 'killmails',
    });

  const { data: dateCountsData } = useKillmailsDateCountsQuery({
    variables: { filter: { factionId } },
    skip: activeTab !== 'killmails',
  });

  const killmails = useMemo(
    () => killmailsData?.killmails.items || [],
    [killmailsData],
  );

  const corporations = useMemo(
    () => corporationsData?.corporations.items || [],
    [corporationsData],
  );

  const dateCountsMap = useMemo(() => {
    const map = new Map<string, number>();
    dateCountsData?.killmailsDateCounts.forEach((dc) => {
      map.set(dc.date, dc.count);
    });
    return map;
  }, [dateCountsData]);

  const pageInfo = killmailsData?.killmails.pageInfo;
  const totalPages = pageInfo?.totalPages || 0;

  const corporationsPageInfo = corporationsData?.corporations.pageInfo;
  const corporationsTotalPages = corporationsPageInfo?.totalPages || 0;

  // URL sync for pagination and tab
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('tab', activeTab);
    if (activeTab === 'killmails') {
      params.set('page', currentPage.toString());
      params.set('pageSize', pageSize.toString());
    } else if (activeTab === 'members') {
      params.set('page', corporationsPage.toString());
      params.set('pageSize', corporationsPageSize.toString());
    }
    router.push(`/factions/${id}?${params.toString()}`, { scroll: false });
  }, [
    currentPage,
    pageSize,
    corporationsPage,
    corporationsPageSize,
    activeTab,
    id,
    router,
  ]);

  const handleNext = useCallback(
    () => pageInfo?.hasNextPage && setCurrentPage((prev) => prev + 1),
    [pageInfo?.hasNextPage],
  );
  const handlePrev = useCallback(
    () => pageInfo?.hasPreviousPage && setCurrentPage((prev) => prev - 1),
    [pageInfo?.hasPreviousPage],
  );
  const handleFirst = useCallback(() => setCurrentPage(1), []);
  const handleLast = useCallback(
    () => totalPages > 0 && setCurrentPage(totalPages),
    [totalPages],
  );

  const handleCorporationsNext = useCallback(
    () =>
      corporationsPageInfo?.hasNextPage &&
      setCorporationsPage((prev) => prev + 1),
    [corporationsPageInfo?.hasNextPage],
  );
  const handleCorporationsPrev = useCallback(
    () =>
      corporationsPageInfo?.hasPreviousPage &&
      setCorporationsPage((prev) => prev - 1),
    [corporationsPageInfo?.hasPreviousPage],
  );
  const handleCorporationsFirst = useCallback(() => setCorporationsPage(1), []);
  const handleCorporationsLast = useCallback(
    () =>
      corporationsTotalPages > 0 && setCorporationsPage(corporationsTotalPages),
    [corporationsTotalPages],
  );

  if (loading) {
    return <Loader fullHeight size="lg" text="Loading faction..." />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-danger">Error: {error.message}</div>
      </div>
    );
  }

  const faction = data?.faction;

  if (!faction) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Faction not found</div>
      </div>
    );
  }

  const topCharacters =
    topCharactersData?.factionTopCharacters?.map((target) => ({
      id: target.character.id,
      name: target.character.name,
      killCount: target.killCount,
      securityStatus: target.character.securityStatus,
      corporation: target.character.corporation
        ? {
            id: target.character.corporation.id,
            name: target.character.corporation.name,
          }
        : null,
      alliance: target.character.alliance
        ? {
            id: target.character.alliance.id,
            name: target.character.alliance.name,
          }
        : null,
    })) || [];

  const topCorporations =
    topCorporationsData?.factionTopCorporations?.map((target) => ({
      id: target.corporation.id,
      name: target.corporation.name,
      count: target.killCount,
    })) || [];

  const topShips =
    shipsData?.factionTopShips?.map((ship) => ({
      id: ship.shipType.id,
      name: ship.shipType.name,
      killCount: ship.killCount,
      dogmaAttributes: ship.shipType.dogmaAttributes,
    })) || [];

  const factionTargets =
    factionTargetsData?.factionTopFactionTargets?.map((target) => ({
      id: target.faction.id,
      name: target.faction.name,
      count: target.killCount,
    })) || [];

  const topShipTargets =
    shipTargetsData?.factionTopShipTargets?.map((ship) => ({
      id: ship.shipType.id,
      name: ship.shipType.name,
      killCount: ship.killCount,
      dogmaAttributes: ship.shipType.dogmaAttributes,
    })) || [];

  return (
    <main>
      <div className="card p-6 flex flex-col">
        <div className="flex flex-row items-center justify-between">
          <div className="flex items-center justify-center gap-6">
            {/* Faction emblems are served from the corporation path; see TopFactionsCard. */}
            <EveImage
              kind="corporation"
              id={faction.id}
              name={faction.name}
              size={128}
              className="shadow-md"
            />
            <div className="flex-1">
              <h1 className="text-4xl font-bold">{faction.name}</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <TotalCorporationBadge count={faction.memberCorporationCount} />
            <TotalMemberBadge count={faction.memberCharacterCount} />
            <SovSystemBadge count={faction.sovereigntySystemCount} />
          </div>
        </div>
      </div>

      <div className="tab-shell mt-6">
        <nav
          className="flex gap-1 mb-3 overflow-x-auto"
          aria-label="Tabs"
          role="tablist"
        >
          {TAB_IDS.map((tabId) => (
            <button
              key={tabId}
              role="tab"
              id={`tab-${tabId}`}
              aria-controls={`panel-${tabId}`}
              aria-selected={activeTab === tabId}
              tabIndex={activeTab === tabId ? 0 : -1}
              onClick={() => setActiveTab(tabId)}
              onKeyDown={onKeyDown}
              className="button button-secondary button-sm"
            >
              {TAB_LABELS[tabId]}
            </button>
          ))}
        </nav>

        {activeTab === 'attributes' && (
          <div
            role="tabpanel"
            id="panel-attributes"
            aria-labelledby="tab-attributes"
            className="detail-tab-content"
          >
            <h2 className="mb-4 text-2xl font-bold">Attributes</h2>
            {faction.description && (
              <p className="mb-6 whitespace-pre-line text-ink-muted">
                {faction.description}
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-ink-muted">Home System</span>
                <span className="ml-2 font-medium">
                  {faction.solarSystem ? (
                    <Link
                      href={`/solar-systems/${faction.solarSystem.id}`}
                      prefetch={false}
                      className="text-ink-muted hover:text-accent-link"
                    >
                      {faction.solarSystem.name}
                    </Link>
                  ) : (
                    'N/A'
                  )}
                </span>
              </div>
              <div>
                <span className="text-ink-muted">Stations</span>
                <span className="ml-2 font-medium">
                  {faction.stationCount ?? 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-ink-muted">Corporation</span>
                <span className="ml-2 font-medium">
                  {faction.corporation ? (
                    <Link
                      href={`/corporations/${faction.corporation.id}`}
                      prefetch={false}
                      className="text-ink-muted hover:text-accent-link"
                    >
                      {faction.corporation.name}
                    </Link>
                  ) : (
                    'N/A'
                  )}
                </span>
              </div>
              <div>
                <span className="text-ink-muted">Systems With Stations</span>
                <span className="ml-2 font-medium">
                  {faction.stationSystemCount ?? 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-ink-muted">Militia Corporation</span>
                <span className="ml-2 font-medium">
                  {faction.militiaCorporation ? (
                    <Link
                      href={`/corporations/${faction.militiaCorporation.id}`}
                      prefetch={false}
                      className="text-ink-muted hover:text-accent-link"
                    >
                      {faction.militiaCorporation.name}
                    </Link>
                  ) : (
                    'N/A'
                  )}
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'killmails' && (
          <div
            role="tabpanel"
            id="panel-killmails"
            aria-labelledby="tab-killmails"
            className="killmails-tab"
          >
            <h2 className="sr-only">Killmails</h2>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
              <div className="lg:col-span-3">
                <KillmailsTable
                  killmails={killmails}
                  loading={killmailsLoading}
                  dateCountsMap={dateCountsMap}
                  totalCount={pageInfo?.totalCount}
                />

                {killmails.length > 0 && (
                  <div className="mt-6">
                    <Paginator
                      hasNextPage={pageInfo?.hasNextPage ?? false}
                      hasPrevPage={pageInfo?.hasPreviousPage ?? false}
                      onNext={handleNext}
                      onPrev={handlePrev}
                      onFirst={handleFirst}
                      onLast={handleLast}
                      loading={killmailsLoading}
                      currentPage={currentPage}
                      totalPages={totalPages}
                      pageSize={pageSize}
                      onPageSizeChange={(size) => {
                        setPageSize(size);
                        setCurrentPage(1);
                      }}
                    />
                  </div>
                )}
              </div>

              {/* lg:mt-10 lines the first card up with the first killmail, as on the alliance page. */}
              <div className="space-y-6 lg:col-span-1 lg:mt-10">
                <TopCharacterCard
                  title="Top Characters"
                  subtitle={<>Last 7 days</>}
                  characters={topCharacters}
                  emptyText="No pilots yet"
                  loading={topCharactersLoading}
                />

                <TopTargetsCard
                  title="Top Corporations"
                  subtitle={<>Last 7 days</>}
                  targets={topCorporations}
                  targetType="corporation"
                  linkPrefix="/corporations"
                  emptyText="No corporations yet"
                  loading={topCorporationsLoading}
                />

                <TopShipsCard
                  title="Top Ships"
                  subtitle={<>Last 7 days</>}
                  ships={topShips}
                  emptyText="No ships used yet"
                  loading={shipsLoading}
                />

                {/* targetType only picks the image path; faction emblems live under corporation. */}
                <TopTargetsCard
                  title="Top Target Factions"
                  subtitle={<>Last 7 days</>}
                  targets={factionTargets}
                  targetType="corporation"
                  linkPrefix="/factions"
                  emptyText="No faction targets yet"
                  loading={factionTargetsLoading}
                />

                <TopShipsCard
                  title="Top Target Ships"
                  subtitle={<>Last 7 days</>}
                  ships={topShipTargets}
                  emptyText="No ships killed yet"
                  loading={shipTargetsLoading}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div
            role="tabpanel"
            id="panel-members"
            aria-labelledby="tab-members"
            className="alliance-corporations-tab"
          >
            <div className="sm:flex-auto">
              <h2 className="sr-only">Member Corporations</h2>
              {corporationsPageInfo?.totalCount !== undefined && (
                <p className="text-sm text-ink-muted">
                  Total: {corporationsPageInfo.totalCount.toLocaleString()}{' '}
                  corporations
                </p>
              )}
            </div>
            <CorporationTable
              corporations={corporations}
              loading={corporationsLoading}
            />
            {corporations.length > 0 && (
              <div className="mt-6">
                <Paginator
                  hasNextPage={corporationsPageInfo?.hasNextPage ?? false}
                  hasPrevPage={corporationsPageInfo?.hasPreviousPage ?? false}
                  onNext={handleCorporationsNext}
                  onPrev={handleCorporationsPrev}
                  onFirst={handleCorporationsFirst}
                  onLast={handleCorporationsLast}
                  loading={corporationsLoading}
                  currentPage={corporationsPage}
                  totalPages={corporationsTotalPages}
                  pageSize={corporationsPageSize}
                  onPageSizeChange={(size) => {
                    setCorporationsPageSize(size);
                    setCorporationsPage(1);
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
```

`TopTargetsCard` link'i `${linkPrefix}/${target.id}?tab=killmails` olarak
kendisi kuruyor (`TopTargetsCard.tsx:93`), bu yüzden faction satırları
`/factions/<id>?tab=killmails`'e gider; bileşende değişiklik yok (spec 5.2).

- [ ] **Adım 3: Tip, lint, test**

Run: `yarn workspace frontend typecheck && yarn workspace frontend test && yarn workspace frontend lint 2>&1 | tail -3`
Expected: `tsc` hatasız, testler PASS, lint sayısı main'dekinden fazla değil
ve bu görevin dosyalarını adlandırmıyor.

- [ ] **Adım 4: Commit**

```bash
git add frontend/src/graphql/Faction.graphql frontend/src/graphql/FactionStats.graphql \
  "frontend/src/app/factions/[id]/page.tsx" frontend/src/generated/graphql.ts
git commit -m "feat(factions): add the faction detail page"
```

---

### Görev 11: PR öncesi tam doğrulama

- [ ] **Adım 1: Temiz ağaç**

Run: `git status --short`
Expected: boş. Değilse önce ne olduğunu anla; kirli ağaçta yeşil bir koşu
commit hakkında kanıt değildir.

- [ ] **Adım 2: Tam set**

```bash
yarn test
yarn workspace backend build
yarn workspace backend codegen
yarn workspace frontend codegen
git status --short          # codegen bir şey değiştirdiyse commit'lenmemiş fark var demektir
yarn workspace frontend lint 2>&1 | tail -3
yarn workspace frontend build:check
```

Her komutun çıktısını oku. Lint sayısını main'dekiyle karşılaştır
(`git stash` yok; gerekirse `git worktree add /tmp/main-lint main` ile).

- [ ] **Adım 3: Prettier**

```bash
git diff --name-only main... | xargs npx prettier --check
```

Expected: `All matched files use Prettier code style!`. Değilse
`npx prettier --write <dosya>` ve ayrı bir `style:` commit'i.

- [ ] **Adım 4: Push ve PR gövdesi**

```bash
git push
```

PR #256'nın gövdesini #195/#196 gibi düzyazı bölümlerle güncelle (İngilizce):
ne eklendi, migration'ın beş tabloya dokunmadığı ve satır sayıları, spec'ten
üç sapma, kullanıcının bakacakları. Draft'tan çıkarmayı kullanıcıya bırak.

- [ ] **Adım 5: Kullanıcıya söylenecekler**

Bakılacaklar (spec 7.5): `/factions` ızgarası; `/factions/500003`'ün üç
sekmesi; killmail sayfasındaki Top Factions kartının link'leri. Ayrıca
`yarn worker:factions`'ın bir kez çalıştırıldığını ve migration'dan önce/sonra
satır sayılarını raporla.
