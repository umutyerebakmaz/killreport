# Killmail Enrichment System

## Overview

When a new killmail is added to the database, information about **characters**, **corporations**, **alliances**, and **items (types)** are automatically fetched from ESI and saved to the database.

## How It Works

### 1. Killmail is Saved

`worker-killmails.ts` saves a killmail to the database (killmail, victim, attackers, items).

### 2. Automatic Enrichment

Once the killmail is successfully saved, the `enrichment.ts` service kicks in:

```typescript
const enrichResult = await enrichKillmail(zkillPkg.killmail_id);
```

### 3. Unknown Data is Detected

The enrichment service:

- Collects all character, corporation, alliance, and type IDs from the killmail
- Checks which ones don't exist in the database
- Fetches missing ones from ESI and saves them

### 4. Data is Fetched from ESI

For each missing entity:

- `getCharacterInfo(id)` - Character information
- `getCorporationInfo(id)` - Corporation information
- `getAllianceInfo(id)` - Alliance information
- `getTypeInfo(id)` - Item/Ship/Weapon information

## Database Tables

### Types (New)

```prisma
model Type {
  id          Int     @id
  name        String
  description String?
  group_id    Int
  published   Boolean
  volume      Float?
  capacity    Float?
  mass        Float?
  icon_id     Int?
  // ...
}
```

Ships, weapons, and items are all stored in the `Type` table.

### Other Tables

- `characters` - Pilots
- `corporations` - Corporations
- `alliances` - Alliances

## Usage

### Automatic with Worker

```bash
cd backend
yarn run worker:killmails
```

When the worker runs, enrichment is performed automatically for each killmail:

```bash
cd backend
yarn run worker:killmails
```

### Manual Test

To test enrichment for a specific killmail:

```bash
cd backend
npx tsx test-enrichment.ts
```

## Benefits

✅ **Automatic**: Runs automatically when each killmail is saved
✅ **Lazy Loading**: Only unknown data is fetched
✅ **Error Tolerant**: Enrichment errors don't affect killmail saving
✅ **Rate Limiting**: Complies with ESI rate limits (10ms delay)
✅ **Performant**: Batch checks prevent unnecessary ESI calls

## Example Log Output

```
📥 Found 150 killmails
💾 Processing killmails...
     📊 Progress: 50/150 (Saved: 48, Skipped: 2, Errors: 0)
     🔍 Enriched: 12 chars, 5 corps, 2 alliances, 23 types
     📊 Progress: 100/150 (Saved: 96, Skipped: 4, Errors: 0)
✅ Saved: 146, Skipped: 4, Errors: 0
```

## ESI Endpoints Used

- `GET /characters/{character_id}/` - Public
- `GET /corporations/{corporation_id}/` - Public
- `GET /alliances/{alliance_id}/` - Public
- `GET /universe/types/{type_id}/` - Public

All endpoints are **public** and **don't require authentication**.

## Future Improvements (Optional)

1. **Bulk API usage**: ESI supports bulk queries for some endpoints
2. **Cache layer**: Cache frequently used types in Redis
3. **Queue system**: Move enrichment to a separate RabbitMQ queue
4. **Background job**: Periodically enrich old killmails

## Troubleshooting

**Q: Getting type errors**

```bash
cd backend
npx prisma generate
```

**Q: Migration errors**

```bash
cd backend
npx prisma migrate dev
```

**Q: Enrichment not working**

- Check worker logs
- Test ESI accessibility: `curl https://esi.evetech.net/latest/status/`
