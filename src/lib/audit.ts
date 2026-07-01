import { prisma } from "@/lib/prisma";
import type { AuditAction } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export interface LogAuditInput {
  actorId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  projectId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export async function logAudit(input: LogAuditInput) {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      projectId: input.projectId ?? null,
      metadata: input.metadata,
    },
  });
}
