/*
  Warnings:

  - You are about to alter the column `killmail_id` on the `Attacker` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - The primary key for the `Killmail` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Killmail` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Attacker" DROP CONSTRAINT "Attacker_killmail_id_fkey";

-- DropIndex
DROP INDEX "public"."Killmail_killmail_id_idx";

-- DropIndex
DROP INDEX "public"."Killmail_killmail_id_key";

-- AlterTable
ALTER TABLE "Attacker" ALTER COLUMN "killmail_id" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "Killmail" DROP CONSTRAINT "Killmail_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "Killmail_pkey" PRIMARY KEY ("killmail_id");

-- AddForeignKey
ALTER TABLE "Attacker" ADD CONSTRAINT "Attacker_killmail_id_fkey" FOREIGN KEY ("killmail_id") REFERENCES "Killmail"("killmail_id") ON DELETE CASCADE ON UPDATE CASCADE;
