-- CreateTable
CREATE TABLE "corporation_snapshots" (
    "id" BIGSERIAL NOT NULL,
    "corporation_id" INTEGER NOT NULL,
    "member_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot_date" DATE NOT NULL,

    CONSTRAINT "corporation_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "corporation_snapshots_snapshot_date_idx" ON "corporation_snapshots"("snapshot_date");

-- CreateIndex
CREATE INDEX "corporation_snapshots_corporation_id_idx" ON "corporation_snapshots"("corporation_id");

-- CreateIndex
CREATE INDEX "corporation_snapshots_created_at_idx" ON "corporation_snapshots"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "corporation_snapshots_corporation_id_snapshot_date_key" ON "corporation_snapshots"("corporation_id", "snapshot_date");

-- AddForeignKey
ALTER TABLE "corporation_snapshots" ADD CONSTRAINT "corporation_snapshots_corporation_id_fkey" FOREIGN KEY ("corporation_id") REFERENCES "corporations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
