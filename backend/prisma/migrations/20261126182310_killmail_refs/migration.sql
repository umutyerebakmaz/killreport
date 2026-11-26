-- AlterTable
ALTER TABLE "users" ADD COLUMN     "corp_killmails_denied_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "killmail_refs" (
    "killmail_id" INTEGER NOT NULL,
    "killmail_hash" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "discovered_at" TIMESTAMP(3) NOT NULL,
    "queued_count" INTEGER NOT NULL DEFAULT 0,
    "last_queued_at" TIMESTAMP(3),

    CONSTRAINT "killmail_refs_pkey" PRIMARY KEY ("killmail_id")
);

-- CreateIndex
CREATE INDEX "killmail_refs_last_queued_at_idx" ON "killmail_refs"("last_queued_at");
