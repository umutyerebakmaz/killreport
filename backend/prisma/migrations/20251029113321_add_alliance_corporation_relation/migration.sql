-- CreateIndex
CREATE INDEX "corporations_alliance_id_idx" ON "corporations"("alliance_id");

-- AddForeignKey
ALTER TABLE "corporations" ADD CONSTRAINT "corporations_alliance_id_fkey" FOREIGN KEY ("alliance_id") REFERENCES "alliances"("id") ON DELETE SET NULL ON UPDATE CASCADE;
