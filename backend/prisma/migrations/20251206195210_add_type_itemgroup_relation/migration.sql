-- AddForeignKey
ALTER TABLE "types" ADD CONSTRAINT "types_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "item_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
