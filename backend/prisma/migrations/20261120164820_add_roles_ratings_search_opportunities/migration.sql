-- CreateEnum
CREATE TYPE "OpportunityMode" AS ENUM ('ONLINE', 'IN_PERSON', 'HYBRID');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'EVENT_ROLE_CHANGED';

-- AlterTable
ALTER TABLE "event_applications" ADD COLUMN     "role_id" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "hide_rating" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "search_name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "show_in_search" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "specialties" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "specialties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_specialties" (
    "user_id" INTEGER NOT NULL,
    "specialty_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_specialties_pkey" PRIMARY KEY ("user_id","specialty_id")
);

-- CreateTable
CREATE TABLE "event_roles" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_application_role_choices" (
    "application_id" INTEGER NOT NULL,
    "role_id" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "event_application_role_choices_pkey" PRIMARY KEY ("application_id","role_id")
);

-- CreateTable
CREATE TABLE "event_impact_metrics" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "event_impact_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_ratings" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "application_id" INTEGER NOT NULL,
    "rater_id" INTEGER NOT NULL,
    "organizer_id" INTEGER NOT NULL,
    "stars" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_details" (
    "post_id" INTEGER NOT NULL,
    "deadline" TIMESTAMP(3),
    "apply_url" TEXT NOT NULL,
    "mode" "OpportunityMode" NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "eligibility" TEXT NOT NULL DEFAULT '',
    "min_age" INTEGER,
    "max_age" INTEGER,
    "education_level" "EducationLevel",
    "field" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "opportunity_details_pkey" PRIMARY KEY ("post_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "specialties_normalized_key" ON "specialties"("normalized");

-- CreateIndex
CREATE INDEX "user_specialties_specialty_id_idx" ON "user_specialties"("specialty_id");

-- CreateIndex
CREATE INDEX "event_roles_event_id_idx" ON "event_roles"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_roles_event_id_name_key" ON "event_roles"("event_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "event_application_role_choices_application_id_rank_key" ON "event_application_role_choices"("application_id", "rank");

-- CreateIndex
CREATE INDEX "event_impact_metrics_normalized_idx" ON "event_impact_metrics"("normalized");

-- CreateIndex
CREATE UNIQUE INDEX "event_impact_metrics_event_id_normalized_key" ON "event_impact_metrics"("event_id", "normalized");

-- CreateIndex
CREATE UNIQUE INDEX "event_ratings_application_id_key" ON "event_ratings"("application_id");

-- CreateIndex
CREATE INDEX "event_ratings_organizer_id_idx" ON "event_ratings"("organizer_id");

-- CreateIndex
CREATE INDEX "opportunity_details_deadline_idx" ON "opportunity_details"("deadline");

-- CreateIndex
CREATE INDEX "users_search_name_idx" ON "users"("search_name");

-- AddForeignKey
ALTER TABLE "user_specialties" ADD CONSTRAINT "user_specialties_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_specialties" ADD CONSTRAINT "user_specialties_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_applications" ADD CONSTRAINT "event_applications_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "event_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_roles" ADD CONSTRAINT "event_roles_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("post_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_application_role_choices" ADD CONSTRAINT "event_application_role_choices_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "event_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_application_role_choices" ADD CONSTRAINT "event_application_role_choices_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "event_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_impact_metrics" ADD CONSTRAINT "event_impact_metrics_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("post_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_ratings" ADD CONSTRAINT "event_ratings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("post_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_ratings" ADD CONSTRAINT "event_ratings_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "event_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_ratings" ADD CONSTRAINT "event_ratings_rater_id_fkey" FOREIGN KEY ("rater_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_ratings" ADD CONSTRAINT "event_ratings_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_details" ADD CONSTRAINT "opportunity_details_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Hand-written ─────────────────────────────────────────────────────────────

-- Value checks the schema cannot express.
ALTER TABLE "event_ratings" ADD CONSTRAINT "event_ratings_stars_range" CHECK ("stars" BETWEEN 1 AND 5);
ALTER TABLE "event_roles" ADD CONSTRAINT "event_roles_seats_positive" CHECK ("seats" > 0);
ALTER TABLE "event_application_role_choices" ADD CONSTRAINT "event_application_role_choices_rank_range" CHECK ("rank" BETWEEN 1 AND 3);
ALTER TABLE "event_impact_metrics" ADD CONSTRAINT "event_impact_metrics_value_non_negative" CHECK ("value" >= 0);

-- Backfill users.search_name with the same Arabic normalization as normalizeArabic()
-- (src/common/utils/arabic.ts): unify alef forms, taa marbuta -> haa, alef maqsura -> yaa,
-- strip tashkeel and tatweel, lower-case, collapse spaces.
UPDATE "users"
SET "search_name" = btrim(regexp_replace(lower(regexp_replace(
      translate("name", 'أإآٱةى', 'ااااهي'),
      '[ً-ٰٟـ]', '', 'g')), '\s+', ' ', 'g'));
