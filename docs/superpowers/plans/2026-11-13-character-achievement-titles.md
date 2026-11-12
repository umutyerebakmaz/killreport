# Karakter achievement title'ı ve puanı — implementasyon planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Amaç:** Karakter detay kartında, oyundaki achievement title'ını ve
achievement puanını portrenin içinde göstermek.

**Mimari:** Karakter ESI isteği yalnızca kendisi için
`X-Compatibility-Date: 2026-06-09` gönderir. Yeni alanları iki worker ortak bir
saf yardımcıyla eşler. Title adları SDE `characterTitles.jsonl`'den
`character_titles` tablosuna import edilir. GraphQL'de bir DataLoader bu adı
çözer.

**Teknoloji:** Prisma (şema dizini + elle yazılmış SQL migration), GraphQL Yoga

- codegen, DataLoader, Vitest 5, Next.js App Router, Tailwind.

**Spec:** `docs/superpowers/specs/2026-11-13-character-achievement-titles-design.md`

## Genel kısıtlar

- Branch: `feat/character-achievement-titles`. `main`'deki commit'lenmemiş iki
  değişiklik (`worker-redisq-stream.ts`, `characters/[id]/page.tsx`) bu
  branch'e taşınır ve ilk commit olur.
- Uyumluluk tarihi yalnızca `CharacterService.getCharacterInfo`'da
  `'2026-06-09'`. `esi-client.ts:21`'deki genel `'2020-01-01'` değişmez.
- Asla `prisma migrate dev`, `migrate reset`, `db push`. Migration CLAUDE.md'deki
  diff-and-deploy prosedürüyle; beş drift tablosunun `DROP`'u silinir.
- Yarn, asla npm. Üretilmiş dosyalar elle düzenlenmez; codegen çalıştırılır
  (önce backend, sonra frontend).
- Commit mesajları İngilizce, Claude attribution satırı yok.
- `character_title_id`: FK yok. `achievement_score`: `Int?`;
  `0 ≤ değer ≤ 2_147_483_647` dışı → `null` + `logger.warn`.
- Title adlarının yalnızca `name.en`'i saklanır.
- Her düzenlenen dosyada `npx prettier --check <dosya>`.

## İnceleme odağı

1. **ESI alanı hiç göndermiyor** (title kuşanılmamış, puan yok) → kolonlar
   `null` yazılır, eski değer kalmaz; kartta öğe çizilmez. Test: Görev 3.
2. **SDE'de olmayan title UUID'si** (import'tan önce gelen yeni title) →
   karakter kaydı başarılı, `characterTitle` `null`. Test: Görev 4.
3. **Puan 0** → kartta `0` görünür; `null` görünmez. Test: Görev 3 (eşleme),
   Görev 5 kontrolü `!= null` ile.
4. **Puan int32'yi aşıyor ya da sayı değil** → `null` + uyarı, upsert patlamaz.
   Test: Görev 3.
5. **Corporation title'ı eski `title` key'inden okunmaya devam ediyor** → yeni
   tarihte o key yok, kolon sessizce boşalır. Test: Görev 3
   (`corporation_title` → `title`).

---

### Görev 1: Prisma modelleri ve migration

**Dosyalar:**

- Oluştur: `backend/prisma/schema/characterTitle.prisma`
- Değiştir: `backend/prisma/schema/character.prisma`
- Oluştur: `backend/prisma/migrations/<UTC zaman damgası>_character_achievement_titles/migration.sql`

**Arayüzler:**

- Üretir: `CharacterTitle { id String @id @db.Uuid; name String }`
  `@@map("character_titles")`; `Character.character_title_id String? @db.Uuid`,
  `Character.achievement_score Int?`. Prisma client: `prismaWorker.characterTitle`.

Bu görev `database` ajanına verilir.

- [ ] **Adım 1:** Beş drift tablosu ve `characters` için satır sayılarını kaydet
      (CLAUDE.md, "Database migrations", adım 1).
- [ ] **Adım 2:** Modeli ve iki kolonu ekle. `character_title_id` üzerinde
      relation/FK **yok**.
- [ ] **Adım 3:** `prisma migrate diff … --script` ile DDL üret, beş tablonun
      `DROP`'larını sil, migration klasörüne yaz.
      Kontrol: `grep -n "^[^-]*DROP" prisma/migrations/*_character_achievement_titles/migration.sql`
      boş çıkmalı. Beklenen içerik: bir `CREATE TABLE "character_titles"` ve
      `characters`'a iki `ADD COLUMN`; başka bir şey yok.
- [ ] **Adım 4:** `npx prisma migrate deploy && npx prisma generate`.
- [ ] **Adım 5:** Adım 1'deki sayıları tekrar al. Hiçbiri azalmamış olmalı.
- [ ] **Adım 6:** `yarn workspace backend build` → çıkış 0.
- [ ] **Adım 7:** Commit: `feat(db): add character titles table and achievement columns`.

---

### Görev 2: SDE `characterTitles` import'u

**Dosyalar:**

- Oluştur: `backend/src/helpers/sde-character-title.ts`
- Test: `backend/src/helpers/sde-character-title.spec.ts`
- Oluştur: `backend/src/scripts/import-sde-character-titles.ts`
- Değiştir: `backend/package.json` (`scripts`)

**Arayüzler:**

- Tüketir: `prismaWorker.characterTitle` (Görev 1).
- Üretir: `parseCharacterTitleLine(line: string): { id: string; name: string } | null`.

- [ ] **Adım 1: Başarısız testi yaz.** `sde-meta-group.spec.ts`'in şekliyle:

```ts
it('reads the uuid and the English name', () => {
  const line = JSON.stringify({
    _key: '00851de7-b7ca-5136-871e-d07429563c06',
    name: { de: 'Schlachtkreuzerschmied', en: 'Battlecruiser Smith' },
  });
  expect(parseCharacterTitleLine(line)).toEqual({
    id: '00851de7-b7ca-5136-871e-d07429563c06',
    name: 'Battlecruiser Smith',
  });
});
it('skips a line with no English name', () => {
  expect(
    parseCharacterTitleLine(
      '{"_key":"00851de7-b7ca-5136-871e-d07429563c06","name":{"de":"x"}}',
    ),
  ).toBeNull();
});
it('skips blank, malformed and non-uuid lines rather than throwing', () => {
  expect(parseCharacterTitleLine('')).toBeNull();
  expect(parseCharacterTitleLine('{not json')).toBeNull();
  expect(parseCharacterTitleLine('{"_key":123,"name":{"en":"x"}}')).toBeNull();
  expect(
    parseCharacterTitleLine('{"_key":"nope","name":{"en":"x"}}'),
  ).toBeNull();
});
```

- [ ] **Adım 2:** `yarn workspace backend vitest run src/helpers/sde-character-title.spec.ts`
      → FAIL (modül yok).
- [ ] **Adım 3:** `parseCharacterTitleLine`'ı yaz. UUID kontrolü
      `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`; boş
      `en` de `null`.
- [ ] **Adım 4:** Aynı komut → PASS.
- [ ] **Adım 5:** Import script'i: `import-sde-meta-groups.ts`'in iskeleti
      (stdin readline, girdi yoksa `throw`, sonda `$disconnect`). Her satır
      `prismaWorker.characterTitle.upsert` (create: id+name, update: name).
      Silme yok. Redis'e dokunmaz (title adı cache'lenmiyor; Görev 4 DataLoader
      her istekte DB'den okur). Sonunda okunan/yazılan sayısını log'la.
- [ ] **Adım 6:** `package.json`'a `sde:meta-groups` satırının aynısı:
      `"sde:character-titles": "curl -fsSL https://developers.eveonline.com/static-data/eve-online-static-data-latest-jsonl.zip -o /tmp/killreport-sde.zip && unzip -p /tmp/killreport-sde.zip characterTitles.jsonl | tsx src/scripts/import-sde-character-titles.ts"`.
- [ ] **Adım 7:** `cd backend && yarn sde:character-titles`, sonra
      `psql "$DB" -c "SELECT COUNT(*) FROM character_titles;"` → ≈119 (build
      3693310'da 119).
- [ ] **Adım 8:** Commit: `feat(sde): import character titles from the static data export`.

---

### Görev 3: ESI karakter isteği ve iki worker

**Dosyalar:**

- Değiştir: `backend/src/services/character/character.service.ts:26-29`
- Test: `backend/src/services/character/character.service.spec.ts`
- Oluştur: `backend/src/helpers/character-achievement.ts`
- Test: `backend/src/helpers/character-achievement.spec.ts`
- Değiştir: `backend/src/workers/worker-info-characters.ts:103-131`
- Değiştir: `backend/src/workers/worker-redisq-stream.ts:598-618`

**Arayüzler:**

- Tüketir: Görev 1'in kolonları.
- Üretir:
  - `export const CHARACTER_COMPATIBILITY_DATE = '2026-06-09'` (`character.service.ts`)
  - `export interface EsiCharacterInfo { name: string; corporation_id: number; alliance_id?: number; birthday: string; bloodline_id: number; race_id: number; gender: string; security_status?: number; description?: string; faction_id?: number; corporation_title?: string; character_title_id?: string; achievement_score?: number }`
  - `getCharacterInfo(characterId: number): Promise<EsiCharacterInfo>`
  - `characterTitleFields(info: EsiCharacterInfo): { title: string | null; character_title_id: string | null; achievement_score: number | null }`
    (`helpers/character-achievement.ts`)

- [ ] **Adım 1: Başarısız testleri yaz.**
      `character.service.spec.ts`'e yeni `describe('CharacterService.getCharacterInfo')`:

```ts
it('asks ESI for the 2026-06-09 shape', async () => {
  get.mockResolvedValueOnce({ data: { name: 'x' } } as never);
  await CharacterService.getCharacterInfo(777);
  expect(get).toHaveBeenCalledWith('/characters/777/', {
    headers: { 'X-Compatibility-Date': '2026-06-09' },
  });
});
```

`character-achievement.spec.ts`:

```ts
const base = {
  name: 'x',
  corporation_id: 1,
  birthday: '2010-01-01T00:00:00Z',
  bloodline_id: 1,
  race_id: 1,
  gender: 'male',
};
it('maps the new fields, corporation_title into title', () => {
  expect(
    characterTitleFields({
      ...base,
      corporation_title: 'CEO',
      character_title_id: '00851de7-b7ca-5136-871e-d07429563c06',
      achievement_score: 1234,
    }),
  ).toEqual({
    title: 'CEO',
    character_title_id: '00851de7-b7ca-5136-871e-d07429563c06',
    achievement_score: 1234,
  });
});
it('writes null for every key ESI left out', () => {
  expect(characterTitleFields(base)).toEqual({
    title: null,
    character_title_id: null,
    achievement_score: null,
  });
});
it('keeps a score of 0', () => {
  expect(
    characterTitleFields({ ...base, achievement_score: 0 }).achievement_score,
  ).toBe(0);
});
it('drops a score that does not fit an int column', () => {
  expect(
    characterTitleFields({ ...base, achievement_score: 2_147_483_648 })
      .achievement_score,
  ).toBeNull();
  expect(
    characterTitleFields({ ...base, achievement_score: -1 }).achievement_score,
  ).toBeNull();
  expect(
    characterTitleFields({ ...base, achievement_score: 1.5 }).achievement_score,
  ).toBeNull();
});
```

Ayrıca son testte `logger.warn`'ın bir kez çağrıldığı doğrulanır
(`vi.mock('@services/logger', …)` ile, `character.service.spec.ts`'teki gibi).

- [ ] **Adım 2:** `yarn workspace backend vitest run src/services/character/character.service.spec.ts src/helpers/character-achievement.spec.ts`
      → FAIL.
- [ ] **Adım 3:** `getCharacterInfo`'yu `esiClient.get<EsiCharacterInfo>` ve
      `headers` ile yaz; sabitin üstüne neden genel tarihin değil yalnızca
      bunun yükseltildiğini anlatan yorum. `characterTitleFields`'ı yaz.
- [ ] **Adım 4:** Aynı komut → PASS. Ardından
      `esi-client.ts`'in istek başına `headers`'ı instance varsayılanının
      üzerine yazdığını doğrula: `esi-client.spec.ts` (varsa) ya da
      `esi-client.ts:70-92`'yi okuyarak; axios istek header'larını
      `defaults.headers` ile birleştirir ve istek değeri kazanır. Ayrı bir
      test gerekiyorsa `esi-client` spec'ine eklenir.
- [ ] **Adım 5:** İki worker'da `charInfo.title` okumasını kaldır;
      create (ikisi) ve update (`worker-info-characters`) bloklarına
      `...characterTitleFields(charInfo)` yay. `worker-redisq-stream`'in
      `update: {}`'u değişmez. `yarn workspace backend build` → çıkış 0 (eski
      `title` okuması kalırsa tip hatası verir).
- [ ] **Adım 6:** `yarn workspace backend test` → hepsi PASS.
- [ ] **Adım 7:** Commit: `feat(esi): read achievement title and score from character info`.

---

### Görev 4: GraphQL alanları

**Dosyalar:**

- Değiştir: `backend/src/schemas/Character.graphql`
- Değiştir: `backend/src/services/dataloaders.ts` (yeni loader, `DataLoaderContext`, `createDataLoaders`)
- Değiştir: `backend/src/resolvers/character/fields.ts`
- Test: `backend/src/resolvers/character/fields.spec.ts` (yeni)

**Arayüzler:**

- Tüketir: Görev 1 modeli, Görev 3'ün yazdığı kolonlar.
- Üretir: GraphQL `Character.characterTitle: String`,
  `Character.achievementScore: Int`; `loaders.characterTitle: DataLoader<string, string | null>`
  (UUID → `name`).

- [ ] **Adım 1:** Şemaya iki alanı ekle (her birine bir satır açıklama
      yorumu), `yarn workspace backend codegen`.
- [ ] **Adım 2: Başarısız testi yaz** (`fields.spec.ts`), context'i elle
      kurarak:

```ts
const ctx = {
  loaders: {
    characterTitle: {
      load: vi.fn(async (id: string) =>
        id === '00851de7-b7ca-5136-871e-d07429563c06'
          ? 'Battlecruiser Smith'
          : null,
      ),
    },
  },
};
it('resolves the equipped title to its name', async () => {
  expect(
    await characterFields.characterTitle!(
      { character_title_id: '00851de7-b7ca-5136-871e-d07429563c06' } as any,
      {},
      ctx as any,
      {} as any,
    ),
  ).toBe('Battlecruiser Smith');
});
it('returns null for a title the SDE import has not seen', async () => {
  expect(
    await characterFields.characterTitle!(
      { character_title_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff' } as any,
      {},
      ctx as any,
      {} as any,
    ),
  ).toBeNull();
});
it('returns null without asking the loader when no title is equipped', async () => {
  ctx.loaders.characterTitle.load.mockClear();
  expect(
    await characterFields.characterTitle!(
      { character_title_id: null } as any,
      {},
      ctx as any,
      {} as any,
    ),
  ).toBeNull();
  expect(ctx.loaders.characterTitle.load).not.toHaveBeenCalled();
});
it('maps achievement_score, keeping 0', () => {
  expect(
    characterFields.achievementScore!(
      { achievement_score: 0 } as any,
      {},
      ctx as any,
      {} as any,
    ),
  ).toBe(0);
});
```

- [ ] **Adım 3:** `yarn workspace backend vitest run src/resolvers/character/fields.spec.ts` → FAIL.
- [ ] **Adım 4:** `createCharacterTitleLoader` (`prisma.characterTitle.findMany({ where: { id: { in } } })`
      → Map → sırayla `name ?? null`), context'e ekle; iki field resolver'ı
      `securityStatus`'un kalıbıyla yaz.
- [ ] **Adım 5:** Aynı test → PASS; `yarn workspace backend test` ve
      `yarn workspace backend build` → çıkış 0.
- [ ] **Adım 6:** Commit: `feat(graphql): expose character achievement title and score`.

---

### Görev 5: Karakter detay kartı

**Dosyalar:**

- Değiştir: `frontend/src/graphql/Character.graphql`
- Değiştir: `frontend/src/app/characters/[id]/page.tsx`

**Arayüzler:**

- Tüketir: Görev 4'ün GraphQL alanları.

- [ ] **Adım 1:** Sorguya `characterTitle` ve `achievementScore` ekle;
      `yarn workspace frontend codegen`.
- [ ] **Adım 2:** Kart:
  - Portredeki `EveHtmlRenderer html={character.title}` bloğunu sağ sütuna,
    Track/Discord satırının üstüne taşı (eski `text-sm font-medium` ile).
  - Portrede ismin üstüne `character.characterTitle` düz metin
    (`text-sm font-medium text-white truncate`), yalnızca doluysa.
  - Security status'un yanına `achievementScore != null` iken puan,
    `toLocaleString()` ile. Etiket/ikon ve renk builder'ın kararı.
  - Scrim `h-32` kalır (portrede yine tek title satırı).
- [ ] **Adım 3:** `yarn workspace frontend lint` → sayı `main` ile aynı,
      `characters/[id]/page.tsx` için yalnızca önceden var olan 4
      `no-explicit-any` hatası; `yarn workspace frontend build` → çıkış 0.
- [ ] **Adım 4:** Commit: `feat(characters): show achievement title and score on the character card`.

---

### Görev 6: Uçtan uca kontrol ve PR

- [ ] **Adım 1:** Backend'i başlat (`yarn dev:backend`), title'ı ve puanı olan
      bir karakteri `worker:info:characters` ile yeniden çek (kuyruğa tek ID;
      `queue-own-character.ts` ya da kuyruğa elle mesaj).
- [ ] **Adım 2:** `curl localhost:$PORT/graphql` ile
      `{ character(id: …) { title characterTitle achievementScore } }` →
      üçü de dolu. `character:detail:{id}` cache'i 1800 sn; gerekirse o key'i
      `redis-cli DEL` ile sil.
- [ ] **Adım 3:** Tam doğrulama setini `qa` ajanına arka planda ver
      (test, backend build, iki codegen, lint sayısı, frontend build,
      prettier).
- [ ] **Adım 4:** PR (İngilizce). Gövdede: deploy sonrası
      `yarn sde:character-titles` bir kez çalıştırılmalı; mevcut karakterler
      planlı `queue:characters` taramasıyla dolacak, elle tetiklemek
      kullanıcının kararı.
- [ ] **Adım 5:** Kullanıcıya bakacağı sayfayı söyle; görsel doğrulama onun.
