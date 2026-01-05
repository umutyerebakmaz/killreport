# SSL Certificates / SSL Sertifikaları

## English

### CA Certificate (ca-certificate.crt)

#### What is it?

The CA (Certificate Authority) certificate is a digital certificate used to verify the identity of the database server and establish a secure SSL/TLS connection.

#### Where does it come from?

This certificate is provided by **DigitalOcean Managed PostgreSQL**. When you create a managed PostgreSQL database on DigitalOcean, they provide a CA certificate that must be used to establish secure connections to the database.

**How to obtain it:**

1. Go to your DigitalOcean Dashboard
2. Navigate to Databases → Your PostgreSQL Database
3. Click on "Connection Details" or "Overview"
4. Download the CA certificate file
5. Save it as `ca-certificate.crt` in the `backend/certs/` directory

#### What is it used for?

The CA certificate is used for:

1. **SSL/TLS Connection**: Establishes an encrypted connection between the application and the PostgreSQL database
2. **Server Authentication**: Verifies that you're connecting to the legitimate DigitalOcean database server (not a man-in-the-middle attacker)
3. **Data Security**: Ensures all data transmitted between the app and database is encrypted
4. **Compliance**: Required for production environments to meet security best practices

#### Technical Implementation

The certificate is used in the Prisma database configuration:

- `backend/src/services/prisma.ts` (API server - 5 connections max)
- `backend/src/services/prisma-worker.ts` (Workers - 2 connections max)

```typescript
const ca = fs.readFileSync("certs/ca-certificate.crt").toString();
const pool = new Pool({
  connectionString,
  ssl: {
    ca, // DigitalOcean's CA certificate
    rejectUnauthorized: true, // Verify certificate
  },
});
```

#### Security Notes

- ⚠️ Never commit this file to version control if it contains sensitive information
- ✅ Add `ca-certificate.crt` to `.gitignore`
- ✅ In development, the code falls back to `rejectUnauthorized: false` if no certificate is found
- ✅ In production, always use the certificate with `rejectUnauthorized: true`

---

## Türkçe

### CA Sertifikası (ca-certificate.crt)

#### Nedir?

CA (Certificate Authority - Sertifika Otoritesi) sertifikası, veritabanı sunucusunun kimliğini doğrulamak ve güvenli bir SSL/TLS bağlantısı kurmak için kullanılan dijital bir sertifikadır.

#### Nereden alınır?

Bu sertifika **DigitalOcean Managed PostgreSQL** tarafından sağlanmaktadır. DigitalOcean'da yönetilen bir PostgreSQL veritabanı oluşturduğunuzda, veritabanına güvenli bağlantı kurmak için kullanılması gereken bir CA sertifikası sunulur.

**Nasıl edinilir:**

1. DigitalOcean kontrol panelinize gidin
2. Databases → PostgreSQL Veritabanınız bölümüne gidin
3. "Connection Details" veya "Overview" sekmesine tıklayın
4. CA sertifika dosyasını indirin
5. `backend/certs/` dizinine `ca-certificate.crt` olarak kaydedin

#### Ne işe yarar?

CA sertifikası şunlar için kullanılır:

1. **SSL/TLS Bağlantısı**: Uygulama ile PostgreSQL veritabanı arasında şifrelenmiş bir bağlantı kurar
2. **Sunucu Kimlik Doğrulaması**: Meşru DigitalOcean veritabanı sunucusuna bağlandığınızı doğrular (ortadaki adam saldırılarına karşı koruma)
3. **Veri Güvenliği**: Uygulama ve veritabanı arasında iletilen tüm verilerin şifrelendiğinden emin olur
4. **Uyumluluk**: Üretim ortamlarında güvenlik en iyi uygulamalarını karşılamak için gereklidir

#### Teknik Uygulama

Sertifika, Prisma veritabanı yapılandırmasında kullanılır:

- `backend/src/services/prisma.ts` (API sunucusu - maksimum 5 bağlantı)
- `backend/src/services/prisma-worker.ts` (Worker'lar - maksimum 2 bağlantı)

```typescript
const ca = fs.readFileSync("certs/ca-certificate.crt").toString();
const pool = new Pool({
  connectionString,
  ssl: {
    ca, // DigitalOcean'ın CA sertifikası
    rejectUnauthorized: true, // Sertifikayı doğrula
  },
});
```

#### Güvenlik Notları

- ⚠️ Bu dosyayı hassas bilgiler içeriyorsa asla sürüm kontrolüne eklemeyin
- ✅ `.gitignore` dosyasına `ca-certificate.crt` ekleyin
- ✅ Geliştirme ortamında, sertifika bulunamazsa kod `rejectUnauthorized: false` ayarına geri döner
- ✅ Üretim ortamında, her zaman `rejectUnauthorized: true` ile sertifika kullanın

---

## File Location / Dosya Konumu

```
backend/
  certs/
    ca-certificate.crt  ← Place the certificate here / Sertifikayı buraya yerleştirin
    CERTIFICATES.MD     ← This file / Bu dosya
```
