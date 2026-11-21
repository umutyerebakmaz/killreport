# Rust sovereignty snapshot: `worker:sov:snapshot`

#315 serisinin bir adımı: 3. tablodaki `worker:sov:snapshot` satırı. Kısa
tasarım, küçük bir değişiklik.

## Amaç ve neden

Günlük sov snapshot işinin Rust karşılığını yazmak. Seri boyunca geçerli kural
burada da geçerli: "taşırken düzelt, düzeltmeyi TypeScript tarafına da
uygula". `worker:sov:correlate` bu işin kapsamında değil, bir sonraki adım.

## Bugün

`backend/src/workers/worker-sovereignty-snapshot.ts`, systemd timer'ıyla her
gün 01:00 UTC'de çalışır (`deploy/systemd/killreport-worker-sov-snapshot.timer`).
ESI'ye gitmez, sadece veritabanını okur ve yazar:

1. `sovereignty_map_current` → `sovereignty_map_snapshots`, tarih = **bugün**,
   `skipDuplicates` (aynı gün ikinci çalışma ilk değerleri korur).
2. Alliance başına sayımlar → `alliance_territory_stats`, tarih = **bugün**:
   `systems_controlled`, `ihub_count` (32458), `tcu_count` (32226),
   `campaigns_defending`, `campaigns_attacking` (aktif kampanyada defender
   olmayan katılımcı), `systems_gained` / `systems_lost` (`territory_changes`,
   `detected_at >= bugün 00:00`).
3. Her alliance için döngü içinde tek tek `upsert`.

Okuyan taraf: `backend/src/resolvers/sovereignty/queries.ts:158-210`,
`MAX(date)` olan günün satırları.

## Kusurlar

1. **gained/lost bir saatlik.** İş 01:00'de çalışıyor, sayım bugünün
   00:00'ından başlıyor: leaderboard'daki kazanılan/kaybedilen sütunları
   yalnızca 00:00–01:00 arasını gösteriyor.
2. **Eski satır kalıyor.** Aynı gün tekrar çalışınca artık listede olmayan
   alliance'ın satırı silinmiyor, harita snapshot'ı da `skipDuplicates`
   yüzünden güncellenmiyor.
3. **Döngüde sorgu.** Alliance başına bir `upsert`.
4. **Transaction yok.** Yarıda kalan bir çalışma yarım gün bırakır.

## Yaklaşımlar

- **A — satır dünün kapanışı (kullanıcı seçti).** Tarih = dün (UTC).
  gained/lost dünün tam UTC gününü sayar: `[dün 00:00, bugün 00:00)`. Harita,
  yapı ve kampanya sayıları çalışma anındaki (01:00) halidir. Leaderboard her
  zaman tamamlanmış bir günü gösterir.
- B — tarih bugün kalır, gained/lost son 24 saati sayar. Tarih etiketi
  değişmez ama pencere takvim gününe denk gelmez. Seçilmedi.

## Tasarım

**Gün.** `D = (şimdi, UTC).date() - 1`. Saat dilimi açıkça UTC bağlanır,
oturum saat dilimine güvenilmez. Elle gündüz çalıştırılırsa da `D` dündür,
harita o anki haliyle yazılır; bu kabul edilir.

**Boş harita koruması.** `sovereignty_map_current` boşsa uyarı yazılır ve hiçbir
şey silinmeden çıkılır (#344'teki boş feed korumalarıyla aynı mantık). Aksi
halde aşağıdaki silme `D` gününü boşaltırdı.

**Tek transaction, hepsi SQL'de:**

1. `DELETE FROM sovereignty_map_snapshots WHERE snapshot_date = D`
2. `INSERT INTO sovereignty_map_snapshots (...) SELECT ..., D FROM sovereignty_map_current`
3. `DELETE FROM alliance_territory_stats WHERE date = D`
4. Tek bir `INSERT INTO alliance_territory_stats (...) SELECT ...`: her
   sayım bir CTE, alliance ID'leri bunların birleşimi, eksik sayım `0`.
   - `campaigns_attacking`: `end_time IS NULL` kampanyalarda
     `p.alliance_id IS DISTINCT FROM c.defender_id` olan katılımcılar
     (Node'daki `!==` ile aynı, `defender_id` NULL ise bütün katılımcılar
     sayılır).
   - gained/lost: `detected_at >= D AND detected_at < D + 1`.

Sil-yaz, kusur 2'yi çözer (çalışma tekrarlanabilir, sonuç her seferinde
son durum). Tek `INSERT ... SELECT`, kusur 3'ü çözer.

**Rust.** Yeni crate `backend-rs/workers/worker-sovereignty-snapshot`
(`lib.rs` + `main.rs`, `worker-sovereignty-map` düzeninde), yalnızca `db`,
`sqlx`, `chrono`, `runner`, `tracing`, `anyhow`. ESI ve Redis yok. Script:
`worker:sov:snapshot:rs`. Log'lar Node'la aynı: başlangıç, snapshot satır
sayısı, stat satır sayısı, süre.

**Node.** Aynı SQL'e geçer (`prismaWorker.$transaction` içinde `$executeRaw`),
aynı `D`, aynı boş harita koruması. Timer Node'u çalıştırmaya devam ettiği
için bu düzeltme olmadan leaderboard bir saatlik sayıyı göstermeyi sürdürür.

**Geçiş günü.** Node'un eski hali `D+1` tarihli bir satır yazmış olabilir
(bir saatlik). Düzeltilmiş iş o gün `D`'yi yazar; ertesi gün `D+1`'i sil-yaz
ile tam günle ezer. Elle temizlik gerekmez.

**Testler.** `#[sqlx::test]` ile: tam gün penceresi (`D` öncesi, içi, sonrası
birer değişiklik), tekrar çalıştırmada eski alliance satırının gitmesi, boş
haritada hiçbir şeyin silinmemesi, defender'ın attacking'e sayılmaması.
Node tarafına aynı senaryolarda bir spec.

## Kapsam dışı

- systemd unit'inin Rust'a geçirilmesi.
- `tcu_count`/`ihub_count` type ID'lerinin güncel olup olmadığı.
- Geçmiş günlerin yeniden hesaplanması.

## Builder'a kalan

SQL'in tam metni, CTE adları, Rust fonksiyon bölünmesi, log metninin
ayrıntısı.
