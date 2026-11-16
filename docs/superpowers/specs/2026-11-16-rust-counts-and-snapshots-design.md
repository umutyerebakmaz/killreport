# Alliance sayıları ve snapshot'lar: Rust portu ve düzeltmeler

Tarih: 2026-11-16. Takip: #315 (`update:alliance-counts`, `snapshot:alliances`,
`snapshot:corporations` satırları).

## Amaç

`backend/docs/ops/daily.md`'deki yalnızca Node olarak kalan komutların ilk
grubunu, yani sadece veritabanına yazan üç komutu Rust'a taşımak. Taşırken
bulunan sorunlar düzeltilecek ve **aynı düzeltmeler TypeScript sürümlerine de**
uygulanacak (kullanıcının kararı: "düzelterek taşıyalım, TypeScript tarafında
da"). İki sürüm aynı SQL'i çalıştırır, aynı sonucu üretir.

İkinci grup (`queue:character-corporations`, `scan:entities`) ayrı bir spec ve
PR olacak.

## Bugünkü durum ve sorunlar

`alliances.member_count` ve `corporation_count` önceden hesaplanmış
değerlerdir: liste sorgusu `member_count`'a göre sıralar
(`backend/src/resolvers/alliance/queries.ts:85-112`), alan resolver'ları hazır
değeri döndürür, büyüme alanları "bugünkü sayı eksi snapshot" hesaplar
(`backend/src/resolvers/alliance/fields.ts:94-196`). Bu kolonlar ve okuyanlar
değişmiyor; değişen onları dolduran kod.

1. **`update:alliance-counts` yavaş.** Her alliance için sırayla
   `corporation.count`, `corporation.aggregate`, `alliance.update`: ~3645 × 3 ≈
   11 bin sorgu (`backend/src/workers/update-alliance-counts.ts`).
2. **Sayıları iki komut yazıyor.** `snapshot:alliances` snapshot'ın yanında
   `alliances` sayılarını da güncelliyor, ama yalnızca o gün snapshot'ı
   olmayan alliance'lar için. Aynı gün tekrar çalışınca sayılar yenilenmiyor.
   Günde tek snapshot ise doğru ve korunuyor
   (`@@unique([alliance_id, snapshot_date])`).
3. **"Bugün" yerel saatle hesaplanıyor.** İki snapshot script'i de
   `today.setHours(0, 0, 0, 0)` kullanıyor. Kolon `@db.Date`; Europe/Istanbul'da
   yerel gece yarısı UTC'de önceki günün 21:00'i, yani snapshot bir gün geriye
   yazılıyor. UTC sunucuda sorun görünmüyor.
4. **Snapshot'lar her satırı uygulamaya çekiyor.** Bütün corp'ları ve bugünkü
   snapshot ID'lerini belleğe alıp JavaScript'te grupluyor, 500/1000'lik
   `createMany` partileriyle yazıyor.

## Yaklaşımlar

1. **Sorumlulukları ayırmak (seçilen).** `update:alliance-counts` sayıların tek
   sahibi; `snapshot:alliances` yalnızca `alliance_snapshots`'a yazar. İkisi de
   değerleri doğrudan `corporations`'tan hesaplar, birbirini beklemez. Bu
   önemli, çünkü timer'ları aynı saatte (01:00 UTC) çalışıyor. Her komut tek
   tabloya yazar (CLAUDE.md: "each worker owning a single table").
2. **Birleştirmek.** `snapshot:alliances` iki tabloya da yazar,
   `update:alliance-counts` ve timer'ı silinir. Tek komut iki tablonun sahibi
   olur ve bir timer kaldırmak gerekir. Seçilmedi.
3. **Snapshot sayıları `alliances`'tan okusun.** Önce sayımın bitmesine bağlı;
   aynı saatteki iki timer yarışır. Elendi.

Kullanıcı 1'i seçti.

## Tasarım

### SQL (iki dilde aynı)

**Sayılar**: tek ifade, bütün alliance'lar, corp'u olmayan 0 alır:

```sql
UPDATE alliances a
SET member_count = COALESCE(s.members, 0),
    corporation_count = COALESCE(s.corps, 0)
FROM alliances a2
LEFT JOIN (
  SELECT alliance_id, COUNT(*)::int AS corps, SUM(member_count)::int AS members
  FROM corporations
  WHERE alliance_id IS NOT NULL
  GROUP BY alliance_id
) s ON s.alliance_id = a2.id
WHERE a.id = a2.id
```

Etkilenen satır sayısı "total updated" olarak loglanır. `updated_at` Prisma'nın
`@updatedAt`'idir, DB varsayılanı yoktur; ham SQL ona dokunmaz. Bugünkü
`prisma.alliance.update` ise dokunuyor. **Benim kararım:** dokunmasın;
`updated_at` ESI'den gelen alliance bilgisinin tazeliğini gösterir, sayım
değil.

**Alliance snapshot'ı**: bugün snapshot'ı olmayan her alliance için bir satır:

```sql
INSERT INTO alliance_snapshots
  (alliance_id, member_count, corporation_count, snapshot_date)
SELECT a.id, COALESCE(s.members, 0), COALESCE(s.corps, 0), $1
FROM alliances a
LEFT JOIN (...aynı alt sorgu...) s ON s.alliance_id = a.id
ON CONFLICT (alliance_id, snapshot_date) DO NOTHING
```

**Corporation snapshot'ı**:

```sql
INSERT INTO corporation_snapshots (corporation_id, member_count, snapshot_date)
SELECT id, member_count, $1 FROM corporations
ON CONFLICT (corporation_id, snapshot_date) DO NOTHING
```

`created_at` DB varsayılanı `now()` ile dolar. `$1` UTC bugünüdür, uygulama
tarafından bir kez hesaplanır ve log satırındaki tarihle aynı değerdir:
Rust'ta `chrono::Utc::now().date_naive()`, TypeScript'te
`new Date().toISOString().slice(0, 10)`'dan kurulan UTC gece yarısı.

"New snapshots" etkilenen satır sayısıdır, "already existing" toplam eksi yeni.
Toplam ve ekleme tek bir ifadede, bir CTE ile birlikte hesaplanır (`WITH inserted AS (INSERT ... RETURNING 1)`); ikisi aynı veri görüntüsünü gördüğü için sayılar tutarlıdır.

### Rust

`backend-rs/workers/` altına Node dosya adlarıyla üç crate:
`update-alliance-counts`, `worker-alliance-snapshots`,
`worker-corporation-snapshots`. Her biri: `lib.rs`'te SQL'i çalıştıran
fonksiyon(lar), `main.rs`'te `runner::init()`, `.env`'den `DATABASE_URL`,
`db::worker_pool`, özet loglar, hata olursa `exit(1)`. `queue-corporations`'ın
`main.rs` iskeleti örnek alınır. RabbitMQ'ya ve ESI'ye dokunmazlar.
Sorgular `sqlx::query!` makrolarıyla yazılır, `.sqlx` offline verisi
güncellenir.

Script'ler: `update:alliance-counts:rs`, `snapshot:alliances:rs`,
`snapshot:corporations:rs` (`cargo run --release ... -p <crate>`).

### TypeScript

Üç script aynı SQL'e geçer (`prismaWorker.$executeRaw` / `$queryRaw`),
bellek içi gruplama, partiler ve döngü kalkar. Komut adları, log satırlarının
anlamı ve çıkış kodları aynı kalır. `snapshot:alliances` artık `alliances`'a
yazmaz ve "alliance records updated" satırı kalkar.

### Testler

- Rust: `#[sqlx::test(migrations = false, fixtures(...))]` ile, mevcut
  crate'lerdeki gibi tablo DDL'i fixture olarak. Kapsam:
  - Sayım: corp'lu alliance doğru toplam alır; corp'u olmayan 0 alır; başka
    alliance'a geçmiş corp eski alliance'tan düşer; `updated_at` değişmez.
  - Alliance snapshot: her alliance bir satır alır (corp'suzlar 0 ile); aynı
    gün ikinci çalıştırma yeni satır eklemez ve var olanı değiştirmez;
    `alliances` tablosu değişmez.
  - Corporation snapshot: her corp bir satır; ikinci çalıştırma eklemez.
  - Tarih: verilen gün olduğu gibi yazılır (UTC hesaplaması saf bir
    fonksiyonsa birim testiyle).
- TypeScript: bu üç script'in bugün testi yok. SQL'in davranışını Rust testleri
  sabitler. TypeScript'te UTC gün hesaplaması saf bir yardımcıya çıkarılır ve
  vitest ile test edilir. **Benim kararım:** Prisma'yı mock'layıp SQL metnini
  doğrulayan test yazılmayacak, değeri düşük.

### Dokümanlar

`backend/docs/ops/daily.md` (Rust komutları), `backend/docs/workers/alliance-snapshots.md`
(sayıları artık snapshot yazmıyor), `worker-documentation.md` Rust karşılıkları
notu, #315'te üç satır işaretlenir.

## Kapsam dışı

- systemd unit'leri ve timer'ları değişmiyor; Node komutlarını çalıştırmaya
  devam eder.
- `alliances` kolonları, okuyan resolver'lar ve dataloader'lar değişmiyor.
- Geçmişte yerel saatle bir gün geriye yazılmış snapshot satırları
  düzeltilmiyor. Okuyanlar "tarihten önceki en yakın snapshot"u aldığı için
  (`backend/src/services/dataloaders.ts:536-599`) bozulma yaratmıyorlar.
- Alliance'tan ayrılıp başka alliance'a girmeyen corp'ların eski `alliance_id`
  sorunu: haftalık `queue:corporations:rs` ile çözülüyor (#328).
- İkinci grup: `queue:character-corporations`, `scan:entities`.

## Uygulayıcıya bırakılanlar

Log satırlarının tam metni (Node'dakilere yakın kalmak şartıyla), crate içi
modül bölümü, fixture dosyalarının adları.
