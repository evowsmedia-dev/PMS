-- Add multi-document references and external links for tasks.
ALTER TABLE "Task" ADD COLUMN "externalLinks" JSONB NOT NULL DEFAULT '[]';

CREATE TABLE "TaskRelatedDocument" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskRelatedDocument_pkey" PRIMARY KEY ("id")
);

INSERT INTO "TaskRelatedDocument" ("id", "taskId", "documentId", "createdAt")
SELECT 'trd_' || md5(random()::text || clock_timestamp()::text || "id"), "id", "relatedDocumentId", CURRENT_TIMESTAMP
FROM "Task"
WHERE "relatedDocumentId" IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE UNIQUE INDEX "TaskRelatedDocument_taskId_documentId_key" ON "TaskRelatedDocument"("taskId", "documentId");
CREATE INDEX "TaskRelatedDocument_documentId_idx" ON "TaskRelatedDocument"("documentId");

ALTER TABLE "TaskRelatedDocument"
ADD CONSTRAINT "TaskRelatedDocument_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskRelatedDocument"
ADD CONSTRAINT "TaskRelatedDocument_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
