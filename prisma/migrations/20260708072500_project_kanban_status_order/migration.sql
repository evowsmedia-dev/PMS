-- Store per-project visible Kanban statuses in display order.
ALTER TABLE "Project" ADD COLUMN "kanbanStatusOrder" JSONB NOT NULL DEFAULT '[]';
