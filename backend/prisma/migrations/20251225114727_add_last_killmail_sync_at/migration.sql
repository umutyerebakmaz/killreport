-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_killmail_id" INTEGER,
ADD COLUMN     "last_killmail_sync_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "users_last_killmail_sync_at_idx" ON "users"("last_killmail_sync_at");
