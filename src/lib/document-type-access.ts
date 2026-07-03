import { prisma } from "@/lib/prisma";
import type { ProjectRole, SystemRole } from "@/generated/prisma/enums";

export async function getAssignedModuleIdsForUser({
  projectId,
  userId,
  systemRole,
  projectRole,
}: {
  projectId: string;
  userId: string;
  systemRole: SystemRole;
  projectRole: ProjectRole | null;
}) {
  if (systemRole === "ADMIN" || projectRole === "OWNER" || projectRole === "PO") {
    return null;
  }

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    include: { documentTypeAssignments: { select: { moduleId: true } } },
  });
  if (!member || member.documentTypeAssignments.length === 0) return null;

  return new Set(member.documentTypeAssignments.map((a) => a.moduleId));
}

export function canAccessModule(assignedModuleIds: Set<string> | null, moduleId: string) {
  return !assignedModuleIds || assignedModuleIds.has(moduleId);
}
