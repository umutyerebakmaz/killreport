-- CreateTable
CREATE TABLE "bloodlines" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "race_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bloodlines_pkey" PRIMARY KEY ("id")
);
