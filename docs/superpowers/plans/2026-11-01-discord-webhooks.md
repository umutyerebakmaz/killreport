# Discord Webhook Bildirimleri — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Amaç:** Giriş yapmış bir kullanıcının bir karakter, corporation veya
alliance'a Discord webhook bağlayabilmesi. Bağlandıktan sonra o entity'nin
her yeni kill ve loss'u kanala bir embed olarak düşer.

**Mimari:** `saveKillmail` yeni bir killmail yayınladığında
`discord_webhook_queue`'ya `{ killmailId }` yazar. `worker-discord-webhook`
eşleşen webhook'ları bulur, yaş kurallarını uygular, URL bazında tekilleştirir
ve Discord'a POST eder. Webhook'ların yönetimi GraphQL üzerinden, servis
fonksiyonlarıyla yapılır. Frontend'de profil başlığındaki bir buton ve dialog
bu işi görür.

**Teknolojiler:** Prisma (yeni `discord_webhooks` tablosu), RabbitMQ,
`fetch` (Node), Redis 6.0, GraphQL Yoga + codegen, Next.js App Router,
Headless UI React, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-01-discord-webhooks-design.md`.
Executor'lar bu planla birlikte spec'i de okur.

## Global Kısıtlar

- Webhook URL'si hiçbir GraphQL yanıtına, log'a, hata mesajına, kuyruk
  mesajına ya da Redis anahtarına **girmez**.
- `prisma migrate dev` yok. Migration diff-and-deploy yöntemiyle yazılır
  (CLAUDE.md _Database migrations_). Beş unmanaged tablonun satır sayısı önce
  ve sonra kontrol edilir.
- Generated dosyalar elle değiştirilmez. Codegen sırası: önce backend, sonra
  frontend.
- Worker'lar `@services/prisma-worker`, resolver'lar ve servisler
  `@services/prisma` kullanır.
- Yeni kuyruk yalnızca `ALL_QUEUES` (`backend/src/services/queue-names.ts`)
  üzerinden bildirilir; `assertQueue` yazılmaz.
- Yaş kuralları: `killmail_time >= active_since` **ve**
  `killmail_time >= now - 60 dakika`.
- Redis 6.0: `GETDEL` yok; `SET key 1 EX 86400 NX` kullanılır.
- `DiscordDeliveryError` mesajında HTTP durum kodu bulunmaz.
- Kullanıcı başına 10 webhook.
- Commit'ler İngilizce. `type(scope):` sonrası küçük harf. Claude attribution
  yok.
- Yalnızca Yarn kullanılır, npm yok. `.env` düzenlenmez.
- Arayüz metinleri İngilizce.

## Review Focus

1. **Aynı killmail'in yeniden teslimi.** Worker yarıda kalıp mesaj requeue
   edildiğinde, başarıyla gönderilmiş URL'ye ikinci mesaj gitmemeli →
   Görev 4, `skips urls already marked sent`.
2. **Bir URL'nin kalıcı hatası diğerlerini durdurmamalı.** Bir URL 404,
   diğeri 204 dönerse 204'lü gönderilmiş sayılmalı ve 404'lü devre dışı
   kalmalı; hata fırlatılmamalı → Görev 4, `disables 404 url and still
delivers the rest`.
3. **Rate limit'i sürekli aşan bir webhook sonsuz döngüye girmemeli.** 60 sn
   bekleme bütçesi bitince "geçici hata" olmalı ve fırlatılan hata
   `handleWorkerError`'ın 429 dalına düşmemeli → Görev 3,
   `gives up after 60s of retry_after`. Görev 4, `delivery error message
carries no status code`.
4. **Kurban bilgisi eksik killmail.** Kurbanın `character_id`'si yoksa
   (yapı, NPC), corp ve alliance hâlâ eşleşmeli; embed `Unknown` göstermeli
   → Görev 2, `loss matches by corporation when victim has no character`.
   Görev 2, `embed falls back to Unknown`.
5. **Yeniden bağlanan, önceden kopmuş webhook.** `setDiscordWebhook` aynı
   entity için yeniden çağrıldığında `disabled_at` temizlenmeli ve
   `active_since` yenilenmeli → Görev 6, `re-setting clears disabled_at and
resets active_since`.

---

## Dosya Yapısı

```text
backend/prisma/schema/discordWebhook.prisma                 (yeni) model
backend/prisma/schema/user.prisma                           (değişir) relation
backend/prisma/migrations/<ts>_discord_webhooks/migration.sql (yeni)
backend/src/services/discord-webhook/
  discord-webhook.helpers.ts     saf fonksiyonlar: URL, yaş, eşleştirme, embed
  discord-webhook.helpers.spec.ts
  discord-client.ts              Discord HTTP: POST, GET, 429
  discord-client.spec.ts
  discord-webhook-message.ts     kuyruk adı + mesaj tipi
  discord-delivery.ts            worker'ın işi: yükle, eşleştir, gönder
  discord-delivery.spec.ts
  discord-webhook.service.ts     GraphQL tarafı: list/set/remove
  discord-webhook.service.spec.ts
backend/src/services/killmail-writer.ts                     (değişir) publish
backend/src/services/queue-names.ts                         (değişir)
backend/src/services/tracker/tracker.service.ts             (değişir) entityExists export
backend/src/workers/worker-discord-webhook.ts               (yeni)
backend/src/schemas/DiscordWebhook.graphql                  (yeni)
backend/src/resolvers/discord-webhook/{queries,mutations,index}.ts, discord-webhook.spec.ts
backend/src/resolvers/index.ts                              (değişir)
backend/package.json, ecosystem.config.js                   (değişir)
backend/docs/workers/discord-webhook.md                     (yeni)
backend/docs/ops/pm2.md, CLAUDE.md (kuyruk tablosu)         (değişir)
frontend/src/graphql/DiscordWebhook.graphql                 (yeni)
frontend/src/hooks/useDiscordWebhooks.ts (+ .spec.ts)       (yeni)
frontend/src/components/DiscordWebhook/DiscordWebhookButton.tsx (yeni)
frontend/src/components/DiscordWebhook/DiscordWebhookDialog.tsx (yeni)
frontend/src/app/{characters,corporations,alliances}/[id]/page.tsx (değişir)
```

---

### Görev 1: `DiscordWebhook` modeli ve migration

`database` agent'ına verilir.

**Dosyalar:**

- Oluştur: `backend/prisma/schema/discordWebhook.prisma`
- Değiştir: `backend/prisma/schema/user.prisma` (`discord_webhooks DiscordWebhook[]`)
- Oluştur: `backend/prisma/migrations/<YYYYMMDDHHMMSS>_discord_webhooks/migration.sql`

**Arayüzler:**

- Üretir: Prisma modeli `DiscordWebhook` (`prisma.discordWebhook`). Alanlar:
  `id Int @id @default(autoincrement())`, `user_id Int`,
  `entity_type TrackedEntityType`, `entity_id Int`, `url String`,
  `name String?`, `disabled_at DateTime?`,
  `active_since DateTime @default(now())`,
  `created_at DateTime @default(now())`. Relation `user` →
  `users.id`, `onDelete: Cascade`.
  `@@unique([user_id, entity_type, entity_id])`,
  `@@index([entity_type, entity_id])`, `@@index([url])`,
  `@@map("discord_webhooks")`.

- [ ] **Adım 1:** Beş unmanaged tablonun satır sayısını kaydet:
      `killmail_filters`, `character_kill_stats`, `corporation_kill_stats`,
      `alliance_kill_stats`, `refresh_log`.
- [ ] **Adım 2:** Model dosyasını yaz ve `User`'a relation ekle.
- [ ] **Adım 3:** `npx prisma migrate diff --from-config-datasource prisma.config.ts --to-schema prisma/schema --script > /tmp/diff.sql`.
      Beş tablonun `DROP`'larını sil, kalanı migration olarak kaydet.
      `grep -n "^[^-]*DROP" prisma/migrations/*_discord_webhooks/migration.sql`
      boş çıkmalı.
- [ ] **Adım 4:** `npx prisma migrate deploy && npx prisma generate`.
      Beklenen: `1 migration applied`.
- [ ] **Adım 5:** Satır sayılarını yeniden kontrol et. Hiçbiri azalmamış
      olmalı. `psql "$DB" -c '\d discord_webhooks'` üç index'i ve unique'i
      göstermeli.
- [ ] **Adım 6: Commit**
      `feat(discord): add discord_webhooks table`

---

### Görev 2: Saf yardımcılar

**Dosyalar:**

- Oluştur: `backend/src/services/discord-webhook/discord-webhook.helpers.ts`
- Test: `backend/src/services/discord-webhook/discord-webhook.helpers.spec.ts`

**Arayüzler:**

- Üretir:

```ts
export const MAX_KILLMAIL_AGE_MS = 60 * 60 * 1000;
export const WEBHOOK_LIMIT = 10;

export function normalizeWebhookUrl(raw: string): string | null;
export function webhookUrlHash(url: string): string; // sha256 hex, ilk 16 karakter

export function isEligible(
  killmailTime: Date,
  activeSince: Date,
  now: Date,
): boolean;

export type EntityRef = {
  type: 'CHARACTER' | 'CORPORATION' | 'ALLIANCE';
  id: number;
};
export type Party = {
  characterId: number | null;
  corporationId: number | null;
  allianceId: number | null;
};
export type KillmailParties = { victim: Party; attackers: Party[] };
export type WebhookRow = {
  id: number;
  url: string;
  entityType: EntityRef['type'];
  entityId: number;
  activeSince: Date;
};
export type Delivery = {
  url: string;
  webhookIds: number[];
  kind: 'kill' | 'loss';
  entities: EntityRef[];
};

export function planDeliveries(
  parties: KillmailParties,
  rows: WebhookRow[],
  killmailTime: Date,
  now: Date,
): Delivery[];

export type EmbedInput = {
  kind: 'kill' | 'loss';
  killmailId: number;
  killmailTime: Date;
  frontendUrl: string;
  shipTypeId: number;
  shipName: string | null;
  victimName: string | null;
  victimCorpName: string | null;
  victimAllianceName: string | null;
  finalBlowName: string | null;
  finalBlowShipName: string | null;
  totalValue: number | null;
  attackerCount: number;
  systemName: string | null;
  securityStatus: number | null;
  regionName: string | null;
  footerEntityNames: string[];
};
export type DiscordPayload = { embeds: [Record<string, unknown>] };
export function buildKillmailEmbed(input: EmbedInput): DiscordPayload;
```

`normalizeWebhookUrl`: `https:` olmalı, host `discord.com` ya da
`discordapp.com`, yol `/api/webhooks/{sayı}/{token}`. Çıktıda host
`discord.com`, sorgu dizesi ve sondaki `/` yok. Bunlardan biri tutmazsa
`null`.

`planDeliveries`: önce `isEligible` ile satırları süzer. Bir satırın
entity'si kurbanın char, corp ya da alliance'ıysa **loss**, değilse
saldırganlardan birininkiyse **kill**, ikisi de değilse eşleşmez. Sonuçlar
`url`'ye göre gruplanır; grupta tek bir loss bile varsa grubun türü loss olur.
`entities` tekilleştirilir.

Renkler: kill `0x2ecc71`, loss `0xe74c3c`. Başlık
`{shipName} — {victimName}`. Link
`{frontendUrl}/killmails/{killmailId}`. Thumbnail
`https://images.evetech.net/types/{shipTypeId}/render?size=128`. Footer
`KillReport · {footerEntityNames.join(', ')}`. `timestamp` ISO. Eksik
adlar `Unknown`. Alan değerleri en fazla 1024 karakter.

- [ ] **Adım 1: Başarısız testleri yaz**

```ts
describe('normalizeWebhookUrl', () => {
  it('canonicalises discordapp.com, strips query and trailing slash', () => {
    expect(
      normalizeWebhookUrl(
        'https://discordapp.com/api/webhooks/123/abc-DEF_9/?wait=true',
      ),
    ).toBe('https://discord.com/api/webhooks/123/abc-DEF_9');
  });
  it('rejects non-discord hosts, http and malformed paths', () => {
    expect(normalizeWebhookUrl('https://evil.com/api/webhooks/1/a')).toBeNull();
    expect(
      normalizeWebhookUrl('http://discord.com/api/webhooks/1/a'),
    ).toBeNull();
    expect(
      normalizeWebhookUrl('https://discord.com/api/webhooks/x/a'),
    ).toBeNull();
    expect(normalizeWebhookUrl('not a url')).toBeNull();
  });
});

describe('webhookUrlHash', () => {
  it('is 16 hex chars, stable, and does not contain the token', () => {
    const h = webhookUrlHash('https://discord.com/api/webhooks/1/secret');
    expect(h).toMatch(/^[0-9a-f]{16}$/);
    expect(h).toBe(webhookUrlHash('https://discord.com/api/webhooks/1/secret'));
  });
});

describe('isEligible', () => {
  const now = new Date('2026-11-01T12:00:00Z');
  it('rejects killmails before active_since', () => {
    expect(
      isEligible(
        new Date('2026-11-01T11:50:00Z'),
        new Date('2026-11-01T11:55:00Z'),
        now,
      ),
    ).toBe(false);
  });
  it('rejects killmails older than 60 minutes even if after active_since', () => {
    expect(
      isEligible(
        new Date('2026-11-01T10:59:59Z'),
        new Date('2026-08-01T00:00:00Z'),
        now,
      ),
    ).toBe(false);
  });
  it('accepts exactly 60 minutes old and after active_since', () => {
    expect(
      isEligible(
        new Date('2026-11-01T11:00:00Z'),
        new Date('2026-08-01T00:00:00Z'),
        now,
      ),
    ).toBe(true);
  });
});

describe('planDeliveries', () => {
  // victim corp 10, attacker corp 20; rows built with activeSince far in the past
  it('marks victim-side match as loss and attacker-side as kill');
  it('intra-corp kill (corp on both sides) is a loss');
  it(
    'one url bound to two matching entities yields one delivery with both entities and loss priority',
  );
  it('loss matches by corporation when victim has no character');
  it('drops rows that fail isEligible');
  it('returns [] when nothing matches');
});

describe('buildKillmailEmbed', () => {
  it(
    'uses red for loss, green for kill, links to the killmail page and sets the ship thumbnail',
  );
  it('embed falls back to Unknown for missing names');
  it('footer lists every entity name');
});
```

Her `it` için iddialar yukarıdaki açıklamadaki değerlerle yazılır
(renk sayıları, URL'ler, `kind`, `webhookIds`).

- [ ] **Adım 2:** `yarn workspace backend vitest run src/services/discord-webhook/discord-webhook.helpers.spec.ts`
      Beklenen: FAIL (modül yok).
- [ ] **Adım 3:** Fonksiyonları yaz. Hash için `node:crypto` `createHash('sha256')`.
- [ ] **Adım 4:** Aynı komut. Beklenen: PASS.
- [ ] **Adım 5: Commit** — `feat(discord): add webhook url, eligibility and embed helpers`

---

### Görev 3: Discord HTTP istemcisi

**Dosyalar:**

- Oluştur: `backend/src/services/discord-webhook/discord-client.ts`
- Test: `backend/src/services/discord-webhook/discord-client.spec.ts`

**Arayüzler:**

- Tüketir: `DiscordPayload` (Görev 2).
- Üretir:

```ts
export type PostOutcome = 'ok' | 'disable' | 'drop' | 'transient';
export const RATE_LIMIT_BUDGET_MS = 60_000;
export const DISCORD_TIMEOUT_MS = 10_000;

export async function postWebhook(
  url: string,
  payload: DiscordPayload,
  deps?: { fetch?: typeof fetch; sleep?: (ms: number) => Promise<void> },
): Promise<{ outcome: PostOutcome; status: number | null; body?: string }>;

export async function getWebhookName(
  url: string,
  deps?: { fetch?: typeof fetch },
): Promise<{ found: true; name: string | null } | { found: false }>;
```

Durumların eşlemesi: 200/204 → `ok`. 401/403/404 → `disable`. 400 ve
kalan 4xx → `drop` (yanıt gövdesinin ilk 500 karakteri `body`'ye).
429 → JSON gövdesindeki `retry_after` (saniye) kadar `sleep`, sonra tekrar.
Toplam bekleme `RATE_LIMIT_BUDGET_MS`'yi aşacaksa `transient` döner.
5xx, ağ hatası ve timeout (`AbortSignal.timeout(DISCORD_TIMEOUT_MS)`) →
`transient`. POST adresi `${url}?wait=false`. Bu modül hiçbir şey log'lamaz
ve fırlatmaz; URL'yi dönüş değerine koymaz.

`getWebhookName`: `GET url`. 200 → `{ found: true, name: body.name ?? null }`.
401/404 → `{ found: false }`. Diğer durumlar hata fırlatır; mesajda URL
bulunmaz.

- [ ] **Adım 1: Başarısız testleri yaz** (sahte `fetch` ve `sleep` ile)

```ts
it('maps 204 to ok, 404/401/403 to disable, 400 to drop, 502 to transient');
it('retries 429 after retry_after seconds and returns ok on the next 204', async () => {
  // fetch: 429 {retry_after: 1.5} → 204 ; sleep çağrısı 1500 ile
});
it('gives up after 60s of retry_after', async () => {
  // fetch her seferinde 429 {retry_after: 40}; ikinci bekleme bütçeyi aşar
  // → outcome 'transient', sleep tam bir kez çağrılmış
});
it('treats a thrown fetch (network/timeout) as transient');
it('posts to url?wait=false with JSON content-type');
it('getWebhookName returns the name on 200 and found:false on 404');
```

- [ ] **Adım 2:** `yarn workspace backend vitest run src/services/discord-webhook/discord-client.spec.ts` → FAIL.
- [ ] **Adım 3:** Yaz.
- [ ] **Adım 4:** Aynı komut → PASS.
- [ ] **Adım 5: Commit** — `feat(discord): add discord webhook http client`

---

### Görev 4: Teslimat servisi

**Dosyalar:**

- Oluştur: `backend/src/services/discord-webhook/discord-webhook-message.ts`
- Oluştur: `backend/src/services/discord-webhook/discord-delivery.ts`
- Test: `backend/src/services/discord-webhook/discord-delivery.spec.ts`

**Arayüzler:**

- Tüketir: Görev 2'nin tamamı, `postWebhook` (Görev 3), `prismaWorker`,
  `redis` (`@services/redis`), `config.frontendUrl`, `logger`.
- Üretir:

```ts
// discord-webhook-message.ts
export const DISCORD_WEBHOOK_QUEUE = 'discord_webhook_queue';
export interface DiscordWebhookMessage {
  killmailId: number;
}

// discord-delivery.ts
export class DiscordDeliveryError extends Error {} // name = 'DiscordDeliveryError'
export async function deliverKillmail(
  killmailId: number,
  now?: Date,
): Promise<void>;
```

`deliverKillmail` sırası:

1. Killmail'i `killmail_time`, `total_value`, `attacker_count` ve
   `solar_system_id` alanlarıyla oku. Yoksa uyarı log'u ve dönüş.
2. `now - killmail_time > MAX_KILLMAIL_AGE_MS` ise başka sorgu yapmadan dön.
3. Kurbanı ve saldırganları oku. Bunlardan `KillmailParties` kur.
4. Taraflardaki bütün char/corp/alliance ID'leri için `disabled_at: null`
   olan webhook satırlarını **tek** `findMany` ile oku.
5. `planDeliveries`. Sonuç boşsa dön.
6. Ad çözümleme: gemi tipleri, karakterler, corp'lar, alliance'lar ve sistem
   (+ constellation → region) adlarını tablo başına bir `findMany` ile oku.
   Map'le eşle; eksik olan `null` kalır. ESI çağrısı yok.
7. Her `Delivery` için:
   - `discord:sent:{killmailId}:{webhookUrlHash(url)}` anahtarı varsa atla.
   - `postWebhook`.
   - `ok` → `SET key 1 EX 86400 NX`.
   - `disable` → `updateMany({ where: { url }, data: { disabled_at: now } })`,
     ardından `logger.warn` (webhook id'leri ve status ile).
   - `drop` → `logger.error` (killmail id, webhook id'leri, status, body).
   - `transient` → sayacı artır, `logger.warn`.
8. Sayaç > 0 ise
   `throw new DiscordDeliveryError(`discord delivery incomplete for killmail ${killmailId}: ${n} webhook(s) pending`)`.

- [ ] **Adım 1: Başarısız testleri yaz.** `prismaWorker`, `redis`,
      `discord-client` ve `@config/config` mock'lanır. Specs that load the
      limiter must mock config; bu dosya limiter'ı yüklemez ama config'i
      mock'lar.

```ts
it(
  'returns without querying webhooks when the killmail is older than 60 minutes',
);
it('delivers one POST per url and marks it sent with EX 86400 NX', () => {
  // redis.set çağrısı: ('discord:sent:123:<16hex>', '1', 'EX', 86400, 'NX')
});
it('skips urls already marked sent');
it('disables 404 url and still delivers the rest', () => {
  // url A → disable, url B → ok; updateMany where.url === A; hata yok
});
it('drop outcome logs and does not throw or disable');
it(
  'throws DiscordDeliveryError when any url is transient, after trying all urls',
);
it('delivery error message carries no status code', () => {
  // error.message ilk satırı /\b(404|420|429)\b/ ile eşleşmemeli; url içermemeli
});
it('never logs the webhook url', () => {
  // logger mock'unun bütün çağrı argümanlarında token string'i geçmemeli
});
```

- [ ] **Adım 2:** `yarn workspace backend vitest run src/services/discord-webhook/discord-delivery.spec.ts` → FAIL.
- [ ] **Adım 3:** Yaz.
- [ ] **Adım 4:** Aynı komut → PASS.
- [ ] **Adım 5: Commit** — `feat(discord): deliver killmails to matching webhooks`

---

### Görev 5: Kuyruk, writer bağlantısı, worker

**Dosyalar:**

- Değiştir: `backend/src/services/queue-names.ts` (`ALL_QUEUES`'a
  "Notification workers" başlığıyla `'discord_webhook_queue'`)
- Değiştir: `backend/src/services/killmail-writer.ts:138-140`
- Değiştir: `backend/src/services/killmail-writer.spec.ts`
- Oluştur: `backend/src/workers/worker-discord-webhook.ts`
- Değiştir: `backend/package.json` (`"worker:discord-webhook": "tsx src/workers/worker-discord-webhook.ts"`)
- Değiştir: `ecosystem.config.js` (`worker-killmail-detail` bloğunu örnek al,
  `cron_restart` yok)
- Oluştur: `backend/docs/workers/discord-webhook.md`
- Değiştir: `backend/docs/ops/pm2.md` (worker tablosu), `CLAUDE.md` (kuyruk
  tablosuna `discord_webhook_queue` | `worker:discord-webhook`)

**Arayüzler:**

- Tüketir: `DISCORD_WEBHOOK_QUEUE`, `DiscordWebhookMessage`, `deliverKillmail`
  (Görev 4); `publishToQueue`, `ensureAllQueuesExist`, `getRabbitMQChannel`
  (`@services/rabbitmq`); `handleWorkerError`.
- Üretir: `discordWebhookWorker(): Promise<void>`. `PREFETCH_COUNT = 5`.

Writer'da, `if (options.publish ?? true)` bloğunun içinde
`NEW_KILLMAIL`'den sonra
`await publishToQueue(DISCORD_WEBHOOK_QUEUE, JSON.stringify({ killmailId: detail.killmail_id }))`
çağrılır. `publishToQueue` hatayı zaten yutuyor; writer'a try/catch
eklenmez.

Worker, `worker-killmail-detail.ts:52-96`'nın yapısını birebir izler:
parse → `deliverKillmail` → ack; hata → `handleWorkerError`.

- [ ] **Adım 1: Başarısız testleri yaz** (`killmail-writer.spec.ts`)

```ts
it('publishes to discord_webhook_queue when publish is true');
it('does not publish to discord_webhook_queue when publish is false');
it(
  'does not publish to discord_webhook_queue for an already-stored killmail (P2002)',
);
```

- [ ] **Adım 2:** `yarn workspace backend vitest run src/services/killmail-writer.spec.ts` → FAIL.
- [ ] **Adım 3:** Writer değişikliği, `ALL_QUEUES`, worker, script, ecosystem.
- [ ] **Adım 4:** Aynı komut → PASS. Ardından
      `yarn workspace backend vitest run src/services/queue-names` (varsa
      kuyruk listesi spec'i) → PASS.
- [ ] **Adım 5:** Doküman: `discord-webhook.md` akışı, iki yaş kuralını,
      durum eşlemesini ve "URL'yi log'lama" kuralını anlatır. Linkler
      göreli olmalı. CLAUDE.md'deki grep komutu ile kontrol et.
- [ ] **Adım 6:** `npx prettier --check` ile değişen dosyaları kontrol et.
- [ ] **Adım 7: Commit** — `feat(discord): add discord webhook queue and worker`

---

### Görev 6: Yönetim servisi ve GraphQL

**Dosyalar:**

- Değiştir: `backend/src/services/tracker/tracker.service.ts` (`entityExists`'i export et)
- Oluştur: `backend/src/services/discord-webhook/discord-webhook.service.ts`
- Test: `backend/src/services/discord-webhook/discord-webhook.service.spec.ts`
- Oluştur: `backend/src/schemas/DiscordWebhook.graphql` (spec'teki şema, aynen)
- Oluştur: `backend/src/resolvers/discord-webhook/{queries,mutations,index}.ts`
- Test: `backend/src/resolvers/discord-webhook/discord-webhook.spec.ts`
- Değiştir: `backend/src/resolvers/index.ts`

**Arayüzler:**

- Tüketir: `normalizeWebhookUrl`, `WEBHOOK_LIMIT` (Görev 2);
  `getWebhookName`, `postWebhook` (Görev 3); `entityExists`.
- Üretir:

```ts
export class DiscordWebhookError extends Error {
  constructor(public code: 'USER_NOT_FOUND' | 'INVALID_URL' | 'NOT_FOUND' | 'WEBHOOK_NOT_FOUND' | 'LIMIT' | 'TEST_FAILED', message: string);
}
export type DiscordWebhookView = { entityType: TrackedEntityType; entityId: number; name: string | null; disabled: boolean; createdAt: string };

export async function listWebhooks(characterId: number): Promise<DiscordWebhookView[]>;
export async function setWebhook(characterId: number, type: TrackedEntityType, id: number, rawUrl: string): Promise<DiscordWebhookView>;
export async function removeWebhook(characterId: number, type: TrackedEntityType, id: number): Promise<void>;
```

`setWebhook` sırası spec'teki gibidir: normalize → entity var mı → limit
(yeni satırsa; mevcut satırı güncellemek limite takılmaz) → `getWebhookName`
→ test mesajı (`postWebhook`; `ok` değilse `TEST_FAILED`) → upsert
(`disabled_at: null`, `active_since: new Date()`, `name`). Test mesajı:
`KillReport will post {entity name} kills and losses to this channel.`
`DiscordWebhookView`'ün tanımında `url` yoktur.

Resolver'lar `tracker/mutations.ts`'teki `requireCharacterId` ve
`toGraphQLError` kalıbını izler (`BAD_USER_INPUT`, `reason: code`).

- [ ] **Adım 1: Başarısız testleri yaz**

```ts
it('rejects a non-discord url with INVALID_URL before any network call');
it('rejects an unknown entity with NOT_FOUND');
it(
  'rejects the 11th webhook with LIMIT but allows updating an existing one at 10',
);
it('returns WEBHOOK_NOT_FOUND when discord answers 404');
it('returns TEST_FAILED when the test post is not ok and writes nothing');
it('stores the normalized url and the discord name');
it('re-setting clears disabled_at and resets active_since');
it('view objects never contain the url'); // Object.keys ve JSON.stringify ile
// resolver spec:
it('myDiscordWebhooks / setDiscordWebhook / removeDiscordWebhook require auth');
it('maps DiscordWebhookError to BAD_USER_INPUT with reason');
```

- [ ] **Adım 2:** `yarn workspace backend vitest run src/services/discord-webhook src/resolvers/discord-webhook` → FAIL.
- [ ] **Adım 3:** Şemayı yaz, `yarn workspace backend codegen`. Çıktıda hata
      olmamalı.
- [ ] **Adım 4:** Servisi ve resolver'ları yaz, `index.ts`'e bağla.
- [ ] **Adım 5:** Aynı test komutu → PASS. Ardından
      `yarn workspace backend build` → hata yok.
- [ ] **Adım 6: Commit** — `feat(discord): add discord webhook graphql api`

---

### Görev 7: Frontend — buton ve dialog

**Dosyalar:**

- Oluştur: `frontend/src/graphql/DiscordWebhook.graphql`
  (`MyDiscordWebhooks`, `SetDiscordWebhook`, `RemoveDiscordWebhook`)
- Oluştur: `frontend/src/hooks/useDiscordWebhooks.ts` + `.spec.ts`
- Oluştur: `frontend/src/components/DiscordWebhook/DiscordWebhookButton.tsx`
- Oluştur: `frontend/src/components/DiscordWebhook/DiscordWebhookDialog.tsx`
- Değiştir: `frontend/src/app/characters/[id]/page.tsx:290`,
  `corporations/[id]/page.tsx:380`, `alliances/[id]/page.tsx:363` (her biri
  `TrackButton`'ın yanına `<DiscordWebhookButton type=… id=… />`)

**Arayüzler:**

- Tüketir: Görev 6'nın şeması (frontend codegen'den gelen hook'lar).
- Üretir:

```ts
export function useDiscordWebhooks(): {
  signedIn: boolean;
  loading: boolean;
  statusOf(
    type: TrackedEntityType,
    id: number,
  ): 'none' | 'connected' | 'broken';
  webhookOf(
    type: TrackedEntityType,
    id: number,
  ): { name: string | null; disabled: boolean } | null;
  set(type: TrackedEntityType, id: number, url: string): Promise<void>;
  remove(type: TrackedEntityType, id: number): Promise<void>;
  pending: boolean;
  error: string | null;
};
```

`useTracker.ts`'in kalıbını izler: giriş kontrolü `useAuth`'tan, mutation'dan
sonra `MyDiscordWebhooks` refetch edilir. Hata metni GraphQL `reason`'a göre
İngilizce bir cümleye çevrilir; reason başına bir cümle:

| reason              | metin                                                 |
| ------------------- | ----------------------------------------------------- |
| `INVALID_URL`       | `That is not a Discord webhook URL.`                  |
| `WEBHOOK_NOT_FOUND` | `Discord does not know this webhook. Was it deleted?` |
| `TEST_FAILED`       | `Discord rejected the test message.`                  |
| `LIMIT`             | `You can connect up to 10 webhooks.`                  |
| diğer               | `Something went wrong. Try again.`                    |

Buton: giriş yoksa ya da yükleniyorsa `null`. **`self` veya `automatic`
durumunda gizlenmez.** Etiketler `DISCORD`, `DISCORD · CONNECTED`,
`DISCORD · BROKEN`. Sınıflar `button-sm`. Rozet stili grey'dir, renk kodu
yok. Dialog `TrackDialog`'daki Headless UI `Dialog`/`DialogPanel`/`DialogTitle`
yapısını izler. Bağlı değilken URL alanı, `CONNECT` ve şu cümle gösterilir:
`In Discord: channel settings → Integrations → Webhooks → New Webhook → Copy Webhook URL.`
Bağlıyken ad, durum, yeni URL alanı (`REPLACE`) ve `REMOVE` gösterilir.
Kaydedilmiş URL hiçbir zaman gösterilmez.

- [ ] **Adım 1:** `.graphql` dokümanını yaz, `yarn workspace backend codegen && yarn workspace frontend codegen`.
- [ ] **Adım 2: Başarısız hook testlerini yaz**

```ts
it('statusOf returns none / connected / broken from the query result');
it('set calls the mutation then refetches');
it('maps reason codes to the copy table');
it('signedIn false yields no query');
```

- [ ] **Adım 3:** `yarn workspace frontend vitest run src/hooks/useDiscordWebhooks.spec.ts` → FAIL.
- [ ] **Adım 4:** Hook, buton, dialog ve üç sayfa.
- [ ] **Adım 5:** Aynı komut → PASS. `yarn workspace frontend lint` sayısı
      `main`'den fazla olmamalı ve değişen dosya adı çıktıda geçmemeli.
      Eklenen satırlarda `any` olmamalı. Dev sunucusu çalışıyorsa
      `yarn workspace frontend build:check`, çalışmıyorsa `build` → başarılı.
- [ ] **Adım 6:** `npx prettier --check` değişen dosyalar.
- [ ] **Adım 7: Commit** — `feat(discord): add discord webhook button and dialog`

---

### Görev 8: Tam doğrulama ve uçtan uca kontrol

- [ ] **Adım 1:** `qa` agent'ına arka planda tam seti verin: `yarn test`,
      backend `build`, iki codegen, frontend `lint` (sayı `main` ile
      karşılaştırılır) ve `build:check`, `prettier --check .`.
- [ ] **Adım 2:** Veri kontrolü (tarayıcı yok). Backend'i ve
      `worker:discord-webhook`'u çalıştır. Kullanıcı bir test webhook URL'si
      verir. `setDiscordWebhook` mutation'ı GraphQL ile çağrılır ve test
      mesajı kanala düşmeli. `myDiscordWebhooks` yanıtında `url` alanı
      olmamalı. Ardından `fetch-single-killmail` ile yaşı 60 dakikadan küçük
      bir killmail kaydedilir. Bu kontrol ancak RedisQ'dan taze bir ID
      bulunursa yapılabilir; yoksa "not verified yet" denir. Kanalda embed
      görünmeli.
- [ ] **Adım 3:** Kullanıcıya bakması gerekenler söylenir: profil
      sayfalarındaki buton, dialog ve Discord'daki embed görünümü.
