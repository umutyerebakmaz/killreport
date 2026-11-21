# CI'da Linux binary'leri — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Amaç:** CI her main merge'ünde bütün Rust binary'lerini statik musl
binary'si olarak derleyip artifact'e koysun. Guard spec Rust unit'lerini
tanısın. Dokümanda indirme, `scp` ve kurulum adımları yazsın.

**Mimari:** `ci.yml` dosyasına `Backend (Rust)` job'ına bağlı yeni bir job
eklenir. Bu job PR'da derler, kontrol eder ve paketler; yalnızca `main`
push'unda artifact yükler. Guard spec'teki envanter satırları `script` ya da
`crate` taşır. İndirme komutu kökteki `package.json`'a tek satırlık bir
script olarak girer.

**Teknoloji:** GitHub Actions, `x86_64-unknown-linux-musl`, `musl-tools`,
vitest, `gh` CLI.

**Spec:** `docs/superpowers/specs/2026-11-21-ci-linux-binaries-design.md`

## Global kısıtlar

- Hedef: `x86_64-unknown-linux-musl`. Toolchain `rust-toolchain.toml`'dan
  gelir (1.97.0). Hedef `rust-toolchain.toml`'a **eklenmez**.
- Workflow'un `permissions: contents: read` ayarı değişmez. Yeni secret
  eklenmez.
- Artifact adı `killreport-rs-linux-x86_64`. İçindeki dosya
  `killreport-rs-linux-x86_64.tar.gz`, açıldığında `bin/`, `SHA256SUMS` ve
  `COMMIT` çıkar. Saklama süresi `retention-days: 30`.
- Upload yalnızca
  `github.event_name == 'push' && github.ref == 'refs/heads/main'` olduğunda
  çalışır.
- Bu PR'da hiçbir `deploy/systemd/*` dosyası değişmez.
- Rust unit kalıbı:
  - `ExecStart=/var/www/killreport/backend-rs/bin/<crate>`
  - `KillSignal` ve `SuccessExitStatus` yok.
  - `NODE_ENV` ve `LOG_LEVEL` yok, `NO_COLOR=1` var.
  - `WorkingDirectory=/var/www/killreport/backend`.
- Push edilen her şey İngilizce. Claude imzası yok.

## İnceleme odağı

1. Çalışan bir worker'ın binary'sini değiştirmek: dokümandaki adım `install`
   kullanmalı. Doğrudan `scp` ile `bin/`'e yazmak `Text file busy` verir.
   Task 3 bunu dokümana ve uyarı olarak yazar.
2. Yeni bir crate eklenmesi: artifact'e kendiliğinden girmeli. Task 2'de
   binary listesi `cargo metadata`'dan okunur, ve sayısı
   `queues/*` + `workers/*` klasörlerinin sayısıyla karşılaştırılır.
3. Statik olmayan bir binary: Task 2'deki `file` kontrolü job'ı kırar.
4. Zip'te kaybolan `+x` izni: Task 2 tar ile paketler. Paketin açılıp
   binary'lerin çalıştırılabilir olduğu (`test -x`) aynı job'da kontrol
   edilir.
5. `crate` taşıyan bir unit'te yanlış yol, var olmayan bir crate ya da
   unutulmuş `KillSignal=SIGINT`: Task 1'in sahte unit testleri hepsini
   yakalar.

---

### Task 1: Guard spec Rust unit'lerini tanır

**Dosyalar:**

- Değişecek: `backend/src/ops/systemd-units.guard.spec.ts`

**Arayüzler:**

- Üretir:
  - `RUST_BIN = '/var/www/killreport/backend-rs/bin/'`
  - `rustUnitProblems(u: Unit, crate: string): string[]` boş liste dönerse
    unit doğrudur.
  - `Continuous` ve `Scheduled` tiplerinde `script: string` yerine
    `Exec = { script: string } | { crate: string }` gelir. Mevcut `worker()`
    ve `job()` helper'ları `{ script }` üretmeye devam eder.
  - `expectExec(u, e: Exec)` helper'ı.

- [ ] **Adım 1: Başarısız testleri yaz.** `describe('rust unit rules')`
      bloğu, sahte unit metinleri `parseUnit` ile okur.
  - Bir `good` metni tanımlanır: `[Service]` altında
    `ExecStart=/var/www/killreport/backend-rs/bin/worker-sovereignty-map`,
    `WorkingDirectory=/var/www/killreport/backend`,
    `Environment=NO_COLOR=1`.
  - Testler:
    - `accepts a binary path that names an existing crate` →
      `expect(rustUnitProblems(good, 'worker-sovereignty-map')).toEqual([])`
    - `rejects a path outside backend-rs/bin` →
      `ExecStart=/usr/local/bin/worker-sovereignty-map` için sonuç boş
      değil.
    - `rejects a crate that does not exist` → `'worker-nope'` ile
      (`ExecStart` buna göre yazılır) sonuç boş değil.
    - `rejects SIGINT and exit 130` → `good`'a `KillSignal=SIGINT`
      eklenince bir problem, `SuccessExitStatus=130` eklenince bir problem.
    - `rejects Node environment and colours` → `NODE_ENV=production`
      eklenince problem; `NO_COLOR=1` çıkarılınca problem.
- [ ] **Adım 2:** `yarn workspace backend vitest run
src/ops/systemd-units.guard.spec.ts` çalıştır.
      Beklenen: FAIL, `rustUnitProblems is not defined`.
- [ ] **Adım 3: `rustUnitProblems`'i yaz.** Crate'in var olup olmadığı
      `backend-rs/queues/<crate>/Cargo.toml` ya da
      `backend-rs/workers/<crate>/Cargo.toml` dosyasının varlığıyla kontrol
      edilir (`fs.existsSync`). Yol, `WorkingDirectory`, sinyal satırları ve
      env için birer problem metni üretilir.
- [ ] **Adım 4: envanter testlerini bağla.**
  - Envanter tiplerine `Exec` gelir ve `continuous`/`oneshot` testlerindeki
    sabit `` `/usr/bin/yarn ${c.script}` `` beklentisinin yerini
    `expectExec(u, c)` alır:
    - `script` için mevcut yarn beklentisi aynen kalır.
    - `crate` için beklenti `rustUnitProblems(u, crate)` sonucunun `[]`
      olmasıdır.
  - Tüm servis dosyalarını gezen yeni bir test eklenir:
    `'%s: a Rust ExecStart names an existing crate'`.
    - `ExecStart` `RUST_BIN` ile başlıyorsa crate adı yoldan alınır ve
      `rustUnitProblems` sonucu `[]` beklenir.
  - Envantere dokunulmaz; bütün satırlar hâlâ `script` taşır.
- [ ] **Adım 5:** aynı vitest komutu çalıştırılır, ardından
      `yarn workspace backend build`.
      Beklenen: hepsi PASS, tsc temiz.
- [ ] **Adım 6: Commit.**
      `test(ops): systemd guard recognises Rust units`

### Task 2: CI musl binary'lerini derler, paketler, yükler

**Dosyalar:**

- Değişecek: `.github/workflows/ci.yml` (sona yeni job)

**Arayüzler:**

- Üretir: `main` run'larında `killreport-rs-linux-x86_64` artifact'i.
  Task 3'teki indirme komutu bu adı kullanır.

- [ ] **Adım 1: job'ı ekle.** Ayarlar:
  - id `backend-rs-linux`, ad `Backend (Rust, Linux binaries)`.
  - `needs: backend-rs`, `runs-on: ubuntu-latest`, `timeout-minutes: 30`.
  - `working-directory: backend-rs`.
  - env: `SQLX_OFFLINE: 'true'`, `CARGO_TERM_COLOR: always`.

  Adımlar sırayla:
  1. checkout.
  2. `rustup toolchain install`.
  3. `rustup target add x86_64-unknown-linux-musl`.
  4. `sudo apt-get update && sudo apt-get install -y musl-tools`.
  5. `Swatinem/rust-cache@v2`, `workspaces: backend-rs`,
     `key: linux-musl`.
  6. `cargo build --release --locked --target x86_64-unknown-linux-musl --bins`.
  7. **Collect:** binary adları
     `cargo metadata --no-deps --format-version 1 | jq -r '.packages[].targets[] | select(.kind[] == "bin") | .name'`
     ile okunur ve `dist/bin/` klasörüne kopyalanır. Bu adım şunları
     kontrol eder:
     - Binary sayısı `ls -d queues/*/ workers/*/ | wc -l` sayısına eşit
       olmalı, değilse `exit 1`.
     - `file dist/bin/*` çıktısında `statically linked` ya da
       `static-pie linked` geçmeyen bir satır varsa `exit 1`.
  8. **Package:**
     - `(cd dist/bin && sha256sum * > ../SHA256SUMS)`
     - `echo "$GITHUB_SHA" > dist/COMMIT`
     - `tar czf killreport-rs-linux-x86_64.tar.gz -C dist bin SHA256SUMS COMMIT`
     - Paket hemen geçici bir klasörde açılır; `sha256sum -c` geçmeli ve
       her dosya için `test -x` doğru olmalı.
  9. **Upload**, yalnızca main push'unda (Global kısıtlardaki `if`):
     `actions/upload-artifact@v4`, `name: killreport-rs-linux-x86_64`,
     `path: backend-rs/killreport-rs-linux-x86_64.tar.gz`,
     `retention-days: 30`, `if-no-files-found: error`.

- [ ] **Adım 2:** `npx prettier --check .github/workflows/ci.yml`
      çalıştır. Beklenen: temiz.
- [ ] **Adım 3: Commit.**
      `ci: build static Linux binaries of backend-rs and keep them on main`

Bu job lokalde çalıştırılamaz. Doğrulaması PR'daki run'dır, bkz. Task 3'teki
son adım.

**Ruling (plan):** spec `strip` kararını builder'a bırakmıştı. Release
profiline `strip` **eklenmez**. Sembolleri olan binary sunucudaki bir panic
mesajını okunur tutar. Bedeli artifact'in birkaç MB büyük olması.

### Task 3: İndirme script'i ve doküman

**Dosyalar:**

- Değişecek: `package.json` (kök, `scripts`), `.gitignore` (kök: `/killreport-rs-linux-x86_64.tar.gz`; `gh run download` dosyayı repo köküne indiriyor)
- Değişecek: `backend/docs/ops/systemd.md` (_Moving a unit to Rust_ ve
  _Server setup (once)_)

**Arayüzler:**

- Tüketir: Task 2'nin artifact adı ve Task 1'in unit kalıbı.

- [ ] **Adım 1: script'i ekle.** Kökteki `package.json`'a:
      `"rs:download": "gh run download \"$(gh run list --workflow ci.yml --branch main --status success --event push -L 1 --json databaseId -q '.[0].databaseId')\" -n killreport-rs-linux-x86_64"`
- [ ] **Adım 2: script'in yarısını doğrula.** İç komut
      `gh run list --workflow ci.yml --branch main --status success --event push -L 1 --json databaseId -q '.[0].databaseId'`
      çalıştırılır. Beklenen: bir sayı. `gh run download` var olan bir dosyanın üzerine yazmıyor, bu yüzden doküman eski `.tar.gz` dosyasının önce silinmesini söyler.
      `yarn rs:download`'ın kendisi ancak merge'den sonra çalışır, çünkü
      artifact'li ilk run o zaman oluşur.
- [ ] **Adım 3: `systemd.md`'yi güncelle.**
  - _Moving a unit to Rust_ bölümünün ilk paragrafı CI artifact'iyle
    değiştirilir. Spec'teki dört adım buraya girer: `yarn rs:download`,
    `scp ... <sunucu>:/tmp/`, `tar` + `sha256sum -c` ve `sudo install`,
    son olarak `restart`.
  - Bir cümle `install` kullanılmasının sebebini (`Text file busy`), bir
    cümle de `COMMIT` dosyasının `bin/` klasörüne kopyalanmasını söyler.
  - Diff örneği Global kısıtlardaki kalıba göre güncellenir
    (`NODE_ENV`, `LOG_LEVEL` ve SIGINT satırları çıkar, `NO_COLOR=1`
    girer). Yanına envanterde `script` yerine `crate` yazılacağı not edilir.
  - _Server setup (once)_ listesine bir madde eklenir:
    `sudo mkdir -p /var/www/killreport/backend-rs/bin && sudo chown killreport: /var/www/killreport/backend-rs/bin`.
- [ ] **Adım 4:** şunlar çalıştırılır:
  - `npx prettier --check package.json backend/docs/ops/systemd.md`
  - `yarn docs:check-links`

  Beklenen: ikisi de temiz.

- [ ] **Adım 5: Commit.**
      `docs(ops): install Rust binaries from the CI artifact`
- [ ] **Adım 6: PR'da doğrula.** Branch push edilir ve PR açılır.
      `Backend (Rust, Linux binaries)` job'ı yeşil olmalı. Logda şunlar
      görülmeli:
  - binary sayısı 26,
  - `file` kontrolü geçti,
  - paket açılıp kontrol edildi,
  - upload adımı `skipped`.
- [ ] **Adım 7: merge'den sonra.**
  - main run'ı bittiğinde `yarn rs:download` lokalde çalışmalı,
    `.tar.gz` inmeli.
  - #315'e dokunulmaz, çünkü bu PR bir script port'u değil.
