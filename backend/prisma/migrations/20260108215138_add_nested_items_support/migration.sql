-- AlterTable
ALTER TABLE "killmail_items" ADD COLUMN     "parent_item_id" BIGINT;

-- CreateIndex
CREATE INDEX "killmail_items_parent_item_id_idx" ON "killmail_items"("parent_item_id");

-- AddForeignKey
ALTER TABLE "killmail_items" ADD CONSTRAINT "killmail_items_parent_item_id_fkey" FOREIGN KEY ("parent_item_id") REFERENCES "killmail_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
