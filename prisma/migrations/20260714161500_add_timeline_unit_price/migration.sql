ALTER TABLE "ProjectEstimatedTimelineItem"
ADD COLUMN "unitPriceVnd" DECIMAL(18,2) NOT NULL DEFAULT 3600000;

UPDATE "ProjectEstimatedTimelineItem"
SET "amountVnd" = ROUND(("durationDays" * "unitPriceVnd")::numeric, 2)
WHERE "durationDays" IS NOT NULL;
