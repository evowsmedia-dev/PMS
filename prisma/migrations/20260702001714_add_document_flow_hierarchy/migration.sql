-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "parentDocumentId" TEXT,
ADD COLUMN     "templateId" TEXT;

-- CreateIndex
CREATE INDEX "Document_parentDocumentId_idx" ON "Document"("parentDocumentId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_parentDocumentId_fkey" FOREIGN KEY ("parentDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

