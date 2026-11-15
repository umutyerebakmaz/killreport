# Rust karakter worker'ı ve kuyruğu (`worker-info-characters`, `queue-characters`) — tasarım

Tarih: 2026-11-15
Yol haritası: #315, §1 ve §2.

## Amaç ve neden

#315'teki sıranın ilk adımı. Karakter, info kuyrukları içinde en yüksek hacimli
olanı: `queue:characters` veritabanındaki bütün karakterleri kuyruğa basıyor,
`scan:entities` ile `queue:alliance-corp-characters` da eksikleri ekliyor. Rust'ın
bellek ve işlem hızı kazancı en net bu worker'da görülür.

Corporation portundan (`2026-11-14-rust-worker-runner-and-corporations-design.md`)
farklı olan tek yapısal şey ESI çağrısı. Node, `/characters/{id}/` isteğine
`X-Compatibility-Date: 2026-06-09` ekliyor (`character.service.ts:23`, `:53-56`).
`achievement_score` ve `character_title_id` ancak bu tarihle geliyor. Rust
`EsiClient` ise her isteğe sabit `2020-01-01` gönderiyor
(`crates/esi/src/client.rs:18`, `:92-95`) ve çağıranın bunu değiştirmesinin bir
yolu yok. Bu iş `esi` crate'ine istek başına uyumluluk tarihi verme yeteneği
ekler. Kullanıcının isteği: tarih esnek olsun, sabit tek bir tarih dayatılmasın,
değişiklik clean code ilkelerine uysun.

## Hedefler

1. **`esi` crate'i:** çağıran, tek bir istek için `X-Compatibility-Date`
   değerini seçebilir. Varsayılan `2020-01-01` olarak kalır; mevcut her çağrı
   değişmeden aynı başlığı gönderir.
2. **`backend-rs/workers/worker-info-characters`:** `esi_character_info_queue`
   kuyruğunu tüketir ve `worker-info-characters.ts` ile davranışça aynıdır.
   Kuyruk, mesaj, prefetch (5) ve upsert aynıdır. Log satırları `runner`'ın
   ortak biçimini izler; Node'dan farkları _Log satırları_ bölümünde.
3. **`backend-rs/queues/queue-characters`:** `queue-characters.ts` ile aynıdır.
   Argümanla verilen ID'leri ya da `characters` tablosundaki bütün ID'leri
   basar, `source: "queue-characters"`.
4. **`backend/package.json`:** `worker:info:characters:rs` ve
   `queue:characters:rs` script'leri, mevcut `:rs` script'leriyle aynı biçimde.
5. **#315:** iki satır işaretlenir, PR bağlantısı eklenir.

## Hedef dışı

- **`queue:alliance-corp-characters`.** Aynı kuyruğu besliyor ama ayrı bir
  zenginleştirme script'i; #315 §5'te kendi satırı var.
- **Node dosyalarını silmek, `ecosystem.config.js`'i Rust'a çevirmek.** Ayrı
  adım; Rust sürümü üretimde kendini kanıtladıktan sonra yapılır (#315, "How a
  port is done").
- **İstek başına `Authorization`.** `worker:user-killmails` ve
  `worker:corporation-killmails` portları buna ihtiyaç duyacak, ama bugün
  kullanan bir Rust worker'ı yok. Bkz. _Tasarım → esi_.
- **Node worker'ındaki eksikleri düzeltmek.** Örneğin karakter adı CCP
  tarafından değiştirilebilir, ama Node `name` alanını update'te yazmıyor.
  Parite için aynen korunur ve kodda not düşülür, corporation portundaki
  `home_station_id` / `shares` notu gibi
  (`worker-info-corporations/src/corporation.rs:44-48`).

## Anti-hedefler

- `esi` crate'inde mevcut çağıranları (`worker-info-alliances`,
  `worker-info-corporations`, `queue-alliances`) değiştirmeye zorlayan bir API
  kırılması.
- Aynı istekte iki ayrı `X-Compatibility-Date` başlığı gitmesi. Başlık tek
  olmalı: ya varsayılan ya da istenen.
- Serbest metin başlık kabul eden genel bir `headers` parametresi. Çağıran
  `User-Agent`'ı ezebilir ya da `Authorization`'ı log'a sızdırabilir; crate'in
  "hata mesajı token sızdırmaz" garantisi (`client.rs:33-34`) zayıflar.
- Rust worker'ının yazdığı satırın Node'un yazdığından herhangi bir kolonda
  farklı olması.

## Yaklaşımlar

- **A. İstek başına parametre (seçilen).** Çağıran tarihi isteğin yanında
  verir. Node'daki kullanım biçimine birebir karşılık gelir: tarihi isteyen
  servis onu kendisi söylüyor (`character.service.ts:55`). Tarih, ona ihtiyaç
  duyan alanları okuyan kodun yanında durur.
- **B. Crate içinde rota → tarih tablosu.** `esi` crate'i `/characters/{id}/`
  rotasını görünce tarihi kendisi seçer. Çağıranlar temiz kalır, ama tarih,
  hangi alanları getirdiğini bilen koddan uzakta, gizli bir yerde durur. Her
  yeni tarih `esi` crate'ine bir değişiklik demektir.
- **C. Varsayılan tarihi global olarak 2026-06-09'a çekmek.** En az kod, ama
  diğer bütün rotaların yanıt biçimini aynı anda değiştirir. Node bunu bilerek
  yapmamış (`esi-client.ts:23`). Elendi.

Kullanıcı A'yı seçti.

## Tasarım

### esi: istek başına uyumluluk tarihi

**Tip.** `pub struct CompatibilityDate(&'static str)`. ESI'nin beklediği
`YYYY-MM-DD` biçimini tipte taşır.

- `pub const fn new(date: &'static str) -> Self`: `const` bağlamında
  çağrılabilir, böylece worker tarihi bir sabit olarak tanımlar. Biçim `const`
  içinde doğrulanır (10 karakter, 4. ve 7. konumda `-`, diğerleri rakam); geçersiz
  bir sabit derlemede `panic!` ile durur. Takvim geçerliliği (ör. 2026-02-30)
  denetlenmez; ESI'nin kendisi reddeder ve gerçek kullanımda bu tarihler ESI
  changelog'undan kopyalanır.
- `pub const DEFAULT: CompatibilityDate = CompatibilityDate::new("2020-01-01")`:
  bugünkü `COMPATIBILITY_DATE` sabitinin yerini alır.
- `HeaderValue::from_static` ile başlığa çevrilir; `'static` olduğu için
  ayırma ya da hata yolu yoktur.
- `crates/esi/src/lib.rs`'den dışa açılır.

**İstek.** `EsiClient`'a bir metot eklenir:

```rust
pub async fn get_with_compatibility_date<T: DeserializeOwned>(
    &self,
    path: &str,
    date: CompatibilityDate,
) -> Result<T, EsiError>
```

`get(path)` bunun `CompatibilityDate::DEFAULT` ile çağrılan inceltmesi olur.
Limiter alma, observe, 420/429 ayrımı, decode ve hata tipleri tek yerde,
bugünkü `get` gövdesinde kalır; iki metot arasında kopya kod olmaz.

`x-compatibility-date` `default_headers`'tan çıkarılır ve her istekte istek
seviyesinde konur. Böylece başlığın tek olduğu ve hangi değerin gittiği tek
satırdan okunur. `User-Agent` default header olarak kalır.

**Neden genel bir `headers` ya da builder değil:** Bugün tek ihtiyaç tarih
(_Anti-hedefler_). İleride `Authorization` gerektiğinde, aynı biçimde tipli
bir parametre ya da o noktada gerçekten iki seçenek varsa küçük bir
`RequestOptions` eklenir. O karar ilk token'lı worker portunun spec'inde
verilir.

**Testler** (`crates/esi/tests/`, mevcut `wiremock` kalıbıyla):

- `get` hâlâ tam olarak `x-compatibility-date: 2020-01-01` gönderiyor.
- `get_with_compatibility_date` verilen tarihi gönderiyor ve istekte bu
  başlıktan yalnızca bir tane var.
- `CompatibilityDate::new` geçerli bir tarihi kabul ediyor. Geçersiz biçimler
  `#[should_panic]` testleriyle reddediliyor (`const` dışında çağrılarak).

### worker-info-characters

Crate düzeni corporation ile aynı: `src/character.rs` (ESI tipi, başlık
alanları, upsert), `src/lib.rs`, `src/main.rs` (`runner::Worker` impl'i),
`tests/parse.rs`, `tests/upsert.rs`, `tests/fixtures/characters.sql`.

**Sabit.** `character.rs` içinde:

```rust
/// `achievement_score` and `character_title_id` only exist from this date on
/// (`character.service.ts:23`).
pub const CHARACTER_COMPATIBILITY_DATE: CompatibilityDate = CompatibilityDate::new("2026-06-09");
```

**`CharacterInfo`** (`EsiCharacterInfo`, `character.service.ts:25-39`):
`name`, `corporation_id`, `birthday` (`DateTime<Utc>`), `bloodline_id`,
`race_id`, `gender` zorunlu. `alliance_id`, `security_status`, `description`,
`faction_id`, `corporation_title` `#[serde(default)] Option`.

`achievement_score` ve `character_title_id` decode'u **düşürmemeli.** Node,
yanlış tipte ya da aralık dışı bir değeri uyarıyla atıp satırın geri kalanını
yine yazıyor. Bu yüzden ikisi gevşek okunur (`Option<serde_json::Value>`) ve
doğrulama decode'dan sonra yapılır. Sıkı tipler (`Option<i32>`,
`Option<Uuid>`) seçilirse, beklenmedik tek bir değer bütün mesajı decode
hatasına ve yeniden denemeye çevirir. Node'da böyle bir davranış yok.

**`TitleFields`** ve `title_fields(&CharacterInfo) -> TitleFields`
(`helpers/character-achievement.ts`'in portu):

- `title = corporation_title`
- `achievement_score`: yalnızca 0 ile `i32::MAX` arasındaki tam sayılar
  (`1.0` dahil, Node'un `Number.isInteger` davranışı). Değilse `None` ve
  `warn!("Ignoring achievement_score {v}: not an int32 >= 0")`.
- `character_title_id`: yalnızca `UUID_PATTERN` (`sde-character-title.ts:1-2`,
  büyük/küçük harf duyarsız) ile eşleşen string. Değilse `None` ve
  `warn!("Ignoring character_title_id {v}: not a UUID")`.
- Uyarı metinleri Node ile aynı. `{v}` Node'un `String(x)` çıktısına
  olabildiğince yakın yazılır; birebir eşitlik hedeflenmez.

UUID için yeni bir crate eklenmez. Desen basit ve sabit, bu yüzden elle
yazılmış bir denetim (36 karakter, tire konumları, hex) yeterli. `regex`
workspace'te zaten var; onu kullanmak da kabul edilebilir.

**Upsert** (`worker-info-characters.ts:103-133`), corporation ile aynı biçimde
tek `INSERT … ON CONFLICT (id) DO UPDATE … RETURNING (xmax = 0)`:

- **INSERT:** bütün kolonlar ve `updated_at = now()`. `created_at` veritabanı
  varsayılanı.
- **UPDATE:** `corporation_id`, `alliance_id`, `security_status`,
  `description`, `title`, `character_title_id`, `achievement_score`,
  `faction_id` ve `updated_at = now()`. ESI'nin göndermediği opsiyonel alan
  NULL yazılır, yani eski değer kalmaz. `name`, `birthday`, `bloodline_id`,
  `race_id`, `gender` yazılmaz. Bu Node'daki yorumla aynı; `name` için yukarıdaki
  not düşülür.
- `birthday`, `timestamp(3) without time zone`; corporation'daki
  `date_founded` gibi UTC anı naive olarak bağlanır.
- `character_title_id` kolonu `uuid` tipinde. Workspace'teki `sqlx`'te `uuid`
  özelliği yok; doğrulanmış string `$n::text::uuid` cast'iyle bağlanır, böylece
  yeni bağımlılık gerekmez. Tek `::uuid` runtime `sqlx::query` ile çalışır ama
  `query_scalar!` makrosunda Postgres parametreyi `uuid` olarak çıkarır ve
  derleme `uuid` özelliğini ister; `::text::uuid` iki yolda da çalışır.
- `xmax = 0` Node'daki ayrı `findUnique`'in yerini alır, corporation'daki gibi.
- `query_scalar!` kullanılırsa `.sqlx` güncellenir; CI `SQLX_OFFLINE=true` ile
  derliyor.

**Worker impl'i:**

- `QUEUE_NAME = "esi_character_info_queue"`
- `PREFETCH_COUNT = 5`
- `CONSUMER_TAG = "worker-info-characters-rs"`
- `STARTED = "👤 character info worker started"`
- `WAITING_FOR = "characters"`
- `ENTITY = "character"`

`handle`, `esi.get_with_compatibility_date(&format!("/characters/{id}/"),
CHARACTER_COMPATIBILITY_DATE)` çağırır (sondaki `/` Node ile aynı), sonra
upsert yapar. `detail = " {name}"`; böylece yeni satır Node'un satırıyla
(`  ✅ [n] <name> (created)`, `worker-info-characters.ts:143-145`) aynı olur.

**Log satırları.** `runner` bütün Rust worker'ları için tek biçim kullanır
(`crates/runner/src/lib.rs:46-57`, `run.rs:163-177`) ve worker türüne göre
dallanmaz (`lib.rs:4`). Node karakter worker'ı bundan üç yerde ayrılıyor; bu
farklar **korunmaz**, Rust worker'ı alliance ve corporation ile aynı satırları
yazar:

- Güncellenen satırın ikonu: Node `↻`, runner `✅`
  (`worker-info-characters.ts:138-140`).
- Özet sözcükleri: Node `added, skipped`, runner `created, updated`
  (`worker-info-characters.ts:58`, `run.rs:174`).
- Node her 50 mesajda bir ara `📊 summary:` satırı da basıyor
  (`worker-info-characters.ts:151-155`); runner özeti yalnızca kuyruk
  sessizleşince basar.

Paritenin amacı yazılan veri ve kuyruk sözleşmesi; log metni bir sözleşme
değil, hiçbir araç bu satırları ayrıştırmıyor. Birebir log için `runner`'a
worker başına kanca eklemek ortak bir crate'i değiştirir ve diğer iki worker'ı
yeniden doğrulamayı gerektirir. Bu iş için orantısız. Corporation portu da ANSI
renkleri için aynı kararı vermişti
(`2026-11-14-rust-worker-runner-and-corporations-design.md:205-207`).

### queue-characters

`queue-corporations` crate'inin kopyası, yalnızca şu farklarla:

- `QUEUE_NAME = "esi_character_info_queue"`
- `SOURCE = "queue-characters"`
- `SELECT id FROM characters ORDER BY id`
- Log metinlerinde "character"
- Son satır: `now run the worker: yarn worker:info:characters:rs`

`parse_ids` ve `all_*_ids` imzaları corporation ile aynıdır. İki crate'in
ortak bir yardımcıya çekilmesi bu işin konusu değil. Üçüncü kopya geldiğinde
(`queue:types`) değerlendirilir.

## Doğrulama

- `cargo test` (workspace): `esi` başlık testleri, `title_fields` birim
  testleri (`character-achievement.spec.ts`'in bütün vakaları: tam değerler,
  eksik anahtarlar, skor 0, int32 sınırı ve -1, ondalık skor, UUID olmayan id,
  büyük harfli UUID), `CharacterInfo` parse testleri (eksik opsiyonel
  anahtarlar, yanlış tipte skor decode'u düşürmüyor), `#[sqlx::test]` upsert
  testleri (insert, update'te değişmeyen kolonlar, NULL'a dönen opsiyoneller,
  geçerli `uuid` yazımı), queue ID sorgusu ve argüman parse'ı.
- `cargo clippy --workspace -- -D warnings` ve `cargo fmt --check`.
- `npx prettier --check backend/package.json` ve spec dosyası.
- **Yerelde bir kez, worker'lar durdurulmuşken:**
  1. Birkaç ID'yi önce `queue:characters`, sonra `queue:characters:rs` ile
     bas; mesaj gövdeleri `source` ve `queuedAt` dışında aynı olmalı.
  2. Aynı karakter kümesini önce Node, sonra Rust worker'ıyla işle; iki
     koşunun yazdığı satırlar `updated_at` dışında aynı olmalı. Aralarından en
     az birinin `achievement_score` ve `character_title_id` alanları dolu
     olmalı; bu, tarihin gerçekten gittiğinin kanıtıdır.
  3. Satır sayısı işlem öncesi ve sonrası karşılaştırılır; hiçbir satır
     silinmez.

## Kararlarım (kullanıcı onayı değil, düzeltilebilir)

- Tip adı `CompatibilityDate`, metot adı `get_with_compatibility_date`.
  Kısaltmasız, `get`'in yanında okununca ne yaptığı belli.
- Biçim doğrulaması `const` içinde yapılır; geçersiz sabit derlemede yakalanır.
- `achievement_score` ve `character_title_id` gevşek okunur, böylece decode
  Node gibi bunlar yüzünden düşmez.
- UUID için yeni bağımlılık eklenmez; elle denetim ve `$n::text::uuid` cast
  kullanılır.
- Log satırları Node'u değil `runner`'ın ortak biçimini izler (`↻` ikonu,
  `added/skipped` sözcükleri ve 50'de bir ara özet yok). Bkz. _Log satırları_.
- `queue-characters` şimdilik `queue-corporations`'ın kopyası olur; ortak
  yardımcı üçüncü kopyada değerlendirilir.
- Karakter adının update'te yazılmaması parite için korunur ve kodda not düşülür.

## Kurucuya kalanlar

- `title_fields` uyarılarında `{v}`'nin tam biçimi.
- Upsert'te `query_scalar!` ile `.sqlx` güncellemek mi, runtime `sqlx::query`
  kullanmak mı.
- Fixture SQL'i (`characters` tablosunun yalnızca testte gereken kolonları ve
  `character_title_id uuid`).
