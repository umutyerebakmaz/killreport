# Rust alliance–corporation worker'ı ve kuyruğu (`worker-alliance-corporations`, `queue-alliance-corporations`) — tasarım

Tarih: 2026-11-16
Önceki adımlar: [type worker'ı](2026-11-16-rust-type-info-worker-design.md),
[runner ve corporations](2026-11-14-rust-worker-runner-and-corporations-design.md),
#315

## Amaç ve neden

#315'teki sıranın bir sonraki adımı. Node'u adım adım emekliye ayırmak için
alliance–corporation zincirinin iki halkası Rust'a taşınır:

| Node                                                  | Rust                                              | Kuyruk                            |
| ----------------------------------------------------- | ------------------------------------------------- | --------------------------------- |
| `backend/src/workers/worker-alliance-corporations.ts` | `backend-rs/workers/worker-alliance-corporations` | `esi_alliance_corporations_queue` |
| `backend/src/queues/queue-alliance-corporations.ts`   | `backend-rs/queues/queue-alliance-corporations`   | `esi_alliance_corporations_queue` |

Zincir bugün şöyle:

```
queue:alliance-corporations   DB'deki bütün alliance ID'leri → esi_alliance_corporations_queue
worker:alliance-corporations  GET /alliances/{id}/corporations → her corp ID → esi_corporation_info_queue
worker:info:corporations      GET /corporations/{id}/ → corporations (alliance_id dahil)
```

Alliance–corporation ilişkisi yalnızca `corporations.alliance_id` sütununda
durur ve onu `worker-info-corporations` yazar. Bu worker bir **keşif**
adımıdır: alliance'ın üye corporation'larını bulup bilgi kuyruğuna basar,
kendisi hiçbir tabloya yazmaz.

Kullanıcının ikinci derdi: zinciri yerelde elle, gözle, sırası gelince
tetiklemek. Worker'lar açık bırakılıyor, yani worker'lar arası adımlar zaten
kendiliğinden akıyor. Tek gerçek sıra bağımlılığı kuyruk script'leri arasında:
Node `queue:alliance-corporations` alliance ID'lerini **veritabanından**
okuduğu için `worker:info:alliances`'ın yeni alliance'ları yazmış olmasını
bekliyor. Sunucudaki 22:00 / 22:05 timer farkı da bu bekleyişe dayanıyor.
Rust kuyruğu listeyi ESI'den alarak bu bağımlılığı kaldırır.

## Hedefler

- **`runner` genişler** ki kuyruğa basan bir worker da onu kullanabilsin:
  - `Worker::handle` bir bağlam parametresi alır. Bağlamın içinde o anki
    RabbitMQ bağlantısına ait bir yayıncı (publisher) vardır.
  - Sonuç tipi worker'ın kendi sayacını taşır. Bilgi worker'ları için
    `created` / `updated` aynen kalır, yeni worker için "kaç mesaj basıldı"
    eklenir.
  - Kuyruk boşalınca basılan son özet satırı worker türüne göre değişir.
    Bilgi worker'larının bugünkü satırı birebir aynı kalır.
- **`mq` genişler:**
  - `EntityMessage::source` sabit metin (`&'static str`) yerine çalışma anında
    üretilen bir metni de taşıyabilir (`alliance_99000001`).
  - Yayına isteğe bağlı bir AMQP önceliği (priority) verilebilir. Mevcut
    yayıncılar önceliksiz basmaya devam eder.
- **`worker-alliance-corporations`**, Node worker'ının birebir karşılığı:
  - Kuyruk `esi_alliance_corporations_queue`, çıkış kuyruğu
    `esi_corporation_info_queue`.
  - Her mesaj için `GET /alliances/{id}/corporations`. Sonda `/` yok, Node'la
    aynı (`alliance.service.ts:33`). Varsayılan uyumluluk tarihi kullanılır.
  - Listedeki her corporation ID'si için bir mesaj:
    `{"entityId":<corpId>,"queuedAt":"…","source":"alliance_<allianceId>"}`,
    kalıcı (delivery mode 2), **öncelik 3**.
  - Basılan bütün mesajlar broker tarafından onaylanmadan (publisher confirm)
    alliance mesajı ack'lenmez.
  - Liste boşsa hiçbir şey basılmaz, mesaj ack'lenir ve işlenmiş sayılır.
  - Log satırları için alliance adı ve ticker'ı veritabanından okunur
    (`SELECT name, ticker FROM alliances WHERE id = $1`). Satır yoksa
    `Unknown` / `???`, Node'daki gibi.
- **`queue-alliance-corporations`**: bir root scan.
  - `GET /alliances` (ESI listesi, sayfasız, `queue-alliances` ile aynı
    çağrı). Filtre yok, liste olduğu gibi basılır.
  - Mesaj: `{"entityId":<allianceId>,"queuedAt":"…","source":"esi_alliance_corporations_queue"}`.
    `source` değeri Node'un bugün bastığı değerle aynıdır, tuhaf da olsa.
    Kalıcı, **öncelik 5**.
  - Veritabanına bağlanmaz.
- **`backend/package.json`**:
  - `queue:alliance-corporations:rs` ve `worker:alliance-corporations:rs`,
    ötekilerle aynı biçimde (`cargo run --release --manifest-path …`).
  - Zinciri tek komutla başlatan bir satır:
    `"queue:alliance-chain:rs": "yarn queue:alliances:rs && yarn queue:alliance-corporations:rs"`.
    İki script birbirini beklemez; sırayla çalışmalarının tek sebebi
    `cargo run`'ın derleme kilidini aynı anda istememeleri.

## Hedef olmayanlar

- Node dosyalarına (`worker-alliance-corporations.ts`,
  `queue-alliance-corporations.ts`, `AllianceService`) dokunulmaz.
- systemd timer'ları ve unit'leri değişmez. Sunucu Node script'lerini
  çalıştırmaya devam eder; Rust'a geçiş #315'e göre ayrı bir adımdır. 22:00 /
  22:05 farkı o adımda gereksizleşir.
- Zinciri tek bir worker'da birleştirmek. Konuşmada elendi: corporation'ı
  çekip yazan kod iki yerde olur, `corporations`'a iki worker yazar ve hata
  telafisi alliance başına kabalaşır.
- Worker'ları tek komutla başlatmak. Kullanıcı worker'ları açık bırakıyor.
- Node'un bu worker için kullandığı sabit `PREFETCH_COUNT = 5`. Rust worker'ı
  runner'ın ortak kuralını kullanır (aşağıda).

## Anti-hedefler

- Corporation mesajları onaylanmadan alliance mesajını ack'lemek. Worker
  ack'ten sonra çökerse o alliance'ın corporation'ları kaybolur.
- `worker-alliance-corporations`'ın herhangi bir tabloya yazması.
- Bilgi worker'larının log çıktısının ya da davranışının runner değişikliğiyle
  değişmesi.
- Mevcut Rust yayıncılarının (`queue-alliances`, `queue-corporations`,
  `queue-characters`, `queue-types`) bastığı mesajların değişmesi. Önceliksiz
  kalırlar.
- ESI'ye `esi::EsiClient` dışından gitmek.

## Yaklaşımlar

**Runner'la ilişki:**

1. **Runner'ı genişletmek (seçilen).** `handle`'a bağlam eklenir, sonuç tipi
   genelleşir. Bağlantı, yeniden bağlanma, kapanma ve ortak hata yolu tek
   yerde kalır. Bedeli: dört bilgi worker'ının imzası mekanik olarak değişir.
   Sıradaki fan-out worker'ları (`character-corporation-history` gibi) aynı
   yolu kullanır.
2. **Runner'da ikinci bir worker türü.** Mevcut worker'lara dokunulmaz ama aynı
   işi yapan iki API oluşur.
3. **Runner'sız, kendi döngüsüyle.** #315'in "paylaşılan kod yalnızca
   kütüphane crate'lerinde" kuralına aykırı; elendi.

Kullanıcı 1'i seçti.

**Kuyruğun alliance listesi:**

1. **Node gibi veritabanından.** Davranış aynı kalır, sıra bağımlılığı da.
2. **ESI'nin `/alliances` listesinden (seçilen).** Bağımlılık kalkar, iki
   kuyruk script'i aynı anda çalışabilir. Bedeli tek bir ESI isteği.

Kullanıcı 2'yi seçti.

**Zinciri tek pakete toplamak** konuşuldu ve elendi (Hedef olmayanlar).
Kullanıcının asıl derdi elle sıra beklemekti; o, kuyruğun ESI'den okuması ve
tek bir `package.json` satırıyla çözülüyor.

## Tasarım

### runner

**Bağlam.** `handle` yeni bir parametre alır:

```rust
fn handle(&self, id: i32, ctx: &Context<'_>) -> impl Future<Output = anyhow::Result<Processed>> + Send;
```

- `Context` yayıncıya erişim verir. Yayıncı **o anki bağlantıya** aittir;
  yeniden bağlanınca runner yenisini kurar. Worker yayıncıyı saklamaz, her
  çağrıda bağlamdan alır.
- Yayıncı, tüketicinin kanalından ayrı, aynı bağlantı üzerinde açılmış ve
  confirm moduna alınmış bir kanaldır. Böylece yayın onayları tüketicinin
  teslimatlarıyla karışmaz.
- Bilgi worker'ları bağlamı kullanmaz (`_ctx`).
- Testlerde yayıncının yerine sahtesi konabilmeli: `process_one`'ın testleri
  bugün `Settle` için sahte kullanıyor, yayıncı için de aynısı.

**Sonuç.** `Processed` genelleşir. Ya bir alan ya bir enum ile, şu üç durum
ayırt edilir:

- `created` (bilgi worker'ı yeni satır ekledi)
- `updated` (bilgi worker'ı var olan satırı güncelledi)
- `queued(n)` (fan-out worker'ı n mesaj bastı; n = 0 olabilir)

`detail` aynen kalır.

**Başarı satırı.**

- Bilgi worker'ları: bugünkü `  ✅ [n]{detail} (created|updated)`, değişmez.
- Fan-out worker'ı: Node'un satırı,
  `  ✅ [n][allianceId] Name [TICK] - queued 12 corps`. Liste boşsa Node'daki
  gibi `  ⚠️  [n][allianceId] Name [TICK] - no corporations`.
- Satırın biçimini worker belirler; runner `n`'i verir.

**Son özet.** Kuyruk boşalınca:

- Bilgi worker'ları: bugünkü
  `📊 final: N processed (C created, U updated, E errors)`, değişmez.
- Fan-out worker'ı: Node'un satırı,
  `📊 final: N alliances processed, M corporations queued, E errors`.
- `Totals`'a basılan mesajlar için bir sayaç eklenir.

**Başlangıç log'u.** Fan-out worker'ı Node gibi çıkış kuyruğunu da yazar:
`📦 input queue: …`, `📦 output queue: …`. Bilgi worker'larının satırları
değişmez.

**Prefetch.** Runner'ın ortak kuralı:
`max(ESI_PREFETCH, ceil(ESI_MAX_RPS / 2))`, varsayılanlarla 25. Her mesaj tek
ESI isteği ve birkaç yayındır; DB'ye yalnızca ad için tek bir okuma yapılır.

### mq

- `EntityMessage::source` hem sabit hem çalışma anında üretilen metni taşır
  (`Cow<'static, str>` ya da `String`). JSON çıktısı değişmez:
  `{"entityId":…,"queuedAt":"…","source":"…"}`, alanlar bu sırada.
- Yayın için isteğe bağlı öncelik. `priority` verilmezse AMQP özelliğine hiç
  yazılmaz; bugünkü yayıncıların bastığı baytlar aynen kalır.
- Fan-out yayını, `publish_entities`'in batch'li döngüsünü kullanmak zorunda
  değil. Bir alliance'ın listesi genelde onlarla yüzler arasında; hepsi basılır,
  onaylar beklenir, bir `Nack` hata sayılır ve ortak hata yoluna gider.

### worker-alliance-corporations

Crate düzeni öbür worker'larla aynı: `src/lib.rs`, `src/main.rs`,
`tests/…`.

**`handle(id, ctx)`:**

1. `SELECT name, ticker FROM alliances WHERE id = $1`, yalnızca log için.
2. `GET /alliances/{id}/corporations` → `Vec<i32>`.
3. Liste boşsa: `Processed` `queued(0)`, "no corporations" satırı.
4. Değilse: her ID için `EntityMessage { entity_id: corp_id, source:
"alliance_{id}" }`, öncelik 3, `esi_corporation_info_queue`'ya. Onayların
   hepsi beklenir.
5. `Processed` `queued(n)`.

Herhangi bir adımdaki hata (ESI 404, 420/429, yayın nack'i) ortak hata yoluna
gider: 404 uyarıyla geçilir, throttle mesajı yeniden kuyruğa koyar, öbürleri
deneme sayacını harcar.

Hata durumunda bazı corporation mesajları zaten basılmış olabilir; alliance
yeniden denendiğinde onlar ikinci kez basılır. Bu kabul edilir:
`worker-info-corporations` upsert yapar, ikinci mesaj aynı satırı tazeler.

**Sabitler.** `QUEUE_NAME = "esi_alliance_corporations_queue"`,
`OUTPUT_QUEUE = "esi_corporation_info_queue"`,
`CONSUMER_TAG = "worker-alliance-corporations-rs"`,
`STARTED = "🤝 alliance corporation worker started"`,
`WAITING_FOR = "alliances"`, `ENTITY = "alliance"`, `OUTPUT_PRIORITY = 3`.

### queue-alliance-corporations

`queue-alliances`'ın kalıbı, farklı kuyruk ve kaynakla.

- `lib.rs`: `QUEUE_NAME`, `SOURCE = "esi_alliance_corporations_queue"`,
  `PRIORITY = 5`, `fetch_alliance_ids(&EsiClient)` (`esi.get("/alliances")`).
- `main.rs`: `runner::init()`, ardından
  - `fetching all alliance IDs from ESI...`, `found N alliances`
  - `adding alliances to queue...`, `connect`, `declare_worker_queue`
  - yayın, 100'lük batch'ler debug log'da
    (`batch i/total: n alliances queued`, Node'un metni)
  - `successfully queued N alliances!`
  - `next steps:`, `  1. start worker: yarn worker:alliance-corporations:rs`,
    `  2. start enrichment: yarn worker:info:corporations:rs`
- Hata olursa `failed to queue alliance corporations: …` ve çıkış 1.

**Node'dan fark:** Node veritabanındaki alliance'ları basıyor, Rust ESI'nin
bugünkü listesini. Kapanmış ama tabloda duran alliance'lar artık basılmaz;
onların listesi zaten boş döner. Tabloya henüz girmemiş yeni alliance'lar ise
aynı gün basılır.

## Doğrulama

- **runner:**
  - `process.rs` testleri yeni imzayla. Sahte yayıncıyla bir fan-out
    worker'ının `queued(n)` sonucunun sayıldığı, başarı satırının worker'ın
    biçiminde olduğu test.
  - Özet satırı: bilgi worker'ı için bugünkü metin, fan-out için Node'un metni.
  - Bilgi worker'larının çıktısının değişmediği.
- **mq:**
  - Sabit ve üretilen `source` ile JSON'un baytları.
  - Öncelik verilince AMQP özelliğinde olduğu, verilmeyince olmadığı.
- **worker-alliance-corporations:**
  - ESI yanıtının decode'u (`wiremock` ya da fixture).
  - Boş liste: hiç yayın yok, mesaj ack'leniyor.
  - Dolu liste: her ID için bir mesaj, doğru `source` ve öncelik, ack
    onaylardan sonra.
  - Nack: hata yoluna gidiyor.
  - Alliance adı okuması fixture'lı veritabanına karşı; satır yoksa
    `Unknown` / `???`.
- **queue-alliance-corporations:** `wiremock` ile `fetch_alliance_ids`.
- **Yerelde bir kez** (worker'lar açıkken):
  - `corporations` satır sayısı kaydedilir.
  - `yarn queue:alliance-chain:rs`. İki kuyruğa basılan alliance sayısı aynı
    ve ESI'nin `/alliances` sayısına eşit olmalı.
  - `worker:alliance-corporations:rs` kuyruğu boşaltır. Son özetteki
    "corporations queued", `esi_corporation_info_queue`'ya giren mesaj
    sayısıyla tutarlı olmalı. `errors` sıfır ya da yalnızca 404'ler.
  - `corporations` satır sayısı yalnızca artmış olmalı.
- `cargo test`, `cargo clippy`, `cargo fmt --check`, `.sqlx` güncel;
  `npx prettier --check backend/package.json`.

## Kararlarım (kullanıcı onayı değil, düzeltilebilir)

- **Öncelikler korunur:** worker'ın bastığı corporation mesajları 3, kuyruğun
  bastığı alliance mesajları 5. `esi_corporation_info_queue`'ya
  `scan:entities` 5 ile basıyor; Node bu worker'ı bilerek daha düşük
  tutmuş. Öncelik bir AMQP özelliği, mesaj gövdesi değil, ama kuyruktaki
  sırayı değiştiriyor.
- **Yayın onayları beklenir.** Node beklemiyor (`sendToQueue`, confirm yok).
  Rust'ta onay alınmadan ack yapılmaz, bu Node'dan daha güvenli.
- **Alliance adı için DB okuması kalır.** Yalnızca log için, Node'la aynı.
  Worker bu yüzden yine bir DB havuzu açar ama tabloya yazmaz.
- **Başarı satırı info seviyesinde.** Node bunu `debug` ile yazıyor; öbür Rust
  worker'larında başarı satırları info. Tutarlılık için info.
- **Yayın için ayrı kanal**, aynı bağlantı üzerinde.
- **Çıkış kuyruğu bağlanırken declare edilir.** Worker bağlandığında giriş
  kuyruğunun yanında `esi_corporation_info_queue` da `declare_worker_queue`
  ile (yani `x-max-priority: 10` ile) tanımlanır. Kuyruk yoksa broker,
  default exchange'e yapılan yayını sessizce düşürür ama yine `Ack` döner. Bu
  da "onaylanmadan ack yok" kuralını sessizce bozar.
- **Yayın kanalı kapanırsa bağlantı kopmuş sayılır** ve runner yeniden
  bağlanır. Aksi halde o anda işlenen her alliance tek tek hata alır, deneme
  sayacı harcanır ve sonunda park edilir.
- **Öncelik 0 olan yayıncılar** (`queue-corporations`, Node ve Rust) 3'ün
  altında kalır. Node'da da bugün böyle; değişen bir şey yok.
- **`source` değeri Node'la birebir**, kuyrukta `esi_alliance_corporations_queue`
  olsa da.
- **Zincir satırının adı** `queue:alliance-chain:rs`.
- **`/alliances` çağrısı iki kuyruk crate'inde tekrarlanır.** Tek satır;
  bir kuyruk crate'inin ötekine bağımlı olması daha kötü.
- **CLAUDE.md:** "Root scan" / "Enrichment" ayrımına Rust
  `queue-alliance-corporations`'ın root scan olduğu, Node sürümünün ise
  veritabanından okuduğu not edilir. ESI kuyrukları tablosuna dokunulmaz.
- **#315:** merge'den sonra iki satır işaretlenir.

## Kurucuya kalanlar

- `Context`, `Processed` ve yayıncı soyutlamasının tam adları ve şekli;
  sahte yayıncının nasıl kurulacağı.
- Özet satırını worker'ın mı runner'ın mı ürettiği (bir sabit, bir trait
  metodu ya da bir enum), yeter ki iki metin yukarıdaki gibi çıksın.
- `mq`'daki öncelikli yayının imzası; `publish_entities`'e bir seçenek mi,
  yeni bir fonksiyon mu.
- Test dosyalarının ve fixture'ların ayrıntısı, öbür crate'lerdeki düzene
  bakarak.
