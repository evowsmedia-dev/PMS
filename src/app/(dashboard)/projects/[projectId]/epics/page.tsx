import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageSection } from "@/components/page-shell";
import { TaskViewTabs } from "@/components/task-view-tabs";
import { EpicCreateForm, DeletePlanningButton } from "@/components/planning-forms";
import { EPIC_STATUS_LABEL } from "@/lib/validation/task";
import { projectCodeRouteSegment, projectRouteWhere } from "@/lib/route-slug";
import { planningStatusTone } from "@/lib/status-style";

export default async function EpicsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { projectId: projectSegment } = await params;

  const project = await prisma.project.findFirst({
    where: projectRouteWhere(projectSegment),
    select: { id: true, code: true },
  });
  if (!project) notFound();
  const projectId = project.id;
  const projectRouteSegment = projectCodeRouteSegment(project);
  if (projectSegment !== projectRouteSegment) redirect(`/projects/${projectRouteSegment}/epics`);

  const projectRole = await getProjectRole(session.user.id, projectId);
  const isAdmin = session.user.systemRole === "ADMIN";
  if (!isAdmin && !projectRole) redirect("/projects");
  const canManage = await canAccess({ systemRole: session.user.systemRole }, "task.managePlanning", projectRole);

  const epics = await prisma.epic.findMany({
    where: { projectId, deletedAt: null },
    include: { _count: { select: { tasks: { where: { deletedAt: null } } } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <PageSection>
      <TaskViewTabs projectId={projectId} projectRouteSegment={projectRouteSegment} active="epics" />
      <h1 className="text-lg font-semibold">Epic ({epics.length})</h1>
      {canManage ? <EpicCreateForm projectId={projectId} /> : null}

      {epics.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có epic nào.</p>
      ) : (
        <div className="space-y-2">
          {epics.map((e) => (
            <Card key={e.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    <span className="font-mono text-xs text-muted-foreground">{e.epicCode}</span> {e.name}
                  </p>
                  {e.description ? (
                    <p className="text-xs text-muted-foreground">{e.description}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={planningStatusTone(e.status)} className="status-badge">
                    {EPIC_STATUS_LABEL[e.status]}
                  </Badge>
                  <Badge variant="secondary">{e._count.tasks} task</Badge>
                  {canManage ? <DeletePlanningButton projectId={projectId} id={e.id} kind="epic" /> : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageSection>
  );
}
