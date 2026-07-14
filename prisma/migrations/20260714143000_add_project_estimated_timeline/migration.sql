CREATE TABLE "ProjectEstimatedTimelineItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "title" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "durationDays" DECIMAL(10,2),
    "estimateMandays" DECIMAL(10,2),
    "amountVnd" DECIMAL(18,2),
    "assigneeId" TEXT,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "currentVersionNo" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectEstimatedTimelineItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectEstimatedTimelineVersion" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedFields" JSONB NOT NULL DEFAULT '[]',
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedById" TEXT NOT NULL,

    CONSTRAINT "ProjectEstimatedTimelineVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectEstimatedTimelineComment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectEstimatedTimelineComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectEstimatedTimelineItem_projectId_sortOrder_idx" ON "ProjectEstimatedTimelineItem"("projectId", "sortOrder");
CREATE INDEX "ProjectEstimatedTimelineItem_projectId_taskId_idx" ON "ProjectEstimatedTimelineItem"("projectId", "taskId");
CREATE INDEX "ProjectEstimatedTimelineItem_assigneeId_idx" ON "ProjectEstimatedTimelineItem"("assigneeId");

CREATE UNIQUE INDEX "ProjectEstimatedTimelineVersion_itemId_versionNo_key" ON "ProjectEstimatedTimelineVersion"("itemId", "versionNo");
CREATE INDEX "ProjectEstimatedTimelineVersion_itemId_idx" ON "ProjectEstimatedTimelineVersion"("itemId");
CREATE INDEX "ProjectEstimatedTimelineVersion_createdAt_idx" ON "ProjectEstimatedTimelineVersion"("createdAt");

CREATE INDEX "ProjectEstimatedTimelineComment_projectId_idx" ON "ProjectEstimatedTimelineComment"("projectId");
CREATE INDEX "ProjectEstimatedTimelineComment_authorId_idx" ON "ProjectEstimatedTimelineComment"("authorId");

ALTER TABLE "ProjectEstimatedTimelineItem"
ADD CONSTRAINT "ProjectEstimatedTimelineItem_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectEstimatedTimelineItem"
ADD CONSTRAINT "ProjectEstimatedTimelineItem_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectEstimatedTimelineItem"
ADD CONSTRAINT "ProjectEstimatedTimelineItem_assigneeId_fkey"
FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectEstimatedTimelineVersion"
ADD CONSTRAINT "ProjectEstimatedTimelineVersion_itemId_fkey"
FOREIGN KEY ("itemId") REFERENCES "ProjectEstimatedTimelineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectEstimatedTimelineVersion"
ADD CONSTRAINT "ProjectEstimatedTimelineVersion_editedById_fkey"
FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectEstimatedTimelineComment"
ADD CONSTRAINT "ProjectEstimatedTimelineComment_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectEstimatedTimelineComment"
ADD CONSTRAINT "ProjectEstimatedTimelineComment_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
