-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'EVENT_CANCELLED';

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "auto_closed_at" TIMESTAMP(3);
