import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { canAccessModule, getAssignedModuleIdsForUser } from "@/lib/document-type-access";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentCreateForm } from "@/components/document-create-form";
import { PageShell } from "@/components/page-shell";
import { projectRouteWhere } from "@/lib/route-slug";

export default async function NewDocumentPage({
  params,
}: {
  params: Promise<{ projectId: string; moduleId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { projectId: projectSegment, moduleId } = await params;
  const project = await prisma.project.findFirst({ where: projectRouteWhere(projectSegment), select: { id: true } });
  if (!project) redirect("/projects");
  const projectId = project.id;

  const projectRole = await getProjectRole(session.user.id, projectId);
  const assignedModuleIds = await getAssignedModuleIdsForUser({
    projectId,
    userId: session.user.id,
    systemRole: session.user.systemRole,
    projectRole,
  });
  if (!canAccessModule(assignedModuleIds, moduleId)) {
    redirect(`/projects/${projectId}/overview`);
  }
  if (!(await canAccess({ systemRole: session.user.systemRole }, "document.create", projectRole))) {
    redirect(`/projects/${projectId}/modules/${moduleId}/documents`);
  }

  return (
    <PageShell size="compact">
    <Card>
      <CardHeader>
        <CardTitle>Tạo tài liệu mới</CardTitle>
      </CardHeader>
      <CardContent>
        <DocumentCreateForm projectId={projectId} moduleId={moduleId} />
      </CardContent>
    </Card>
    </PageShell>
  );
}
