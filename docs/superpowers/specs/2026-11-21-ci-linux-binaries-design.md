# CI'da Linux binary'leri — tasarım

**Tarih:** 2026-11-21
**İlgili:** #315 (Node→Rust port), `backend/docs/ops/systemd.md`
(_Moving a unit to Rust_)

## Amaç ve neden

systemd unit'leri hâlâ `/usr/bin/yarn <script>` ile Node çalıştırıyor. Rust
port'u ilerledikçe unit'ler tek tek Rust binary'sine geçecek. Sunucu
**Ubuntu, x86_64**. Rust toolchain'i sunucuda yok ve kurulmayacak.

Bugünkü dokümana (`systemd.md:187-204`) göre binary yerelde
`x86_64-unknown-linux-musl` için derlenip `scp` ile atılıyor. Ama geliştirme
makinesi Windows, bunun için WSL veya zig gerekiyor ve kullanıcı bunları
kurmak istemiyor. Bu iş derlemeyi GitHub Actions'a taşıyor. CI her main
merge'ünde bütün binary'leri derleyip artifact olarak saklayacak. Kullanıcı
artifact'i indirip `scp` ile sunucuya atacak (seçenek 1).

## Hedefler

- Her `main` push'unda CI, `backend-rs/queues/*` ve `backend-rs/workers/*`
  altındaki **bütün binary'leri** `x86_64-unknown-linux-musl` için release
  modunda derler ve tek bir artifact olarak yükler.
- Binary'ler statik linklenir. Ubuntu'nun hangi sürümü olursa olsun çalışır,
  sunucuda glibc, OpenSSL ya da Node gerekmez.
- Sunucuya kurulum birkaç komutla yapılır ve çalışan bir worker'ın binary'si
  güvenle değiştirilebilir.
- `systemd-units.guard.spec.ts` Rust `ExecStart` biçimini tanır. Böylece
  sonradan bir unit'i Rust'a geçirmek yalnızca o unit'in dosyasını ve
  envanterdeki satırını değiştirmekten ibaret olur.

## Hedef dışı

- **Hiçbir unit bu PR'da Rust'a geçmez.** Binary'ler ancak merge'den sonra
  oluşur ve sunucuya ancak ondan sonra gider. Aynı PR'da unit'i değiştirmek,
  sunucuda binary yokken unit'in onu çağırması demek olur. Her unit sonradan
  kendi küçük PR'ıyla geçer.
- CI sunucuya bağlanmaz: SSH anahtarı yok, otomatik deploy yok (seçenek 2
  reddedildi). Workflow'un `permissions: contents: read` ayarı aynen kalır.
- Sunucuda derleme yok (seçenek 3 reddedildi).
- GitHub Release, sürüm etiketi ya da sürüm numarası yok.
- ARM (aarch64) yok, sunucu x86_64.

## Yaklaşımlar

1. **CI artifact + `scp` (seçildi).** CI yalnızca derler ve saklar, deploy'u
   kullanıcı elle yapar. CI'ın yetkisi okuma olarak kalır ve unit'lerin hangi
   sırayla geçeceğine kullanıcı karar verir. Bedeli her deploy'un elle
   yapılması.
2. **CI SSH ile deploy eder.** Tamamen otomatik olur. Ama repoda sunucuya
   yazabilen bir secret durur ve her merge doğrudan production'a gider.
   Unit'ler tek tek geçerken bu fazla risk.
3. **Sunucuda derleme.** Sunucuya Rust ve derleme araçları kurmak gerekir.
   Küçük bir sunucuda release derlemesi uzun sürer ve RAM yetmeyebilir.

## Tasarım

### CI job'ı

`.github/workflows/ci.yml` dosyasına yeni bir job eklenir:
`Backend (Rust, Linux binaries)`.

- **Ne zaman çalışır:** hem PR'larda hem `main` push'unda. PR'da musl
  derlemesinin kırılmadığını gösterir. **Artifact yalnızca `main` push'unda
  yüklenir.** _(Benim kararım: musl'a özgü bir kırılma, örneğin bir C
  bağımlılığı, merge'den önce görülsün.)_
- **Kurulum:**
  - `rustup toolchain install`, sürüm `rust-toolchain.toml`'da sabit
    (1.97.0).
  - `rustup target add x86_64-unknown-linux-musl`. Bu yalnızca CI adımında
    yapılır, `rust-toolchain.toml`'a eklenmez; aksi halde Windows'taki yerel
    kurulum da gereksiz yere bu hedefi indirir.
  - `sudo apt-get install -y musl-tools`, çünkü `ring`'in C kodu `musl-gcc`
    istiyor.
- **Derleme:**
  - `SQLX_OFFLINE=true cargo build --release --target
x86_64-unknown-linux-musl` ile workspace'in bütün binary'leri derlenir.
  - Veritabanı veya Redis servisi gerekmez.
  - `Swatinem/rust-cache` kullanılır, ama mevcut job'dan ayrı bir `key` ile;
    hedef farklı olduğu için cache'ler birbirini ezmesin.
- **Kontrol:** her binary için `file` çıktısında `statically linked` (ya da
  `static-pie linked`) geçtiği doğrulanır. Geçmezse job başarısız olur.
- **Paket:**
  - Binary'ler `bin/` klasörüne toplanır.
  - Yanına iki dosya konur: `SHA256SUMS` (`sha256sum *`) ve `COMMIT` (commit
    SHA'sı).
  - Hepsi tek bir `killreport-rs-linux-x86_64.tar.gz` dosyasına
    paketlenir. tar şart: `actions/upload-artifact` dosyaları zip'liyor ve
    zip çalıştırma iznini (`+x`) kaybediyor.
- **Artifact:**
  - Adı `killreport-rs-linux-x86_64`, saklama süresi **30 gün**. _(Benim
    kararım: main sık merge ediliyor ve geri dönüş için bir ay yeterli.)_
- **Sıra:** job mevcut `Backend (Rust)` job'ına `needs:` ile bağlanır.
  Testi geçmeyen kodun binary'si yüklenmez. PR'da bu iki job'ın süresini
  toplar, ama Rust job'ı zaten en uzun job.
- **Concurrency:** dosyadaki `cancel-in-progress` ayarı kalır. Arka arkaya
  iki merge olursa ilkinin run'ı iptal edilir, artifact'i en son merge
  üretir. İstenen davranış bu.

Release profilinde `strip = true` yoksa eklenir (binary boyutu küçülür,
davranış değişmez). Bu karar builder'a bırakılır.

### İndirme ve sunucuya kurulum

Bütün adımlar `systemd.md`'deki _Moving a unit to Rust_ bölümünde yazılı olur
ve bölümün başındaki "yerelde derlenir" cümlesi bununla değiştirilir.

1. **İndir (yerelde).** `main`'deki son başarılı CI run'ının artifact'i
   indirilir:

   ```bash
   gh run download "$(gh run list --workflow ci.yml --branch main --status success -L 1 --json databaseId -q '.[0].databaseId')" -n killreport-rs-linux-x86_64
   ```

   Bu komut repo kökünde bir `package.json` script'i olur:
   `yarn rs:download`. Ayrı bir dosya açılmaz.

2. **Gönder:** `scp killreport-rs-linux-x86_64.tar.gz <sunucu>:/tmp/`.
3. **Kur (sunucuda):**

   ```bash
   cd /tmp && tar xzf killreport-rs-linux-x86_64.tar.gz && (cd bin && sha256sum -c ../SHA256SUMS)
   sudo install -o killreport -g killreport -m 0755 -t /var/www/killreport/backend-rs/bin/ bin/*
   ```

   `install` dosyayı yerinde üzerine yazmaz: yeni bir dosya oluşturup eskisinin
   yerine geçirir. Bu yüzden çalışan bir worker'ın binary'si değişirken
   `Text file busy` hatası alınmaz. Çalışan süreç eski binary'yle devam eder,
   yenisi bir sonraki restart'ta ya da timer tetiklendiğinde devreye girer.
   `scp` ile doğrudan `bin/`'e yazmak bu yüzden yasak.

4. Sürekli çalışan bir worker'ın yeni binary'ye geçmesi için
   `sudo systemctl restart <unit>` gerekir. Timer'lı job'lar bir sonraki
   çalışmalarında yenisini kendiliğinden alır.

`COMMIT` dosyası sunucuda `bin/` klasörüne kopyalanır. Sunucuda hangi
sürümün çalıştığı bu dosyadan okunur.

### Rust unit'inin biçimi

Bir unit Rust'a geçtiğinde değişenler (sonraki PR'lar için kalıp):

```diff
-Environment=NODE_ENV=production
-Environment=LOG_LEVEL=info
-ExecStart=/usr/bin/yarn worker:sov:map
-KillSignal=SIGINT
-SuccessExitStatus=130
+ExecStart=/var/www/killreport/backend-rs/bin/worker-sovereignty-map
```

- `WorkingDirectory=/var/www/killreport/backend` **değişmez**.
  `runner::init`, `.env` dosyasını çalışma klasöründen okuyor
  (`backend-rs/crates/runner/src/run.rs:38-39`).
- Job'ın kendi ortam değişkenleri, örneğin `USE_REDIS_PUBSUB=true`, aynen
  kalır.
- `NODE_ENV` ve `LOG_LEVEL` Rust'ta okunmuyor. Log seviyesi `RUST_LOG`'dan
  okunuyor, o yoksa `info`. Bu yüzden ikisi de kaldırılır.
- Journal'a ANSI renk kodları düşmemeli. `tracing-subscriber` `NO_COLOR`
  değişkenine uyuyorsa unit'e `Environment=NO_COLOR=1` eklenir; uymuyorsa
  `init` terminal olup olmadığına bakar. Hangisi olacağı builder'ın kararı,
  ama sonuçta journal'da escape kodu olmamalı.
- Timer'lar ve unit adları değişmez.
- Geri dönmek için diff geri alınır: unit kopyalanır, `daemon-reload`, sonra
  `restart`.

### Guard spec

`backend/src/ops/systemd-units.guard.spec.ts` dosyasındaki envanter
satırlarında bir unit ya `script` (yarn) ya `crate` (Rust) taşır, ikisi
birden değil. `crate` taşıyan bir unit için şunlar doğrulanır:

- `ExecStart` tam olarak `/var/www/killreport/backend-rs/bin/<crate>`.
- `<crate>` gerçekten var: `backend-rs/queues/<crate>/Cargo.toml` ya da
  `backend-rs/workers/<crate>/Cargo.toml`.
- `KillSignal` ve `SuccessExitStatus` yok. Rust, systemd'nin varsayılan
  SIGTERM'ünü kullanıyor (`runner/src/shutdown.rs`).
- `WorkingDirectory`, ortam değişkenleri, bağımlılıklar ve timer kuralları
  yarn unit'leriyle aynı.

Bu PR'da her envanter satırı hâlâ `script` taşır, yani `crate` dalı henüz hiç
kullanılmaz. Bu dalın gerçekten çalıştığını kanıtlamak için testin kendi
içinde, envanterde olmayan sahte bir unit metni kullanılır: geçerli bir Rust
unit'i geçmeli; yanlış yol, var olmayan crate ya da `KillSignal=SIGINT`
taşıyan bir unit hata vermeli.

## Kenar durumlar

- **Yeni crate eklenmesi:** derleme workspace'in tamamını kapsadığı için yeni
  crate'ler artifact'e kendiliğinden girer.
- **musl'da çalışmayan bir bağımlılık** (OpenSSL, `native-tls`): PR'daki
  derleme kırılır, merge'den önce görülür. `Cargo.toml:11` zaten rustls dışı
  TLS'i yasaklıyor.
- **Dinamik linklenmiş bir binary:** `file` kontrolü job'ı kırar.
- **Artifact'in süresi dolmuş:** `gh run download` hata verir. O zaman yeni
  bir main run'ı gerekir; CI'ı yeniden çalıştırmak yeter.
- **Sunucuda `bin/` klasörü yok:** `install -D` kullanılmaz. Kurulum
  adımları klasörü bir kez `sudo mkdir -p` ve `chown` ile oluşturur. Bu,
  `systemd.md`'deki _Server setup (once)_ listesine eklenir.

## Builder'a kalanlar

- Job'ın adımlarının tam YAML'ı, cache key'inin adı.
- Release profiline `strip` eklenip eklenmeyeceği.
- Journal'da renk kodlarının nasıl kapatılacağı: `NO_COLOR` mı, tty
  kontrolü mü.
- `yarn rs:download` komutunun tam hali.
