-- Sovereignty Phase 3: tag killmails with active sov campaigns + per-campaign combat stats.

-- AlterTable
ALTER TABLE "killmails" ADD COLUMN     "is_war_related" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "related_campaign_id" INTEGER;






-- CreateTable
CREATE TABLE "campaign_combat_stats" (
    "campaign_id" INTEGER NOT NULL,
    "war_kills" INTEGER NOT NULL DEFAULT 0,
    "isk_destroyed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ships_destroyed" INTEGER NOT NULL DEFAULT 0,
    "last_correlated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_combat_stats_pkey" PRIMARY KEY ("campaign_id")
);

-- CreateIndex
CREATE INDEX "campaign_combat_stats_isk_destroyed_idx" ON "campaign_combat_stats"("isk_destroyed");

-- CreateIndex
CREATE INDEX "killmails_related_campaign_id_idx" ON "killmails"("related_campaign_id");

-- CreateIndex
CREATE INDEX "killmails_is_war_related_idx" ON "killmails"("is_war_related");

-- AddForeignKey
ALTER TABLE "campaign_combat_stats" ADD CONSTRAINT "campaign_combat_stats_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "sovereignty_campaigns"("campaign_id") ON DELETE CASCADE ON UPDATE CASCADE;
