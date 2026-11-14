# Ortak ESI limiter: patlamasız kova ve trafikle tırmanan hız — kısa tasarım

**Tarih:** 2026-11-15
**Durum:** onaylandı (2026-11-15)
**Değiştirdiği:** `2026-11-14-shared-esi-limiter-design.md` §4.2 (`currentRate`)
ve §4.3 (kova kapasitesi).

## Neden

2026-11-14'teki gerçek çalıştırmada (o spec'in "Sonuçlar" bölümü) 6 derin
limit freninin 3'ü çift geldi: fren bitince gelen ilk istekler yeniden 429
aldı. Ayrıca yerel Redis'te öğrenilen hız tabanı 13 req/s iken, 92 dakika
boşluktan sonra hız formülü `min(50, 13 + 5518 / 10)` ile 50'ye dönmüştü.

İki sebep:

1. **Kova patlaması.** Kapasite `max(FLOOR + 1, currentRate)`, yani bir
   saniyelik hak. Fren ya da boşluk boyunca kova doluyor; fren bitince
   bekleyen bütün toplu istekler aynı anda ~13 token alıyor. Eski yerel
   limiter istekleri `1000 / hız` ms aralıkla gönderiyordu
   (`rate-limiter.ts`, `processQueue`, `sleep(spacing)`); bu patlama ortak
   limiter'la geldi.
2. **Boşta tırmanma.** Hız, son düşüşten ya da frenden bu yana geçen her 10
   sn'de +1 artıyor, trafik olmasa bile. Öğrenilen hız boşlukta unutuluyor.

## Hedefler

1. Toplu istekler fren ya da boşluk sonrasında patlama yapmaz; dolum hızında
   tek tek alır.
2. Hız yalnızca trafik varken tırmanır. Boşluktan sonra öğrenilen hızdan
   devam edilir.
3. Canlı istekler için 5 token'lık taban ve toplam verim aynı kalır.

## Hedef olmayanlar

- Node `rate-limiter.ts` ve Rust `limiter.rs` (yerel dönüş yolları)
  değişmez.
- Route başına hız (2026-11-14 §4.2 kararı geçerli).
- Lua ARGV/dönüş sözleşmesi değişmez; Node ve Rust store'larına dokunulmaz.

## Yaklaşım

Tek mantıklı yol, ortak Lua script'lerini değiştirmek: kural orada tek yerde,
Node ve Rust ikisi de aynı dosyaları yüklüyor. Yerel limiter'lara aralık
mantığı eklemek ya da store'larda ek bekleme yapmak, kuralı iki dile
dağıtırdı.

## Tasarım

**1. Kova kapasitesi `FLOOR + 1`.** `acquire.lua`'da kapasite
`max(FLOOR + 1, currentRate)` yerine `FLOOR + 1` olur. Toplu istek
`tokens - 1 >= FLOOR` kuralıyla en fazla bir token bulur, sonra dolumu
bekler. Canlı istek `tokens >= 1` ile tabana kadar alır. Kova sürekli
`currentRate` hızında dolduğu için toplu verim `currentRate - canlı trafik`
olarak kalır.

**2. Trafikle tırmanma.** Global hash'e iki alan: `lastGrantAt` (son verilen
token) ve `climbFrom` (tırmanmanın sayıldığı başlangıç). Kural:

- `currentRate = min(maxRps, rateBase + floor((now - max(loweredAt,
pausedUntil, climbFrom)) / 10_000))`.
- `acquire`'da, hız hesaplanmadan önce: `lastGrantAt` varsa ve
  `now - lastGrantAt >= 10_000` ise (trafik kesilmiş) o ana kadar
  kazanılan hız korunur: `rateBase = currentRate(..., lastGrantAt)`,
  `climbFrom = now`. Boşluk tırmanmaya sayılmaz.
- Token verildiğinde `lastGrantAt = now`.
- `observe.lua` hız düşüşünü bugünkü gibi yapar, yalnızca `currentRate`'i
  yeni formülle hesaplar.

Fren sırasında token verilmediği için fren sonrası ilk token da "boşluk"
kuralına girer; fren sırasında düşürülen hız korunur.

## Doğrulama

Ortak `scenarios.json`'a yeni senaryolar; Node ve Rust ikisi de çalıştırır:

- Fren bitince toplu istek en fazla 1 token alır, ikincisi `rate` bekler.
- Hız 13'e düşmüşken 10 dakika boşluktan sonra ilk acquire'da hız 13 kalır.
- Trafik kesintisiz sürdükçe hız 10 sn'de bir 1 artar.
- Mevcut senaryo 6 ve 7 yeni kapasiteye göre güncellenir.

Gerçek çalıştırma tekrarlanır (2026-11-14 Sonuçlar ile aynı yöntem).
Beklenti: ilk keşifte 1-2 adet 429, çift 429 yok.

## Benim kararlarım

- Kapasite tam olarak `FLOOR + 1`, ek tampon yok.
- Boşluk eşiği tırmanma aralığıyla aynı, 10 sn.
- Aynı işe iki küçük doküman düzeltmesi eklenir: 2026-11-14 spec §4.6'daki
  "aynı anda tek bir store çağrısı" yalnızca acquire için doğru ("6-7
  izin/sn"), ve `CLAUDE.md` dosya haritasındaki ESI limiter satırı
  `backend/src/services/esi-limiter/`'ı göstermeli.

## Sonuçlar (2026-11-14 gece, yerel saat 23:35-23:40)

Gerçek iki süreçli çalıştırma, 2026-11-14 "Sonuçlar" ile aynı yöntem:
`yarn queue:character-corporation-history` (124.736 mesaj) ve
`yarn queue:corporations` (56.740 mesaj) ile kuyruklar dolduruldu; Rust
tüketici (`worker-info-corporations`, release exe) 23:35:15'te, Node tüketici
(`worker-character-corporation-history`, prefetch 25) 23:35:39'da başlatıldı,
23:40:06'ya kadar (~4 dk 50 sn) birlikte çalıştı, sonra PID ile durduruldu.
ESI'ye yalnızca bu iki worker üzerinden gidildi; kuyruklar boşaltılmadı, hiçbir
şey silinmedi. İstek hızı = log'daki başarılı mesaj satırlarının saniye başına
sayısı (pencere [başlangıç, bitiş) alınır: son saniye sayılmaz). Redis'teki `esi-limiter:global` 20 sn'de bir salt okunur `HGETALL` ile
örneklendi. Hiçbir süreç "Redis unreachable" basmadı.

**Başlangıç hızı: beklenti tutmadı.** Yerel Redis'te önceki çalıştırmadan
`rateBase = 13` kalmıştı, ama o kayıtta `lastGrantAt` ve `climbFrom` alanları
yoktu (alanlar yeni). `lastGrantAt` yokken acquire'daki "boşluk" kuralı
tetiklenmedi, hız eski formülle (`loweredAt`'tan beri geçen süre) hesaplandı ve
50'ye döndü: Rust tek başına ~51 req/s ile başladı, ilk 429 "rate 37 req/s"
(= 50'nin dörtte üçü) olarak geldi. İlk token'dan sonra alanlar yazıldı
(`lastGrantAt` 20:35:41Z), yani bu yalnızca alanların ilk kez eksik olduğu
geçişte olur; sonraki boşluklar öğrenilen hızı korumalı. Bu çalıştırma o yolu
doğrulamadı (birim senaryosu doğruluyor, canlı gözlem yok).

**Hız (başarılı mesaj / sn).**

| Pencere (yerel saat) | Node | Rust | Toplam | Not                               |
| -------------------- | ---- | ---- | ------ | --------------------------------- |
| 23:35:16-23:35:38    | -    | 50,9 | 50,9   | Rust tek başına, hız 50, 429 yok  |
| 23:35:40-23:36:25    | 16,2 | 20,0 | 36,3   | iki süreç, ilk fren öncesi        |
| 23:36:26-23:37:00    | 0,3  | 1,9  | 2,1    | üç ardışık 15 sn'lik fren         |
| 23:37:00-23:37:58    | 7,1  | 7,1  | 14,1   | hız 20 -> 18                      |
| 23:38:48-23:39:43    | 9,8  | 9,5  | 19,3   | oturmuş, frensiz kısım (55 sn)    |
| 23:38:48-23:40:00    | 7,7  | 7,6  | 15,4   | 15 sn'lik fren (23:39:44) dahil   |
| 23:35:40-23:40:00    | 7,7  | 8,6  | 16,3   | iki süreç birlikte, bütün pencere |

Toplam her pencerede iki sürecin toplamı olarak tek bir değere oturdu.
Frensiz oturmuş pencerede 19,3 req/s, 2026-11-14'ün frensiz 19,1'ine yakın (+1%);
15,4 yalnızca 23:39:44'teki freni içerdiği için düşük, karşılaştırılamaz.
**Verim, 429 sayısı ve çift 429 sayısı 2026-11-14'e göre değişmedi.** Hız `37 -> 27 -> 20 -> 18 -> 19 -> 14`
yolundan geçti.

**429.** Altı derin limit (`deep-limit`) freni, hepsini Node süreci kurdu
(23:36:26, :36:41, :36:57, :37:59, :39:44, :39:59); 2026-11-14'teki sayıyla
aynı. Rust log'unda 429 ya da fren satırı yok, 0 hata. Çift 429: üç tane. 23:36:41
ve 23:36:57 (üçlü zincirin 2. ve 3. halkası, her biri önceki frenin bitiminden
~0,5 sn sonra) ile 23:39:59 (23:39:44 frenin bitiminden sonra). Yani **çift 429
bitmedi**: 2026-11-14'te de 6 fren ve 3 çift vardı.

**Yorum.** Kova patlaması düzeltildi (kapasite 6; fren boyunca `tokens` ~5-6'da
kaldı, Redis örneklerinde görülüyor), ama fren bitiminden hemen sonra gelen 429
ortadan kalkmadı. Bu, çift 429'un asıl nedeninin kova patlaması olmadığını
düşündürür: ESI'nin derin limit penceresi 15 sn'lik frenden sonra da dolu ve
fren sonrası ilk (tek tek bile olsa) istekler yine 429 alıyor. Bu bir
çıkarım; patlama etkisini kanıtlayan ya da dışlayan ayrı bir ölçüm yapılmadı.
Beklenti ("çift 429 yok, daha az 429") tutmadı; sonraki adım olarak fren
süresini ya da fren sonrası ilk hızı (ör. yeni hızın yarısı) ayrı bir
tasarımda ele almak gerekir. Başlangıçta 50 yerine öğrenilen hızla
başlanması ise yalnızca alanlar zaten yazılıysa denenebilir; bu, bir sonraki
çalıştırmada gözlenmeli.
