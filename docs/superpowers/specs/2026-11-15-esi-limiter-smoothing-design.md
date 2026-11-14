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
