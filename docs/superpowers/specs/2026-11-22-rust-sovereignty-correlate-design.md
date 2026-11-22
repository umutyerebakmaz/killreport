# Rust sovereignty correlate: `worker:sov:correlate`

#315 serisinin bir adımı: 3. tablonun son satırı, `worker:sov:correlate`.
Kısa tasarım, küçük bir değişiklik. Kural yine "taşırken düzelt, düzeltmeyi
TypeScript tarafına da uygula".

## Bugün

`backend/src/workers/worker-sovereignty-correlate.ts`, systemd timer'ıyla 10
dakikada bir çalışır (`deploy/systemd/killreport-worker-sov-correlate.timer`).
ESI'ye ve Redis'e gitmez; alert yayınlamaz (#315'teki satır bunu yanlış
söylüyordu, düzeltildi).

1. `end_time IS NULL` olan kampanyaları okur.
2. Her kampanya için, döngü içinde:
   - aynı sistemde `killmail_time ∈ [start_time − 24 saat, şimdi]` olan ve
     `related_campaign_id IS NULL` killmail'lere `related_campaign_id` ve
     `is_war_related = true` yazar (`updateMany`);
   - bu kampanyaya bağlı killmail'lerin sayısını ve `total_value` toplamını,
     `defender_id` doluysa victim alliance'ı defender olanlarınkini ayrıca
     alır;
   - kill varsa `campaign_combat_stats`'a upsert eder: `war_kills`,
     `ships_destroyed` (ikisi aynı sayı), `isk_destroyed`,
     `defender_ships_lost` / `defender_isk_lost`, attacker tarafı = toplam −
     defender.

Okuyan taraf: `backend/src/resolvers/sovereignty/queries.ts:239` (aktif ve
geçmiş kampanya listeleri) ve `:575`. Killmail tarafında `is_war_related`
filtresi (`resolvers/killmail/queries.ts:163`, `:345`).

## Kusurlar

1. **Kampanyanın son dakikaları kayboluyor.** Kampanya bittiğinde
   (`worker-sovereignty-campaigns.ts:162`, `end_time = now`) bir daha
   işlenmez. Son çalıştırmadan bitişe kadarki en fazla 10 dakikanın kill'leri
   hiç bağlanmaz, istatistik son haliyle kalmaz. Geç gelen killmail'ler için
   de aynısı. Geçmiş kampanya sayfası bu eksik sayıları gösterir.
2. **Üst üste binen kampanyalar.** Aynı sistemde iki aktif kampanya varsa bir
   kill'i döngüde önce gelen alır; sıra `findMany`'nin sırasıdır, belirsiz.
3. **Döngüde sorgu.** Kampanya başına 3–4 sorgu.
4. **Transaction yok.**

## Yaklaşımlar

Kullanıcı kararı, biten kampanyaların ne kadar daha işleneceği üzerineydi:

- **A — bitişten sonra 24 saat (kullanıcı seçti).** Pencere
  `[start_time − 24 saat, end_time]`; kampanya `end_time`'dan 24 saat sonrasına
  kadar her çalıştırmada işlenir. Son dakikalar ve geç gelen killmail'ler
  yakalanır; 24 saat başlangıçtaki payla simetrik.
- B — bitişten sonra 1 saat. Daha az iş, ama saatlerce geç gelen killmail
  kaçar.
- C — bugünkü gibi. Hata kalır.

Nasıl yapılacağı tek makul yol: Rust ve Node aynı küme tabanlı SQL'i
çalıştırır (#346'daki snapshot gibi). Kampanya başına döngüyü Rust'a birebir
taşımak kusur 3'ü korur ve iki dilde ayrı mantık bırakır.

## Tasarım

**Parametre.** `now` uygulamadan UTC olarak bağlanır (`timestamp`, saat
dilimsiz). Veritabanı `CURRENT_TIMESTAMP` / `now()` kullanılmaz: yerel oturum
`Europe/Istanbul` ve kolonlar saat dilimsiz, `now()` yerel saati yazardı.

**Uygun kampanyalar.** `end_time IS NULL OR end_time >= now − 24 saat`.
Pencere: `[start_time − 24 saat, COALESCE(end_time, now)]`.

**Tek transaction, iki ifade:**

1. **Bağlama.** Henüz bağlanmamış (`related_campaign_id IS NULL`) ve en az bir
   uygun kampanyanın sistemine ve penceresine düşen her killmail, tek bir
   kampanyaya bağlanır: önce başlayan (`start_time` küçük olan), eşitlikte
   küçük `campaign_id`. `DISTINCT ON (killmail_id)` + `UPDATE ... FROM`.
   `is_war_related = true`, `updated_at = now` (Prisma'nın `@updatedAt`'i ham
   SQL'de kendiliğinden yazılmaz).
2. **İstatistik.** Uygun kampanyaların her biri için bağlı killmail'lerin
   toplamı; `war_kills > 0` olanlar `INSERT ... ON CONFLICT (campaign_id) DO
UPDATE` ile yazılır, `last_correlated = now`. Formüller bugünkü gibi:
   `ships_destroyed = war_kills`, defender = victim `alliance_id` =
   `defender_id` (defender NULL ise 0), attacker = toplam − defender,
   `total_value` NULL ise 0.

Bir kez bağlanmış killmail yeniden değerlendirilmez (bugünkü gibi).

**Log.** Node'la aynı: başlangıç, `correlating against N campaigns` (artık
aktif + son 24 saatte biten), `✅ correlation complete: X new killmails tagged,
Y/N campaigns have war kills (Zs)`.

**Rust.** Yeni crate `backend-rs/workers/worker-sovereignty-correlate`
(`lib.rs` + `main.rs`, `worker-sovereignty-snapshot` düzeninde), script
`worker:sov:correlate:rs`. ESI, Redis ve `sov` crate'i yok.

**Node.** Aynı SQL'e geçer (`$transaction` içinde iki `$executeRaw`, bir de
kampanya sayısı için `$queryRaw`), `now` JS `Date` olarak değil
`toISOString()`'den türetilmiş saat dilimsiz bir string olarak bağlanır.

**Testler.** `#[sqlx::test]` ile: pencere sınırları (başlangıç − 24 saat,
bitiş), biten kampanyanın 24 saat boyunca işlenmesi ve sonra işlenmemesi,
bitişten sonraki kill'in bağlanmaması, üst üste binen kampanyada önce
başlayanın kazanması, zaten bağlı kill'e dokunulmaması, defender/attacker
ayrımı (defender NULL dahil), `total_value` NULL, tekrar çalıştırmada aynı
sonuç, kill'i olmayan kampanyaya satır yazılmaması.

## Kapsam dışı

- `AlertPublisher`'ın Redis kapalıyken her olayda yeniden bağlanmayı denemesi
  (#344 review notu). Correlate'le ilgisi yok; ayrı küçük bir PR.
- systemd unit'inin Rust'a geçirilmesi.
- Geçmiş, 24 saatten eski biten kampanyaların yeniden hesaplanması.

## Builder'a kalan

SQL'in tam metni, fonksiyon bölünmesi, fixture seçimi.
