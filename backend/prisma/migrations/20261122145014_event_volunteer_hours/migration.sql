-- Volunteer hours per event, set by the organizer from now on.
ALTER TABLE "events" ADD COLUMN "volunteer_hours" INTEGER;

-- Existing events: estimate from their times. Rounded-up hours between start and end, at most
-- 8 per started day; 2 hours when the event has no end time.
UPDATE "events"
SET "volunteer_hours" = CASE
  WHEN "ends_at" IS NULL OR "ends_at" <= "starts_at" THEN 2
  ELSE LEAST(
    CEIL(EXTRACT(EPOCH FROM ("ends_at" - "starts_at")) / 3600.0)::INTEGER,
    8 * CEIL(EXTRACT(EPOCH FROM ("ends_at" - "starts_at")) / 86400.0)::INTEGER
  )
END;

ALTER TABLE "events" ALTER COLUMN "volunteer_hours" SET NOT NULL;
