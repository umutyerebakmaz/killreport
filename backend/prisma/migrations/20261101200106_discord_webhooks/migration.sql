-- CreateTable
CREATE TABLE "discord_webhooks" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "entity_type" "TrackedEntityType" NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "disabled_at" TIMESTAMP(3),
    "active_since" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discord_webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "discord_webhooks_entity_type_entity_id_idx" ON "discord_webhooks"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "discord_webhooks_url_idx" ON "discord_webhooks"("url");

-- CreateIndex
CREATE UNIQUE INDEX "discord_webhooks_user_id_entity_type_entity_id_key" ON "discord_webhooks"("user_id", "entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "discord_webhooks" ADD CONSTRAINT "discord_webhooks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

