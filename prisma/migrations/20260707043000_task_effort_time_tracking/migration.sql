-- CreateEnum
CREATE TYPE "TestEstimateSource" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "TaskWorkType" AS ENUM ('DEV', 'TEST', 'BA', 'PM', 'REVIEW', 'OTHER');

-- CreateEnum
CREATE TYPE "CommentMentionStatus" AS ENUM ('PENDING', 'SEEN', 'RESOLVED');

-- AlterTable
ALTER TABLE "Task"
ADD COLUMN "devEstimateHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "testEstimateHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "testEstimateSource" "TestEstimateSource" NOT NULL DEFAULT 'AUTO',
ADD COLUMN "standardEstimateMandays" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "actualDevHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "actualTestHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "plannedStartAt" TIMESTAMP(3),
ADD COLUMN "devDueAt" TIMESTAMP(3),
ADD COLUMN "testDueAt" TIMESTAMP(3),
ADD COLUMN "estimateWarningFlag" TEXT,
ADD COLUMN "isDevOverdue" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isTestOverdue" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isBlocked" BOOLEAN NOT NULL DEFAULT false;

-- Backfill new effort fields from the existing lightweight task fields.
UPDATE "Task"
SET
  "devEstimateHours" = COALESCE("estimateHours", 0),
  "actualDevHours" = COALESCE("actualHours", 0),
  "plannedStartAt" = "startDate",
  "devDueAt" = "dueDate";

UPDATE "Task"
SET "testEstimateHours" = ROUND(("devEstimateHours" * 0.3) * 2) / 2
WHERE "testEstimateSource" = 'AUTO';

UPDATE "Task"
SET "estimateWarningFlag" =
  CASE
    WHEN "testEstimateHours" > "devEstimateHours" AND "devEstimateHours" > 0 THEN 'TEST_GREATER_THAN_DEV'
    WHEN "standardEstimateMandays" > 0 AND "devEstimateHours" > ("standardEstimateMandays" * 8 * 1.2) THEN 'DEV_OVER_STANDARD'
    ELSE NULL
  END;

UPDATE "Task"
SET
  "isDevOverdue" = ("devDueAt" IS NOT NULL AND "devDueAt" < CURRENT_TIMESTAMP AND "status" NOT IN ('READY_FOR_QA', 'TESTING', 'READY_FOR_UAT', 'DONE', 'CANCELLED')),
  "isTestOverdue" = ("testDueAt" IS NOT NULL AND "testDueAt" < CURRENT_TIMESTAMP AND "status" NOT IN ('DONE', 'CANCELLED')),
  "isBlocked" = ("status" = 'BLOCKED');

-- AlterTable
ALTER TABLE "TimeLog" ADD COLUMN "workType" "TaskWorkType" NOT NULL DEFAULT 'DEV';

-- AlterTable
ALTER TABLE "CommentMention"
ADD COLUMN "status" "CommentMentionStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "resolvedAt" TIMESTAMP(3),
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "projectId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Task_effort_warning_idx" ON "Task"("projectId", "estimateWarningFlag");

-- CreateIndex
CREATE INDEX "Task_overdue_idx" ON "Task"("projectId", "isDevOverdue", "isTestOverdue");

-- CreateIndex
CREATE INDEX "Task_blocked_idx" ON "Task"("projectId", "isBlocked");

-- CreateIndex
CREATE INDEX "CommentMention_userId_status_idx" ON "CommentMention"("userId", "status");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_entityType_entityId_idx" ON "Notification"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
