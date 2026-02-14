# Güvenlik Olayı Müdahale Kılavuzu

## Tespit Edilen Sorun

`.env.example` dosyasında commit `91507554fe14f043c2c53fb72dbf69fa72b74071` içinde gerçek credentials sızmış.

## ACİL YAPILMASI GEREKENLER

### 1. Sızan Credentials'ları Hemen Değiştirin

Aşağıdaki hassas bilgiler sızmış olabilir ve **DERHAL** yenilenmeleri gerekiyor:

#### a) EVE Online SSO Credentials

```bash
# https://developers.eveonline.com/ adresine gidin
# Mevcut uygulamanızı silin veya credentials'ları yenileyin
# Yeni EVE_CLIENT_ID ve EVE_CLIENT_SECRET oluşturun
```

#### b) Database Password

```bash
# DigitalOcean veya kullandığınız DB provider'da:
# - PostgreSQL kullanıcı şifresini değiştirin
# - Yeni DATABASE_URL'i güncelleyin
```

#### c) JWT Secret

```bash
# Yeni JWT secret oluşturun:
openssl rand -base64 32
# Bu değişiklik tüm mevcut oturumları geçersiz kılacaktır
```

#### d) Diğer API Keys

- RabbitMQ şifresi (varsayılan değilse)
- Redis şifresi (varsa)
- Herhangi bir üçüncü parti API anahtarı

### 2. Git Geçmişinden Hassas Verileri Temizleyin

**UYARI**: Bu işlem git geçmişini yeniden yazar ve zorunlu push gerektirir.

#### Seçenek A: BFG Repo-Cleaner (Önerilen)

```bash
# BFG'yi indirin
brew install bfg  # macOS
# veya https://rtyley.github.io/bfg-repo-cleaner/

# Repo'nun yeni bir klonunu oluşturun
cd /tmp
git clone --mirror https://github.com/umutyerebakmaz/killreport.git

# Hassas dosyayı tüm geçmişten silin
cd killreport.git
bfg --delete-files .env

# Değişiklikleri uygulayın
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Zorunlu push (UYARI: Collaborators'ları bilgilendirin)
git push --force
```

#### Seçenek B: git-filter-repo (Alternatif)

```bash
# git-filter-repo'yu kurun
pip3 install git-filter-repo

# Repo dizinine gidin
cd /root/killreport

# .env dosyasını geçmişten tamamen silin
git filter-repo --path backend/.env --invert-paths

# Zorunlu push
git push origin --force --all
git push origin --force --tags
```

#### Seçenek C: GitHub'ın Built-in Secret Scanning (En Kolay)

1. GitHub repo settings → Security → Secret scanning alerts
2. Tespit edilen secrets'ları inceleyin
3. Her biri için "Revoke" veya "Dismiss" seçeneklerini kullanın

### 3. GitHub'a Bildirin (Opsiyonel ama Önerilen)

Eğer repo public ise:

1. https://github.com/umutyerebakmaz/killreport/security/advisories/new
2. Güvenlik advisory oluşturun ve durumu açıklayın
3. GitHub otomatik olarak etkilenen kullanıcıları bilgilendirebilir

### 4. Collaborators'ları Bilgilendirin

```bash
# Tüm collaborators'lara şu mesajı gönderin:
```

**Önemli Güvenlik Güncellemesi**

Git geçmişinden hassas verileri temizledik. Lütfen şunları yapın:

1. Local repo'nuzu silin
2. Fresh clone yapın: `git clone https://github.com/umutyerebakmaz/killreport.git`
3. `.env` dosyanızı yeniden oluşturun (yeni credentials'larla)
4. Eski credentials'ları kullanmayın

### 5. .gitignore Doğrulaması

`.gitignore` dosyalarının .env'i içerdiğini doğrulayın:

```bash
# Backend
cat backend/.gitignore | grep "\.env"  # ✅ .env mevcut

# Frontend
cat frontend/.gitignore | grep "\.env"  # ✅ .env* mevcut
```

### 6. Gelecekte Önleme

#### a) Pre-commit Hook Kurun

```bash
# Root dizinde
npm install --save-dev @commitlint/cli husky
npx husky install

# Pre-commit hook oluşturun
cat > .husky/pre-commit << 'EOF'
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# .env dosyalarının commit edilmemesini kontrol et
if git diff --cached --name-only | grep -E "\.env$|\.env\.local$|\.env\.production$"; then
  echo "❌ .env dosyası commit edilmeye çalışılıyor!"
  echo "Lütfen .env dosyasını staging area'dan çıkarın:"
  echo "git reset HEAD .env"
  exit 1
fi
EOF

chmod +x .husky/pre-commit
```

#### b) GitHub Secret Scanning'i Etkinleştirin

1. Repo Settings → Code security and analysis
2. "Secret scanning" → Enable
3. "Push protection" → Enable (commits'leri engeller)

#### c) .env.example Şablonu Kullanın

Her zaman `.env.example` dosyasında sadece örnek değerler tutun:

```bash
# İyi ✅
EVE_CLIENT_ID=your_eve_client_id_here
DATABASE_URL=postgresql://username:password@localhost/db

# Kötü ❌
EVE_CLIENT_ID=abc123realid456
DATABASE_URL=postgresql://user:realpass@prod.db.com/db
```

## Kontrol Listesi

- [ ] Tüm sızan credentials'lar değiştirildi
- [ ] Database şifresi yenilendi
- [ ] EVE SSO credentials yenilendi
- [ ] JWT secret yenilendi
- [ ] Git geçmişinden .env temizlendi
- [ ] Force push yapıldı
- [ ] Collaborators bilgilendirildi
- [ ] Pre-commit hooks kuruldu
- [ ] GitHub secret scanning aktif
- [ ] Monitoring/logging gözden geçirildi (sızan credentials kullanım denemeleri için)

## Ek Güvenlik Tavsiyeleri

1. **Monitoring**: CloudWatch, Datadog veya benzeri ile anormal API kullanımını izleyin
2. **Rate Limiting**: API endpoint'lerinize rate limiting ekleyin
3. **Audit Logs**: Database ve authentication loglarını kontrol edin
4. **Rotation Policy**: Credentials'ları düzenli olarak (3-6 ayda) rotate edin
5. **Secrets Management**: Vault, AWS Secrets Manager veya GitHub Secrets kullanmayı düşünün

## Referanslar

- [GitHub: Removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
- [git-filter-repo](https://github.com/newren/git-filter-repo)
