CREATE TYPE "AiSubtaskGenerationStatus" AS ENUM ('DRAFT', 'ACCEPTED');

CREATE TABLE "AiSubtaskGeneration" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentTaskId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "contextHash" TEXT NOT NULL,
    "contextSnapshot" JSONB NOT NULL,
    "proposals" JSONB NOT NULL,
    "coverageReport" JSONB NOT NULL,
    "totalEstimateHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "AiSubtaskGenerationStatus" NOT NULL DEFAULT 'DRAFT',
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSubtaskGeneration_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Task" ADD COLUMN "aiSubtaskGenerationId" TEXT;

CREATE UNIQUE INDEX "AiSubtaskGeneration_parentTaskId_versionNo_key"
ON "AiSubtaskGeneration"("parentTaskId", "versionNo");
CREATE INDEX "AiSubtaskGeneration_parentTaskId_createdAt_idx"
ON "AiSubtaskGeneration"("parentTaskId", "createdAt");
CREATE INDEX "AiSubtaskGeneration_parentTaskId_contextHash_idx"
ON "AiSubtaskGeneration"("parentTaskId", "contextHash");
CREATE INDEX "AiSubtaskGeneration_projectId_createdAt_idx"
ON "AiSubtaskGeneration"("projectId", "createdAt");
CREATE INDEX "Task_aiSubtaskGenerationId_idx" ON "Task"("aiSubtaskGenerationId");

ALTER TABLE "AiSubtaskGeneration"
ADD CONSTRAINT "AiSubtaskGeneration_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiSubtaskGeneration"
ADD CONSTRAINT "AiSubtaskGeneration_parentTaskId_fkey"
FOREIGN KEY ("parentTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiSubtaskGeneration"
ADD CONSTRAINT "AiSubtaskGeneration_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task"
ADD CONSTRAINT "Task_aiSubtaskGenerationId_fkey"
FOREIGN KEY ("aiSubtaskGenerationId") REFERENCES "AiSubtaskGeneration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
