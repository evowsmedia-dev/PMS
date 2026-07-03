-- Add project-member to document-type/module assignments.
CREATE TABLE "ProjectMemberDocumentTypeAssignment" (
    "id" TEXT NOT NULL,
    "projectMemberId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMemberDocumentTypeAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectMemberDocumentTypeAssignment_projectMemberId_moduleId_key"
    ON "ProjectMemberDocumentTypeAssignment"("projectMemberId", "moduleId");

CREATE INDEX "ProjectMemberDocumentTypeAssignment_moduleId_idx"
    ON "ProjectMemberDocumentTypeAssignment"("moduleId");

ALTER TABLE "ProjectMemberDocumentTypeAssignment"
    ADD CONSTRAINT "ProjectMemberDocumentTypeAssignment_projectMemberId_fkey"
    FOREIGN KEY ("projectMemberId") REFERENCES "ProjectMember"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectMemberDocumentTypeAssignment"
    ADD CONSTRAINT "ProjectMemberDocumentTypeAssignment_moduleId_fkey"
    FOREIGN KEY ("moduleId") REFERENCES "Module"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Allow hard-deleting documents while preserving related tasks.
ALTER TABLE "Task" DROP CONSTRAINT "Task_relatedDocumentId_fkey";

ALTER TABLE "Task"
    ADD CONSTRAINT "Task_relatedDocumentId_fkey"
    FOREIGN KEY ("relatedDocumentId") REFERENCES "Document"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
