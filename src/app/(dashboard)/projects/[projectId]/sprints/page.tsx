import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageSection } from "@/components/page-shell";
import { TaskViewTabs } from "@/components/task-view-tabs";
import { SprintCreateForm, DeletePlanningButton } from "@/components/planning-forms";
import { SPRINT_STATUS_LABEL } from "@/lib/validation/task";
import { projectCodeRouteSegment, projectRouteWhere } from "@/lib/route-slug";
import { planningStatusTone } from "@/lib/status-style";

export default async function SprintsPage({
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
  if (projectSegment !== projectRouteSegment) redirect(`/projects/${projectRouteSegment}/sprints`);

  const projectRole = await getProjectRole(session.user.id, projectId);
  const isAdmin = session.user.systemRole === "ADMIN";
  if (!isAdmin && !projectRole) redirect("/projects");
  const canManage = await canAccess({ systemRole: session.user.systemRole }, "task.managePlanning", projectRole);

  const sprints = await prisma.sprint.findMany({
    where: { projectId, deletedAt: null },
    include: { _count: { select: { tasks: { where: { deletedAt: null } } } } },
    orderBy: { startDate: "desc" },
  });

  return (
    <PageSection>
      <TaskViewTabs projectId={projectId} projectRouteSegment={projectRouteSegment} active="sprints" />
      <h1 className="text-lg font-semibold">Sprint ({sprints.length})</h1>
      {canManage ? <SprintCreateForm projectId={projectId} /> : null}

      {sprints.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có sprint nào.</p>
      ) : (
        <div className="space-y-2">
          {sprints.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.startDate.toLocaleDateString("vi-VN")} – {s.endDate.toLocaleDateString("vi-VN")}
                    {s.goal ? ` · ${s.goal}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={planningStatusTone(s.status)} className="status-badge">
                    {SPRINT_STATUS_LABEL[s.status]}
                  </Badge>
                  <Badge variant="secondary">{s._count.tasks} task</Badge>
                  {canManage ? <DeletePlanningButton projectId={projectId} id={s.id} kind="sprint" /> : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageSection>
  );
}
