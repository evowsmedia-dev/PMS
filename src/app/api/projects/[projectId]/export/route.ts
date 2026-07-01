import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { logAudit } from "@/lib/audit";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await context.params;
  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!can({ systemRole: session.user.systemRole }, "project.export", projectRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: {
      modules: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
      documents: {
        where: { deletedAt: null },
        include: { versions: { orderBy: { versionNo: "asc" } } },
      },
      tasks: { where: { deletedAt: null } },
      members: { include: { user: { select: { fullName: true, email: true } } } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await logAudit({
    actorId: session.user.id,
    action: "EXPORT",
    entityType: "Project",
    entityId: project.id,
    projectId: project.id,
  });

  const json = JSON.stringify(project, null, 2);

  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${project.code}-export.json"`,
    },
  });
}
