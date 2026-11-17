# Creating a migration

Loaded when working under `backend/prisma/`. Why this procedure exists, and
the two non-negotiables it serves (never `prisma migrate dev`, never lose
rows), are in the root `CLAUDE.md` under _Database migrations_.

```bash
cd backend

# 1. Record row counts first, so you can prove nothing was lost.
DB=$(grep -m1 '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
psql "$DB" -c "SELECT COUNT(*) FROM killmail_filters;"   # ...and the other four

# 2. Generate the DDL.
npx prisma migrate diff --from-config-datasource prisma.config.ts \
  --to-schema prisma/schema --script > /tmp/diff.sql

# 3. Delete every DROP TABLE for those five tables from the output.
grep -n "^DROP" /tmp/diff.sql

# 4. Save the rest as a migration, matching the existing hand-written ones.
mkdir -p prisma/migrations/$(date -u +%Y%m%d%H%M%S)_<name>
# ...write migration.sql, then confirm no executable DROP survived:
grep -n "^[^-]*DROP" prisma/migrations/*_<name>/migration.sql   # must be empty

# 5. Apply. migrate deploy applies pending migrations and never drops anything.
npx prisma migrate deploy
npx prisma generate

# 6. Re-check the row counts from step 1. None may have gone down.
```

Adding those five tables to `prisma/schema/` would remove the hazard for good.
Worthwhile, but its own piece of work — do not fold it into an unrelated change.
