# OG paylaşım kartları — tasarım

Tarih: 2026-11-05

## Amaç ve neden

KillReport linkleri r/Eve'de ve corp Discord'larında paylaşılıyor, ama sayfalarda hiç
Open Graph etiketi yok (`openGraph`, `generateMetadata`, `opengraph-image` hiçbir yerde
kullanılmıyor). Paylaşılan bir link ya önizlemesiz ya da çıplak bir başlıkla görünüyor.

Bu iş beş sayfa türüne, linki paylaşıldığında görünen bir önizleme kartı (1200×630 PNG)
ve başlık/açıklama meta etiketleri ekler: **killmail, karakter, corporation, alliance,
güneş sistemi**. Kartlar kalabalık bir akışta bir bakışta okunmak için tasarlandı; en
kritik olanı killmail kartı (kullanıcının sözüyle: "gemi, kurban ve ISK değeri hemen
görünmeli").

Discord webhook kartları (#299) bu işten sonra aynı killmail görselini kullanacak; o
bağlantı ayrı bir PR'dır (bkz. _Sonraki iş_).

## Hedefler

- Beş route için `opengraph-image` ile üretilen, aşağıda tarif edilen kartlar.
- Beş route için `og:title`, `og:description`, `twitter:card = summary_large_image`.
- Kart başına ucuz render: bir kez üret, cache'le.
- Var olmayan bir ID için render yapmadan 404.

## Hedef dışı

- Discord webhook'unun bu görseli kullanması (ayrı PR).
- Region, constellation, faction, ana sayfa ve liste sayfaları için kart.
- Platforma göre (User-Agent ile) farklı görsel vermek. Her yerde aynı kart.
- Ayrı bir render servisi, CDN veya Nginx cache kurulumu (deploy işinde ele alınır).

## Anti-hedefler

- Görsel üzerinde karartma/scrim. Kullanıcı portre ve gemi üzerindeki karartmaları
  "koyu duruyor" diyerek kaldırttı; okunurluk metin gölgesiyle sağlanır.
- Ürün metninde em dash (`—`). Orta nokta yalnızca **sistem · region** /
  **constellation · region** arasında kullanılır (sitedeki `KillmailCard` gibi;
  kullanıcı slash yerine bunu istedi).
- Kartta para/premium çağrışımı olan herhangi bir şey (CLAUDE.md, CCP lisansı).

## Ortak çerçeve (beş kartta aynı)

Tuval 1200×630, zemin `#101010` (`--color-ground`). Yazı tipi Roboto Condensed,
400/500/700, TTF olarak (Satori woff2 okumaz).

| Parça      | Ölçü                                                                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sol şerit  | x 0, genişlik 14, tam yükseklik. Killmail `#fe3743`; diğer dört kart `#5ccbcb` (accent).                                                                          |
| Sol panel  | x 14, y 0, 560×560.                                                                                                                                               |
| Sağ panel  | x 574, y 0, 626×560.                                                                                                                                              |
| Footer     | x 14 → 1200, y 560, yükseklik 70, zemin `#2b2b2c`, iç boşluk sol 20 / sağ 32.                                                                                     |
| Footer sol | Logo (`components/ui/Logo.tsx` çizimi, 46px; dikey çizgiler `#e5e7eb`, çapraz `#5ccbcb`) + `KILLREPORT` 30px / 500 / harf aralığı 3 / `#e5e7eb`, aralarında 16px. |
| Footer sağ | Karta özgü (aşağıda).                                                                                                                                             |

Görsel üstündeki her metin: `text-shadow: 0 2px 6px rgba(0,0,0,.9)`, karartma yok.

**İsim bloğu** (killmail kurbanı, karakter, corp, alliance ve sistem sol panelinde aynı
yerleşim): panelin altına sol/sağ 22, alt 20 boşlukla yaslı. İsim 52px / 500 / satır
yüksekliği 1.1 / beyaz. Altında üyelikler 10px boşlukla, **alt alta**, aralarında 8px;
her satır 44px logo + isim, 26px, `#e5e7eb`, logo ile isim arası 10px (sitedeki
`MembershipLink`'in kart boyutu).

**İstatistik etiketi**: 24px, harf aralığı 4, `#999999`, büyük harf, sayının 6px altında.

**Kill/loss barları** (karakter, corp, alliance): iki dikey bar, 30px genişlik, 10px
aralık, alttan hizalı, sağ panelin sağ kenarından 40px içeride. Büyük olan tam boy,
diğeri ona oranlı. Yeşil `#37ba5b` kill, kırmızı `#fe3743` loss. İkisi de sıfırsa bar
çizilmez.

## Kartlar

### Killmail (`/killmails/[id]`)

Örnek: #139681321, Den'orm'un Kronos'u.

- **Sol panel — kurban**: karakter portresi (512) panele `object-fit: cover`. İsim bloğu:
  kurban adı, corp, alliance (varsa).
- **Sağ panel — gemi** (sitedeki Most Valuable `KillmailCard`'ın düzeni): gemi render'ı
  (512) paneli `cover` ile dolduruyor, karartma yok. Tier rozeti (`ShipTierBadge`
  ikonları, `getShipTier`) **sol üst köşeye boşluksuz**, 64px; T1'de rozet yok. Alt blok
  sol/sağ 26, alt 22:
  - tarih, 24px `#d1d5db`, EVE saati;
  - toplam değer, 64px / 700 / `#e7b815`, satır yüksekliği 1.05, `formatISK`;
  - destroyed ve dropped **alt alta**, 26px, satır yüksekliği 1.15, toplamın 4px altında:
    `982.44M destroyed` `#fe3743`, `115.49M dropped` `#37ba5b`;
  - gemi adı, 46px / 500 / `#fb923c`, 6px üstte;
  - yer satırı, 30px / 500, 10px üstte, öğeler arası 12px: sec (sitedeki
    `getSecurityColor` renkleri), sistem `#fb923c`, `·` `#b0b0b0` 400, region `#60a5fa`.
    **Sistem harita ikonu yok** (kullanıcı kaldırttı).
- **Footer sağ**: `AttackerBadge` mantığı, `attackerBadge()` fonksiyonuyla aynı dört hal:
  kişiler ikonu + sayı, kişi ikonu + `SOLO`, çip ikonu + `NPC`, çip ikonu + sayı.
  Görünüm `IconBadge` (tek gri): 2px `#999999` kenarlık; ikon hücresi `#999999` zemin,
  ikon `#101010` 24px, yatay iç boşluk 10; etiket `#999999`, iç boşluk 14; 28px / 500,
  satır yüksekliği 40px.

### Karakter (`/characters/[id]`)

Örnek: General XAN (365974960), 252 kill, 58 loss.

- **Sol panel**: portre (512) `cover`, isim bloğu (corp, alliance).
- **Sağ panel**: zemin portrenin bulanık ve karartılmış hali (mockup'ta `blur(28px)
brightness(.45)`). İçerik sol 60 / sağ 140, dikeyde ortalı, aralarında 44px:
  `KILLS` 128px / 700 `#37ba5b`, `LOSSES` 128px / 700 `#fe3743`. Tam boy kill/loss barları
  (üst 60, yükseklik 440).
- **Footer sağ**: `Character`, 26px `#b0b0b0`.

### Corporation (`/corporations/[id]`)

Örnek: Clown Swords. (98814817), Fraternity., 185 üye, 439 kill, 92 loss.

- **Sol panel**: corp logosu (512) `cover`, isim bloğu: corp adı, altında **yalnızca
  alliance**. **Ticker yok** (kullanıcı kaldırttı; yeşil ticker kill yeşiliyle çakışıyordu).
- **Sağ panel**: bulanık logo zemini. İçerik sol 60 / sağ 140, dikeyde ortalı, aralarında
  26px, alt alta: `MEMBERS` 84px `#93c5fd` ve solunda 64px kişiler ikonu `#60a5fa`
  (sitedeki `TotalMemberBadge` renkleri); `KILLS` 96px; `LOSSES` 96px. Tam boy barlar.
- **Footer sağ**: `Corporation`.

### Alliance (`/alliances/[id]`)

Örnek: Fraternity. (99003581), 54,429 üye, 228 corp, 329 sov, 11,861 kill, 9,593 loss.

- **Sol panel**: alliance logosu (512) `cover`, isim bloğunda yalnızca alliance adı.
- **Sağ panel**: bulanık logo zemini. İçerik sol 50 / sağ 130, dikeyde ortalı, aralarında
  40px:
  - üstte yan yana üç küçük sayı (aralarında 34px), sayı 52px, etiket 20px, ikon 40px,
    sitedeki rozetlerin ikon ve renkleriyle: `MEMBERS` kişiler `#60a5fa` / `#93c5fd`;
    `CORPS` yıldız (outline) `#eab308`; `SOV` küre (outline) `#34d399` / `#6ee7b7`.
    Etiket **`SOV`**, `SOV SYSTEMS` değil;
  - `KILLS` 104px, `LOSSES` 104px.
  - Barlar **kısa**: yalnızca kill/loss bloğunun hizasında (üst 190, yükseklik 300); üstteki
    üçlünün yanına çıkmaz.
- **Footer sağ**: `Alliance`.

### Güneş sistemi (`/solar-systems/[id]`)

Örnek: Amamake (30002537), 0.4, Hed, Heimatar; son 24 saatte 119 kill, 49 NPC kill.

- **Sol panel**: sistemin yıldızının tip render'ı
  (`images.evetech.net/types/{star.type_id}/render?size=512`) `cover`, **dikey çevrilmiş**
  (`scaleY(-1)`). Render'ların sol üstü karanlık uzay; çevirince karanlık köşe isim bloğunun
  arkasına düşer. Universe'deki 15 ana yıldız tipinin hepsinde doğrulandı. İsim bloğu:
  1. satır 52px / 500 — sec (sitedeki renk) + sistem adı beyaz;
  2. satır 30px / 500 — constellation `#e5e7eb` · region `#60a5fa`.
     Sistemin yörünge SVG'si **kullanılmıyor** (kullanıcı kaldırttı).
- **Sağ panel**: zemin `#2b2b2c`, üstünde region haritası
  (`frontend/public/images/regions/{region_id}.svg`) sol 60 / üst 20, 520×520, opaklık .45.
  İçerik dikeyde ortalı, aralarında 40px: `KILLS` 104px `#fe3743`, `NPC KILLS` 104px
  `#d1d5db`; **iki sayı eşit boyda, ikon yok**. Sağ alt köşede (sağ 32, alt 22) tek bir
  `LAST 24 HOURS`, 22px, harf aralığı 3, `#b0b0b0`.
- **Footer sağ**: `Solar System`.

## Veri

| Kart     | Değer                 | Kaynak                                                                            |
| -------- | --------------------- | --------------------------------------------------------------------------------- |
| Killmail | hepsi                 | Mevcut killmail sorgusu. Gemi tier'ı için `dogmaAttributes` (`getShipTier`).      |
| Karakter | kills                 | `character_kill_stats.kill_count` toplamı (önceden toplanmış günlük tablo).       |
| Karakter | losses                | `victims` sayımı, `character_id`. Önceden toplanmış tablo yok; bkz. _Kararlar_ 1. |
| Corp     | members               | `corporations.member_count`                                                       |
| Corp     | kills / losses        | `corporation_kill_stats` toplamı / `victims` sayımı, `corporation_id`             |
| Alliance | members, corps        | `alliances.member_count`, `alliances.corporation_count`                           |
| Alliance | sov                   | `sovereignty_map_current` satır sayısı, `alliance_id`                             |
| Alliance | kills / losses        | `alliance_kill_stats` toplamı / `victims` sayımı, `alliance_id`                   |
| Sistem   | yıldız tipi           | `stars.type_id`, `solar_system_id`                                                |
| Sistem   | constellation, region | mevcut ilişkiler                                                                  |
| Sistem   | 24 saat kill          | `killmails`, `solar_system_id` ve son 24 saat                                     |
| Sistem   | 24 saat NPC kill      | `system_activity.npc_kills` toplamı, son 24 saat (ESI saatlik, PM2 cron)          |

Okumalar CLAUDE.md'deki **yeni okuma yolu** kuralına uyar: resolver bir servisi çağırır,
servis `redis.get` → `$queryRaw` → `redis.setex` yapar, düz `async function` biçiminde,
her filtre parametresi cache key'inde. `::BIGINT` sonuçları `Number()` ile çevrilir.

`system_activity` local'de 2026-09-20'den beri güncellenmiyor (PM2 burada çalışmıyor);
production'da saatlik dolar. Local'de NPC sayısı eski veriyle görünür, bu beklenen durum.

## Render ve cache

- Next 16 `opengraph-image.tsx` dosya kuralı, her route'un `[id]` klasöründe; `ImageResponse`
  (`next/og`). Görsel, veriyi backend GraphQL'den çeker.
- Sayfa dosyaları `'use client'`; `generateMetadata` için her route'a bir server
  `layout.tsx` eklenir. `opengraph-image` dosyası `og:image`'i kendisi ekler.
- Cache: killmail değişmez, görseli süresiz cache'lenir. Karakter/corp/alliance kartı
  **3600 s**; sistem kartı ("son 24 saat") **900 s**. _(Benim kararım; değiştirilebilir.)_
- Var olmayan ID: render etmeden 404.
- Dış görseller (portre, logo, render) `images.evetech.net`'ten; ESI değil, `esiClient`
  kuralı bunlara uygulanmaz.

### Spike'tan öğrenilenler (2026-11-05, atılan script)

- Onaylanan killmail kartı `next/og` ile koddan birebir çıktı ve Discord'a webhook
  ekiyle gönderildi; kanalda kullanıcı "harika duruyor" dedi.
- Süre: soğuk süreçte, 5 dış görselin her seferinde indirildiği en kötü durumda ~4 s.
  Uygulamada sıcak süreçte yeniden ölçülecek.
- Boyut: ~960 KB PNG. OG ve Discord sınırlarının altında; küçültme gerekirse uygulamada
  bakılır.
- Satori yalnızca flexbox bilir: birden fazla çocuğu olan her `div` `display: flex` ister.

## Metin etiketleri _(benim kararım)_

| Kart     | `og:title`              | `og:description`                                     |
| -------- | ----------------------- | ---------------------------------------------------- |
| Killmail | `Den'orm lost a Kronos` | `1.10B ISK, Sibot (Domain), 5 attackers`             |
| Karakter | `General XAN`           | `Clown Swords., Fraternity. 252 kills, 58 losses`    |
| Corp     | `Clown Swords.`         | `Fraternity. 185 members, 439 kills, 92 losses`      |
| Alliance | `Fraternity.`           | `54,429 members, 228 corporations, 329 sov systems`  |
| Sistem   | `Amamake`               | `0.4, Hed, Heimatar. 119 kills in the last 24 hours` |

Em dash yok, orta nokta yok.

## Kararlar _(builder incelemesinden sonra, benim kararım)_

1. **Loss sayıları canlı `COUNT` ile.** `victims` tablosunda `character_id`,
   `corporation_id` ve `alliance_id` indeksli; tek entity için indeksli bir sayım,
   servis katmanında Redis ile cache'leniyor. CLAUDE.md'deki "ham tablodan toplama yapma"
   kuralı leaderboard'lar içindir, tek entity sayımı değil. `*_loss_stats` tabloları
   (migration, backfill, `kill-stats-realtime.ts` yazımı) bu işin parçası değil;
   gerekirse ayrı bir veritabanı PR'ı. Kartta gösterilen sayılar, veritabanındaki tüm
   killmail'ler üzerinden toplamdır. Kullanıcı onayladı (2026-11-05).

   `killmail_filters.victim_*_id` de aynı sayıyı veriyor (Fraternity: ikisi de 9,618,
   1-2 ms). `victims` seçildi çünkü Prisma'nın yönettiği bir tablo, `prisma.victim.count()`
   ile ham SQL'siz sayılabiliyor. Kill'ler için `killmail_filters.attacker_*_ids` doğru
   ama ~20 kat yavaş (GIN, ~40 ms); kill'ler `*_kill_stats`'tan okunur.

   Kayıt tarafında değişiklik yok: `killmail-writer.ts` her killmail'de `victims`,
   `*_kill_stats` (`kill-stats-realtime.ts`) ve `killmail_filters`
   (`insertKillmailFilter`) satırlarını zaten yazıyor.

2. **Render kodu frontend route'larında kalır.** Discord PR'ında worker PNG'yi frontend'in
   `opengraph-image` adresinden HTTP ile çeker (backend'in zaten bildiği
   `config.eveSso.frontendUrl` üzerinden). Böylece kart kodu tek yerde kalır ve worker,
   Next'in cache'lediği görseli alır. Kart kodunu iki workspace arasında paylaşılan bir
   modüle taşımak gerekmez.
3. **"Bir kez üret" Next'in kendi cache'i ile.** `opengraph-image` route'unda segment
   `revalidate`: killmail için süresiz, diğerleri yukarıdaki sürelerle. Redis'te PNG
   saklanmaz.
4. **Sayfa davranışı değişmez.** Yeni server `layout.tsx` yalnızca metadata üretir,
   `notFound()` çağırmaz. Var olmayan ID'de metadata genel kalır, yalnızca görsel route'u
   404 döner. Sayfaları gerçek 404'e çevirmek ayrı bir iş.
5. **Mutlak `og:image` adresi için `NEXT_PUBLIC_SITE_URL`** ve root layout'ta
   `metadataBase`. Değer kullanıcının `.env.local` / deploy ortamına ekleyeceği bir satır;
   tanımsızsa `http://localhost:3000`. Görsel route'unun veri çekmesi mevcut
   `NEXT_PUBLIC_GRAPHQL_URL`'i kullanır; production'da ayrı bir iç adres gerekirse deploy
   işinde eklenir.

## Builder'a bırakılanlar

- Bulanık zemin: Satori CSS `filter` desteklemiyorsa, düşük çözünürlüklü görseli
  büyütüp üstüne koyu yarı saydam bir katman koymak gibi bir eşdeğer.
- Karakteri olmayan kurban (yapı, NPC): sitedeki kurban kartı bu durumda gemi render'ını
  gösteriyor; OG'de sol panel için makul bir eşdeğer.
- Uzun isimler: tek satırda kalıp `…` ile kesilmesi.
- Yıldız kaydı olmayan sistem için sol panelde düz zemin.
- GraphQL sorgu şekli ve dosya düzeni; mevcut desenlere uyarak.

## Sonraki iş (ayrı PR)

Discord webhook mesajı, killmail kartını kullanır: PNG mesaja dosya olarak eklenir ve
embed'de `attachment://` ile gösterilir (public URL gerekmez, local'de de çalışır).
Spike'ta denenen biçim: başlık `Den'orm lost a Kronos` killmail'e link, renk çubuğu,
görsel kart.
