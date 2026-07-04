-- CreateEnum
CREATE TYPE "ContentFormat" AS ENUM ('MARKDOWN', 'HTML');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN "contentFormat" "ContentFormat" NOT NULL DEFAULT 'MARKDOWN';

-- AlterTable
ALTER TABLE "DocumentVersion" ADD COLUMN "contentFormat" "ContentFormat" NOT NULL DEFAULT 'MARKDOWN';
