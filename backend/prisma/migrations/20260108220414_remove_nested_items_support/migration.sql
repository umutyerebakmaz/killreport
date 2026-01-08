/*
  Warnings:

  - You are about to drop the column `parent_item_id` on the `killmail_items` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "killmail_items" DROP CONSTRAINT "killmail_items_parent_item_id_fkey";

-- DropIndex
DROP INDEX "killmail_items_parent_item_id_idx";

-- AlterTable
ALTER TABLE "killmail_items" DROP COLUMN "parent_item_id";
