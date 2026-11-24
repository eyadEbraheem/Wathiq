-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'WEEKLY_HIGHLIGHT';

-- CreateTable
CREATE TABLE "weekly_highlights" (
    "id" SERIAL NOT NULL,
    "week_start" TIMESTAMP(3) NOT NULL,
    "organizer_id" INTEGER,
    "new_volunteers" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_highlights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "weekly_highlights_week_start_key" ON "weekly_highlights"("week_start");

-- CreateIndex
CREATE INDEX "weekly_highlights_organizer_id_idx" ON "weekly_highlights"("organizer_id");

-- AddForeignKey
ALTER TABLE "weekly_highlights" ADD CONSTRAINT "weekly_highlights_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
