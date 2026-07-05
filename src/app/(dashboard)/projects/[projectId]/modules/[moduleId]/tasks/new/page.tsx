import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { canAccessModule, getAssignedModuleIdsForUser } from "@/lib/document-type-access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskCreateForm } from "@/components/task-create-form";
import { PageShell } from "@/components/page-shell";

export default async function NewTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; moduleId: string }>;
  searchParams: Promise<{ docId?: string; highlight?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { projectId, moduleId } = await params;
  const sp = await searchParams;

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
  if (!(await canAccess({ systemRole: session.user.systemRole }, "task.create", projectRole))) {
    redirect(`/projects/${projectId}/modules/${moduleId}/tasks`);
  }

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { fullName: true } } },
  });

  const relatedDocument = sp.docId
    ? await prisma.document.findFirst({ where: { id: sp.docId, projectId }, select: { title: true } })
    : null;

  return (
    <PageShell size="compact">
    <Card>
      <CardHeader>
        <CardTitle>Tạo task mới</CardTitle>
      </CardHeader>
      <CardContent>
        <TaskCreateForm
          projectId={projectId}
          moduleId={moduleId}
          members={members.map((m) => ({ userId: m.userId, fullName: m.user.fullName }))}
          defaultRelatedDocumentId={sp.docId}
          defaultSourceHighlight={sp.highlight}
          relatedDocumentTitle={relatedDocument?.title}
        />
      </CardContent>
    </Card>
    </PageShell>
  );
}
