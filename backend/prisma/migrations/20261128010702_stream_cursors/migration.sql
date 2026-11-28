-- CreateTable
CREATE TABLE "stream_cursors" (
    "stream" TEXT NOT NULL,
    "sequence" BIGINT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stream_cursors_pkey" PRIMARY KEY ("stream")
);
