# Karakter achievement title'ı ve achievement puanı — tasarım

Tarih: 2026-11-13

## Amaç ve neden

Oyunda bir karakterin bilgi penceresinde, Cradle of War ile gelen achievement
sisteminden kazanılıp kuşanılan bir **title** ve karakterin toplam
**achievement puanı** görünüyor. KillReport'un karakter detay kartında şu an
görünen title bu değil: o, ESI'nin eski `title` alanından gelen **corporation
title**'ı.

Hedef: karakter detay sayfasındaki kartta (portrenin içinde, isim/corp/alliance
ile birlikte) oyundaki achievement title'ını ve achievement puanını göstermek.

## Kapsam

**Hedefler**

- `characters` tablosunda karakterin kuşandığı achievement title'ının kimliği
  ve achievement puanı saklanır.
- Title kimliklerini isme çeviren bir `character_titles` tablosu SDE'den
  doldurulur.
- Karakter bilgisini ESI'den çeken iki worker yeni alanları yazar.
- GraphQL `Character` tipi `characterTitle` ve `achievementScore` alanlarını
  sunar.
- Karakter detay kartı ikisini gösterir.

**Hedef olmayanlar**

- Killmail sayfasındaki victim kartı, karakter listeleri, tooltip'ler, OG
  paylaşım kartları. Kullanıcı yalnızca karakter detay kartını istedi.
- Karakterin tüm achievement'larının listesi (ESI'de böyle bir public endpoint
  yok).
- Title adlarının çevirileri. Arayüz İngilizce; yalnızca `en` saklanır.
- ESI uyumluluk tarihinin **genel** olarak yükseltilmesi.

**Anti-hedefler** (çalışsa bile başarısızlık sayılır)

- Diğer ESI endpoint'lerinin yanıt şeklinin değişmesi.
- Mevcut corporation title'ının (`characters.title`) kaybolması ya da boşa
  yazılması.
- Herhangi bir satırın silinmesi; Prisma'nın drift olarak gördüğü beş tablonun
  migration'da `DROP` edilmesi.

## Kaynak bilgiler (2026-11-12'de doğrulandı)

**ESI — `GET /characters/{character_id}`.** Uyumluluk tarihi `2026-06-09` ve
sonrasında yanıt şeması değişiyor (OpenAPI şemaları `2026-05-19` ile
`2026-06-09` karşılaştırıldı):

| Alan                 | Tür             | Not                                           |
| -------------------- | --------------- | --------------------------------------------- |
| `title`              | string          | `2026-06-09` itibarıyla **kaldırıldı**        |
| `corporation_title`  | string          | `title`'ın yeni adı; corporation title'ı      |
| `character_title_id` | UUID (string)   | Kuşanılan achievement title'ı; yoksa alan yok |
| `achievement_score`  | integer (int64) | Toplam achievement puanı                      |

ESI bu alanları yanıta yalnızca değer varsa koyuyor; yoksa key hiç gelmiyor
(`?? null` ile okunmalı).

**ESI'de title kimliğini isme çeviren endpoint yok.** `/characters/{id}/titles`
corporation title'larını döndürür ve OAuth ister; bu işle ilgisi yok.

**SDE — `characterTitles.jsonl`.** Schema changelog'una göre SDE'ye eklenmiş.
Build 3693310'da 119 satır. Her satır:

```json
{
  "_key": "00851de7-b7ca-5136-871e-d07429563c06",
  "name": { "en": "Battlecruiser Smith", "de": "...", "...": "..." }
}
```

Renk, ikon ya da nadirlik bilgisi yok.

Kaynak: [Cradle of War on ESI: character titles and achievements](https://developers.eveonline.com/blog/cradle-of-war-on-esi-character-titles-and-achievements).

## Kısıtlar

- **Uyumluluk tarihi genel.** `backend/src/services/esi-client.ts:21`
  `COMPATIBILITY_DATE = '2020-01-01'` sabitini her isteğe koyuyor. Genel olarak
  yükseltmek başka endpoint'lerin şeklini değiştirir (anti-hedef). Ama
  `EsiRequestOptions.headers` (`esi-client.ts:25`) istek başına header kabul
  ediyor; tarih yalnızca karakter isteğinde geçersiz kılınabilir. Bunun
  `esi-client.ts`'teki varsayılan header'ın üzerine yazdığı uygulamada
  doğrulanmalı.
- **Karakteri ESI'den kaydeden iki yer var**, ikisi de
  `CharacterService.getCharacterInfo` çağırıyor:
  `backend/src/workers/worker-info-characters.ts:99` ve
  `backend/src/workers/worker-redisq-stream.ts:597`.
- **Migration** CLAUDE.md'deki diff-and-deploy prosedürüyle yazılır;
  `prisma migrate dev` kullanılmaz. Diff çıktısındaki beş drift tablosunun
  `DROP`'ları silinir, satır sayıları önce ve sonra kontrol edilir.
- **SDE import kalıbı mevcut:** `src/scripts/import-sde-meta-groups.ts` ve
  `src/helpers/sde-meta-group.ts` (+ spec), `package.json`'da tek satırlık
  `sde:meta-groups` script'i (`curl … | unzip -p … | tsx …`). Yeni import aynı
  şekli izler.
- **Relation izleyen field resolver DataLoader kullanır** (CLAUDE.md).
- `character:detail:{id}` cache'i 1800 sn tutuluyor
  (`resolvers/character/queries.ts:11`).

## Başlangıç noktası

_Benim kararım:_ Plan, `main` üzerindeki commit'lenmemiş iki değişiklikten
başlar ve onlarla aynı branch'te gider:

- `frontend/src/app/characters/[id]/page.tsx` — isim, corp ve alliance'ı
  portrenin içindeki alt şeride taşıyan, security status'u ismin yanına alan
  kart düzeni (bu oturumda kullanıcının isteğiyle yapıldı).
- `backend/src/workers/worker-redisq-stream.ts` — karakter `create` bloğuna
  `description`, `title`, `faction_id` eklenmesi. Bölüm 3 bu `title` satırını
  `corporation_title` okuyacak şekilde değiştirir.

## Kararlaştırılanlar

- Yalnızca karakter detay kartı (kullanıcı).
- Corporation title'ı portreden sağ sütuna döner; portrede yalnızca
  achievement title'ı kalır (kullanıcı).
- Spec, plana geçmeden önce kullanıcı onayına sunulur (CLAUDE.md).

## Tasarım

### 1. Veritabanı

Yeni model `CharacterTitle` → tablo `character_titles`:

| Kolon  | Tür               | Not                  |
| ------ | ----------------- | -------------------- |
| `id`   | `String @db.Uuid` | SDE `_key`, birincil |
| `name` | `String`          | SDE `name.en`        |

`Character` modeline iki kolon:

| Kolon                | Tür                |
| -------------------- | ------------------ |
| `character_title_id` | `String? @db.Uuid` |
| `achievement_score`  | `Int?`             |

_Benim kararım:_ `character_title_id` için foreign key **yok**. ESI, SDE
import'u yapılmadan önce yeni bir title kimliği döndürebilir; FK olsaydı
karakter upsert'i patlardı. İsim bulunamazsa field resolver `null` döner.

_Benim kararım:_ `achievement_score` için `Int` (32 bit). ESI int64 diyor ama
puanlar binler mertebesinde; `BigInt`, `JSON.stringify`'da patlayıp her
cache noktasında `Number()` dönüşümü gerektirirdi. Plan, ESI'den 2³¹'i aşan
bir değer gelirse ne olacağını (kırpma değil, `null` + uyarı log'u) belirler.

Mevcut `title` kolonu adını korur; içeriği zaten corporation title'ı. Yeniden
adlandırmak bu işin kapsamı dışında.

### 2. SDE import

- `src/helpers/sde-character-title.ts`: bir JSONL satırını
  `{ id, name } | null` olarak ayrıştıran saf fonksiyon (`name.en` yoksa
  `null`). Vitest spec'i yanında.
- `src/scripts/import-sde-character-titles.ts`: stdin'den okur, `prismaWorker`
  ile `character_titles`'a upsert eder. Hiç girdi yoksa hata verir. SDE'den
  kalkmış title'ları silmez (karakterler hâlâ onları gösteriyor olabilir).
- `package.json`: `sde:character-titles` — `sde:meta-groups` satırının aynısı,
  `unzip -p … characterTitles.jsonl` ile.
- Statik veri: elle çalıştırılır, yeni SDE build'i title eklediğinde tekrar.
  Zamanlanmaz.

### 3. ESI ve worker'lar

- `CharacterService.getCharacterInfo`, isteği
  `headers: { 'X-Compatibility-Date': '2026-06-09' }` ile yapar. Tarih bu
  servis dosyasında adlandırılmış bir sabit olur, nedenini anlatan yorumla.
- İki worker da aynı alanları yazar (create ve update):
  - `title` ← `charInfo.corporation_title ?? null`
  - `character_title_id` ← `charInfo.character_title_id ?? null`
  - `achievement_score` ← `charInfo.achievement_score ?? null`
- `worker-redisq-stream.ts` mevcut davranışını korur: `update: {}` — kayıtlı
  karakteri güncellemez, yalnızca yeni karakteri oluşturur.

_Benim kararım:_ `getCharacterInfo`'nun dönüş tipi `any` yerine bu alanları
içeren bir arayüz olur; böylece eski `title` okuması derleme hatası verir ve
gözden kaçmaz.

### 4. GraphQL

`backend/src/schemas/Character.graphql`'a:

```graphql
characterTitle: String   # achievement title'ının İngilizce adı
achievementScore: Int
```

- `achievementScore`: `parent.achievement_score` eşlemesi.
- `characterTitle`: `parent.character_title_id` varsa yeni bir
  `characterTitle` DataLoader'ı (`services/dataloaders.ts`) ile `name`'i
  getirir; yoksa ya da bulunamazsa `null`.

Mevcut `title` alanı adını ve anlamını (corporation title'ı) korur.

### 5. Frontend

- `frontend/src/graphql/Character.graphql` sorgusuna `characterTitle` ve
  `achievementScore` eklenir; codegen.
- Karakter detay kartında, portrenin içindeki alt şeritte:
  - achievement title'ı isim satırının hemen üstünde (portredeki tek title
    satırı),
  - achievement puanı security status'un yanında.
- **Corporation title'ı (`title`) portreden çıkar**, sağ sütuna, Track/Discord
  butonlarının üstüne döner (kullanıcının kararı). Portrede iki title satırı
  256px'e sığmıyor.
- Değer yoksa ilgili öğe hiç çizilmez.
- _Benim kararım:_ `achievementScore` 0 ise gösterilir (0 geçerli bir puan;
  `null` gösterilmez). Achievement title'ı düz metindir, `EveHtmlRenderer`'dan
  geçmez — SDE adlarında markup yok.

_Builder'a bırakılan:_ yazı boyutu, renk, puanın biçimi (ör. `1,234` ve bir
etiket/ikon). Görsel doğrulama kullanıcının.

### 6. Mevcut karakterlerin doldurulması

Kod deploy edildikten ve SDE import'u yapıldıktan sonra, mevcut ~124 bin
karakterin yeni alanları `queue:characters` + `worker:info:characters` ile
doldurulur. Bu tarama zaten planlı çalışıyor (PM2 aylık, crontab haftalık);
beklemeden elle tetiklemek ESI'ye yük bindirdiği için kullanıcının kararıdır.

## Doğrulama

- Ciddi değişiklik (worker, servis, şema, migration): tam set `qa` ajanına.
- Migration öncesi ve sonrası beş drift tablosu ile `characters` satır
  sayıları.
- SDE import sonrası `SELECT COUNT(*) FROM character_titles` (≈119).
- Bir karakter elle kuyruğa atılıp işlendikten sonra GraphQL sorgusu:
  `{ character(id: …) { title characterTitle achievementScore } }`.
- Görünüm: kullanıcı.

## Açık konular

Yok.
