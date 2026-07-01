import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { ProjectRole } from "@/generated/prisma/enums";

/**
 * Loads the caller's ProjectMember.role for a project, memoized per request.
 * Returns null if the user isn't a member (systemRole=ADMIN bypasses this entirely in can()).
 */
export const getProjectRole = cache(
  async (userId: string, projectId: string): Promise<ProjectRole | null> => {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { role: true },
    });
    return member?.role ?? null;
  },
);
