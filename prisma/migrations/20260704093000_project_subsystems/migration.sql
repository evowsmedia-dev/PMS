-- CreateTable
CREATE TABLE "ProjectSubsystem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSubsystem_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "subsystemId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ProjectSubsystem_name_key" ON "ProjectSubsystem"("name");

-- CreateIndex
CREATE INDEX "Project_subsystemId_idx" ON "Project"("subsystemId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_subsystemId_fkey" FOREIGN KEY ("subsystemId") REFERENCES "ProjectSubsystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
