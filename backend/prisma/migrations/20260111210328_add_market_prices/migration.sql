-- CreateTable
CREATE TABLE "market_prices" (
    "type_id" INTEGER NOT NULL,
    "buy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sell" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "average" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "volume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_prices_pkey" PRIMARY KEY ("type_id")
);

-- CreateIndex
CREATE INDEX "market_prices_updated_at_idx" ON "market_prices"("updated_at");

-- CreateIndex
CREATE INDEX "killmail_items_killmail_id_flag_idx" ON "killmail_items"("killmail_id", "flag");

-- AddForeignKey
ALTER TABLE "market_prices" ADD CONSTRAINT "market_prices_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
