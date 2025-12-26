-- AlterTable
ALTER TABLE "users" ADD COLUMN     "corporation_id" INTEGER,
ADD COLUMN     "last_corp_killmail_id" INTEGER,
ADD COLUMN     "last_corp_killmail_sync_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "users_corporation_id_idx" ON "users"("corporation_id");

-- CreateIndex
CREATE INDEX "users_last_corp_killmail_sync_at_idx" ON "users"("last_corp_killmail_sync_at");
