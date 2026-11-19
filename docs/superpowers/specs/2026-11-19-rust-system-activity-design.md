# Rust `system-activity` işi

#315'teki port serisinin bir adımı: 3. tablodaki `worker:system-activity`.

## Amaç ve neden

Saatlik sistem aktivitesi snapshot'ı hâlâ Node'da:

| Node                     | Rust (yeni)                 | Yazdığı tablo     |
| ------------------------ | --------------------------- | ----------------- |
| `worker:system-activity` | `worker:system-activity:rs` | `system_activity` |

Kuyruğu yok: ESI'den iki liste çeker, birleştirir, yazar ve çıkar. Seri boyunca
anlaşılan kural "taşırken düzelt, düzeltmeyi TypeScript tarafına da uygula".
Bu işte düzeltilecek bir kusur bulunmadı (aşağıda _Kusurlar_), bu yüzden port
Node davranışını birebir taşır ve Node tarafında değişiklik yoktur.

## Bugün

`backend/src/workers/worker-system-activity.ts`, saatte bir systemd timer'ıyla
(`deploy/systemd/killreport-worker-system-activity.timer`,
`OnCalendar=*-*-* *:00:00 UTC`):

1. Snapshot saati: çalışma anı, UTC saate aşağı yuvarlanmış
   (`hourSnapshotTime`, `backend/src/utils/system-activity.ts`).
2. İki istek aynı anda, `esiClient` üzerinden:
   `GET /universe/system_kills` ve `GET /universe/system_jumps`, ikisi de
   `X-Compatibility-Date: 2025-12-16` ile
   (`backend/src/services/solar-system/solar-system.service.ts:56-65` ve
   ardından gelen `getSystemJumps`).
3. Biri başarısız olursa hiçbir şey yazılmaz, süreç 1 ile çıkar. Yarım snapshot
   bilinçli olarak yazılmıyor: eksik yarı o saat için "raporlanmadı" diye
   kalır ve saat bir daha ziyaret edilmez.
4. İki liste de boşsa uyarı loglanır, yazılmaz, 0 ile çıkılır.
5. `mergeSystemActivity`: sistem başına bir satır. Bir listede olmayan
   sistemin kill sayıları **0**, jump sayısı **null** olur. Asimetri bilinçli;
   gerekçesi `utils/system-activity.ts` içinde ve `system_activity.ship_jumps`
   şemada nullable (`backend/prisma/schema/systemActivity.prisma`).
6. 1000'lik gruplarla `createMany({ skipDuplicates: true })`. `(system_id,
timestamp)` unique olduğu için aynı saati yeniden çalıştırmak zararsızdır;
   ilk yazılan satır kalır.
7. Toplamlar loglanır: ship / pod / NPC kill, ship jump, yazılacak satır,
   yazılan satır, süre.

## Kusurlar

Bulunmadı. Bakılan ve bilerek değiştirilmeyenler:

- **Snapshot saati çalışma anından geliyor, ESI'nin `Last-Modified`'ından
  değil.** ESI bu listeleri bir saatlik cache'le veriyor; etiket verinin
  kendi saatinden bir saate kadar kayık olabilir ama her çalışma ayrı bir
  saati yazdığı için kayma sabittir. Değiştirmek mevcut grafiklerin saat
  eksenini kaydırır; kapsam dışı.
- **`solar_systems`'ta olmayan bir `system_id`** foreign key'e takılır ve
  çalışma hata ile biter. Node'da da öyle; evren verisi tam yüklü olduğu
  sürece olmaz. Aynı davranış korunur.

## Tasarım

Yeni crate: `backend-rs/workers/worker-system-activity`, `worker-alliance-snapshots`
gibi tek seferlik bir iş (kuyruk, `runner::run` yok; `runner::init` var).

**`lib.rs`, saf kısım:**

- `EsiSystemKills { system_id, npc_kills, pod_kills, ship_kills }` ve
  `EsiSystemJumps { system_id, ship_jumps }`, `serde::Deserialize`.
- `hour_snapshot_time(now: DateTime<Utc>) -> DateTime<Utc>`: dakika, saniye ve
  alt-saniye sıfırlanır.
- `merge_system_activity(kills, jumps, timestamp) -> Vec<SystemActivityRow>`:
  Node'daki kurallar; `ship_jumps: Option<i32>`. Sıra: önce kills listesinin
  sırası, sonra yalnızca jumps'ta olan sistemler, Node'daki `Map` ile aynı.
- `insert_snapshot(pool, rows) -> sqlx::Result<u64>`: tek bir
  `INSERT INTO system_activity (system_id, npc_kills, pod_kills, ship_kills,
ship_jumps, timestamp) SELECT * FROM UNNEST($1::int[], …, $6::timestamp[])
ON CONFLICT (system_id, timestamp) DO NOTHING`; dönen değer yazılan satır
  sayısı (`rows_affected`). Tek ifade olduğu için ya hepsi ya hiçbiri yazılır;
  Node'daki 1000'lik gruplama yalnızca Prisma'nın parametre sınırı içindi.
  `timestamp` sütunu `timestamp(3)` (saat dilimsiz, UTC) olduğu için değer
  `NaiveDateTime` olarak gönderilir.

**`main.rs`:**

- `DATABASE_URL`, `RateLimiter::from_env()`, `EsiClient::new(limiter)`.
- `tokio::try_join!` ile iki `get_with_compatibility_date` çağrısı,
  `CompatibilityDate::new("2025-12-16")`. Herhangi bir hata: `error!` ve
  `exit(1)`, hiçbir şey yazılmaz.
- İki liste de boşsa `warn!` ve 0 ile çıkış.
- Node'daki log satırları aynı sırayla ve aynı emojilerle.

**`backend/package.json`:** `worker:system-activity:rs`, diğer `:rs`
script'leri gibi `cargo run --release … -p worker-system-activity`.

## Testler

- `lib.rs` birim testleri, `backend/src/utils/system-activity.spec.ts`'deki
  durumların karşılıkları: saat yuvarlama; yalnızca kills'te olan sistem
  (`ship_jumps = None`); yalnızca jumps'ta olan sistem (kill'ler 0); ikisinde de
  olan sistem; boş listeler; sıra (önce kills, sonra yalnızca jumps'takiler);
  bir listede tekrarlanan sistemde sonuncunun kazanması, ilk görüldüğü sırayı
  koruyarak (Node'daki `Map.set` davranışı).
- `#[sqlx::test]` ile `insert_snapshot`: satırlar yazılır, `None` jump `NULL`
  olarak saklanır, aynı saati ikinci kez yazmak 0 döner ve ilk satırları
  değiştirmez.

## Kapsam dışı

- Node dosyası, systemd unit'i ve timer'ı değişmez; Node script'i Rust
  sürümü kendini kanıtlayana kadar kalır.
- `Last-Modified`'a dayalı snapshot saati (yukarıda).
- #315'teki "Runs" sütununun PM2'den systemd'ye güncellenmesi (ayrı iş).
