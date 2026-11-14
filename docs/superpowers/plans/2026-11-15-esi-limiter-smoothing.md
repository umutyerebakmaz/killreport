# Ortak ESI limiter düzgünleştirme — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ortak limiter'da fren ve boşluk sonrası patlamayı kaldırmak ve hızın
yalnızca trafik varken tırmanmasını sağlamak.

**Architecture:** Değişiklik yalnızca `lib.lua`, `acquire.lua` ve
`observe.lua`'da. Node ve Rust store'ları aynı dosyaları yüklediği için ikisi
de değişmeden yeni davranışı alır; ortak `scenarios.json` ikisinde de koşar.

**Tech Stack:** Redis Lua, vitest, `cargo test`.

**Spec:** `docs/superpowers/specs/2026-11-15-esi-limiter-smoothing-design.md`

## Global Constraints

- Kova kapasitesi `FLOOR + 1` (= 6). `FLOOR = 5` değişmez.
- `currentRate = min(maxRps, rateBase + floor((now - max(loweredAt, pausedUntil, climbFrom)) / 10_000))`.
- Global hash'e yeni alanlar: `lastGrantAt` (varsayılan yok), `climbFrom`
  (varsayılan `-1e15`).
- Boşluk eşiği 10_000 ms.
- Lua ARGV ve dönüş sözleşmesi değişmez. `shared-store.ts`, `shared.rs`,
  `shared-rate-limiter.ts`, `shared_limiter.rs`, `rate-limiter.ts`,
  `limiter.rs` kodu değişmez.
- Testler kendi rastgele önekini kullanır, yalnızca kendi anahtarlarını
  siler; `FLUSHDB`, `FLUSHALL`, `SCRIPT FLUSH`, `KEYS *` ile silme yasak.
- Kod, yorum ve commit mesajları İngilizce, Claude imzası yok. `.env`
  yalnızca okunur.

## Review Focus

1. **Fren sırasında düşürülen hız, fren sonrası ilk token'da korunmalı:**
   boşluk kuralı `rateBase`'i `lastGrantAt` anındaki hıza çekerken, o andan
   sonra yapılan düşüşü geri almamalı. Test: Task 1 senaryo "fren sonrası
   düşük hız korunur".
2. **Canlı trafik tek başına da tırmanmayı sürdürmeli** (sadece canlı istek
   varken hız yine artmalı). Test: Task 1 senaryo "canlı trafikle tırmanma".
3. **İlk kullanım** (`lastGrantAt` hiç yazılmamış) boşluk sayılmamalı ve
   hız `maxRps`'ten başlamalı. Test: Task 1 senaryo "ilk acquire".
4. **İki istemci arasında trafik:** `a` boşluktan sonra token alırken `b`
   aynı anda alıyorsa boşluk kuralı bir kez uygulanmalı. Test: Task 1.
5. **Kovanın dolum hızı düşük hızda da toplu verimi korumalı:** `maxRps 10`,
   1 sn boyunca toplu istekler toplam ~10 token almalı. Test: Task 1.

---

### Task 1: Lua değişikliği ve senaryolar

**Files:**

- Modify: `backend/src/services/esi-limiter/lib.lua` (`currentRate`'e
  `climbFrom` parametresi), `acquire.lua` (kapasite, boşluk kuralı,
  `lastGrantAt`), `observe.lua` (`climbFrom`'u okuyup `currentRate`'e
  geçirmek), `scenarios.json`
- Test: mevcut `backend/src/services/esi-limiter/shared-store.spec.ts` ve
  `backend-rs/crates/esi/tests/shared.rs` (tabloyu okuyorlar; kod değişikliği
  gerekmemeli)

**Interfaces:**

- Produces: `currentRate(maxRps, rateBase, loweredAt, pausedUntil, climbFrom, now)` in `lib.lua`.
- Global hash alanları: mevcutlara ek `lastGrantAt`, `climbFrom`.

- [ ] **Step 1: Senaryoları yaz/güncelle** (`scenarios.json`, kesin değerler)

  1. Mevcut senaryo 6 (`maxRps 10`, aynı `now`): `bulk` 1 kez alır, 2.'de
     `reason: rate`; ardından `live` 5 kez alır, 6.'da `reason: rate`.
  2. Mevcut senaryo 7: iki istemci aynı `now`'da toplam 20 `bulk`: toplam
     verilen 1.
  3. **Fren sonrası patlama yok:** 420 freni (`errorResetMs: 30000`), fren
     bitiminde (`now = t0 + 30000`) `bulk` 1 alır, 2.'si `rate`.
  4. **Boşlukta tırmanma yok:** header'sız 429 ile hız 37'ye düşer, fren biter,
     trafikle bir token alınır; 10 dakika sonra ilk `observe` ya da
     `acquire` sonrası dönen/verilen hız 37 (değil 50).
  5. **Trafikle tırmanma:** 37'den, fren sonrası her 1 sn'de bir `bulk`
     acquire ile 10 sn sonra hız 38, 20 sn sonra 39.
  6. **Fren sonrası düşük hız korunur** (Review Focus 1): trafik sürerken
     header'sız 429 hızı düşürür; fren sonrası ilk token'dan sonraki hız
     düşmüş değerdir.
  7. **Canlı trafikle tırmanma** (Review Focus 2): yalnızca `live` istekleriyle
     senaryo 5'in aynısı.
  8. **İlk acquire** (Review Focus 3): boş önekte ilk `acquire` `granted`,
     ardından `observe`'un döndürdüğü `rate` = `maxRps`.
  9. **İki istemci** (Review Focus 4): boşluktan sonra `a` ve `b` aynı `now`'da
     acquire; hız iki kez değil bir kez işlenir (dönen hız iki istemcide aynı).
  10. **Dolum hızında verim** (Review Focus 5): `maxRps 10`, 1 sn boyunca her
      100 ms'de bir `bulk` acquire; toplam verilen 10 (±1 değil, kesin değeri
      hesapla ve yaz).

  Hızın gözlenebilmesi için `observe`'un dönen `rate` alanını kullan
  (status 200, header'sız bir observe hızı değiştirmez).

- [ ] **Step 2: Node ve Rust testlerinin başarısız olduğunu gör**

  Run: `cd backend && yarn vitest run src/services/esi-limiter/shared-store.spec.ts`
  ve `cd backend-rs && cargo test -p esi --test shared`
  (`REDIS_URL` `backend/.env`'den export edilir, yalnızca okunur).
  Expected: yeni ve güncellenen senaryolar FAIL.

- [ ] **Step 3: Lua'yı değiştir**

  Spec §Tasarım 1 ve 2. `acquire.lua` sırası: global alanları oku → boşluk
  kuralı (`lastGrantAt` varsa ve `now - lastGrantAt >= 10_000`:
  `rateBase = currentRate(..., lastGrantAt)`, `climbFrom = now`, yaz) →
  fren → grup → kova (kapasite `floor + 1`) → sınıf → token verilirse
  `lastGrantAt = now`.

- [ ] **Step 4: İki dilde de geçtiğini gör**

  Run: Step 2'deki iki komut, sonra `cd backend && yarn test` ve
  `cd backend-rs && cargo test --workspace` (sqlx için `DATABASE_URL`
  export). Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git commit -m "feat(esi): pace the shared bucket and climb the rate only under traffic"
  ```

### Task 2: Dokümanlar ve gerçek çalıştırma

**Files:**

- Modify: `CLAUDE.md` ("Rate limiting": tırmanma artık yalnızca trafik
  varken; dosya haritası satırı `backend/src/services/esi-limiter/`),
  `docs/superpowers/specs/2026-11-14-shared-esi-limiter-design.md` (§4.3
  kapasite cümlesi, §4.6 "yalnızca acquire, 6-7 izin/sn", başa tarihli
  not ve bu spec'e göreli bağlantı),
  `docs/superpowers/specs/2026-11-15-esi-limiter-smoothing-design.md`
  (sonuna "Sonuçlar")

- [ ] **Step 1: Dokümanları güncelle**
- [ ] **Step 2: Gerçek çalıştırma** — 2026-11-14 Sonuçlar ile aynı yöntem:
      Node `worker:character-corporation-history` ve Rust
      `worker:info:corporations:rs` aynı anda 3-5 dk; ESI yalnızca worker'lar
      üzerinden; süreçler PID ile durdurulur; kuyruk temizlenmez. Ölçülecekler:
      toplam hız, 429 sayısı, çift 429 var mı, oturduğu hız.
- [ ] **Step 3: Format ve link kontrolü** — `npx prettier --check` ve
      CLAUDE.md'deki link grep'i.
- [ ] **Step 4: Commit**

  ```bash
  git commit -m "docs: record the limiter smoothing and its results"
  ```
