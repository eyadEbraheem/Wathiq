-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "pushed_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "notifications_pushed_at_created_at_idx" ON "notifications"("pushed_at", "created_at");
