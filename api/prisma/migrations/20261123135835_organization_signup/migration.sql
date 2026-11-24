-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'ORGANIZATION_PAPER';

-- AlterTable
ALTER TABLE "pending_signups" ADD COLUMN     "organization" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "pending_organization" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "verification_documents" ADD COLUMN     "slot" INTEGER;
