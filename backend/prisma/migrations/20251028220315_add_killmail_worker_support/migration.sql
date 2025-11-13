/*
  Warnings:

  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[killmail_id]` on the table `Killmail` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[character_id]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `killmail_hash` to the `Killmail` table without a default value. This is not possible if the table is not empty.
  - Added the required column `killmail_id` to the `Killmail` table without a default value. This is not possible if the table is not empty.
  - Added the required column `access_token` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `character_id` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `character_name` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `character_owner_hash` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `expires_at` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
CREATE SEQUENCE killmail_id_seq;
ALTER TABLE "Killmail" ADD COLUMN     "killmail_hash" TEXT NOT NULL,
ADD COLUMN     "killmail_id" INTEGER NOT NULL,
ALTER COLUMN "id" SET DEFAULT nextval('killmail_id_seq');
ALTER SEQUENCE killmail_id_seq OWNED BY "Killmail"."id";

-- AlterTable
CREATE SEQUENCE user_id_seq;
ALTER TABLE "User" DROP COLUMN "name",
ADD COLUMN     "access_token" TEXT NOT NULL,
ADD COLUMN     "character_id" INTEGER NOT NULL,
ADD COLUMN     "character_name" TEXT NOT NULL,
ADD COLUMN     "character_owner_hash" TEXT NOT NULL,
ADD COLUMN     "expires_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "refresh_token" TEXT,
ALTER COLUMN "id" SET DEFAULT nextval('user_id_seq');
ALTER SEQUENCE user_id_seq OWNED BY "User"."id";

-- CreateIndex
CREATE INDEX "Attacker_character_id_idx" ON "Attacker"("character_id");

-- CreateIndex
CREATE UNIQUE INDEX "Killmail_killmail_id_key" ON "Killmail"("killmail_id");

-- CreateIndex
CREATE INDEX "Killmail_killmail_id_idx" ON "Killmail"("killmail_id");

-- CreateIndex
CREATE INDEX "Killmail_victim_character_id_idx" ON "Killmail"("victim_character_id");

-- CreateIndex
CREATE INDEX "Killmail_victim_corporation_id_idx" ON "Killmail"("victim_corporation_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_character_id_key" ON "User"("character_id");

-- CreateIndex
CREATE INDEX "User_character_id_idx" ON "User"("character_id");

-- CreateIndex
CREATE INDEX "User_expires_at_idx" ON "User"("expires_at");

-- AddForeignKey
ALTER TABLE "Attacker" ADD CONSTRAINT "Attacker_killmail_id_fkey" FOREIGN KEY ("killmail_id") REFERENCES "Killmail"("id") ON DELETE CASCADE ON UPDATE CASCADE;
