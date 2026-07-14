import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageSection } from "@/components/page-shell";
import { TaskViewTabs } from "@/components/task-view-tabs";
import { MilestoneCreateForm, DeletePlanningButton } from "@/components/planning-forms";
import { MILESTONE_STATUS_LABEL } from "@/lib/validation/task";
import { projectCodeRouteSegment, projectRouteWhere } from "@/lib/route-slug";

export default async function MilestonesPage({
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
  if (projectSegment !== projectRouteSegment) redirect(`/projects/${projectRouteSegment}/milestones`);

  const projectRole = await getProjectRole(session.user.id, projectId);
  const isAdmin = session.user.systemRole === "ADMIN";
  if (!isAdmin && !projectRole) redirect("/projects");
  const canManage = await canAccess({ systemRole: session.user.systemRole }, "task.managePlanning", projectRole);

  const milestones = await prisma.milestone.findMany({
    where: { projectId, deletedAt: null },
    include: { _count: { select: { tasks: { where: { deletedAt: null } } } } },
    orderBy: { dueDate: "asc" },
  });

  const now = new Date();

  return (
    <PageSection>
      <TaskViewTabs projectId={projectId} projectRouteSegment={projectRouteSegment} active="milestones" />
      <h1 className="text-lg font-semibold">Milestone ({milestones.length})</h1>
      {canManage ? <MilestoneCreateForm projectId={projectId} /> : null}

      {milestones.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có milestone nào.</p>
      ) : (
        <div className="space-y-2">
          {milestones.map((m) => {
            const overdue = m.dueDate < now && m.status !== "COMPLETED";
            return (
              <Card key={m.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="font-medium">{m.name}</p>
                    <p className={`text-xs ${overdue ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                      Đến hạn: {m.dueDate.toLocaleDateString("vi-VN")}
                      {m.description ? ` · ${m.description}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{MILESTONE_STATUS_LABEL[m.status]}</Badge>
                    <Badge variant="secondary">{m._count.tasks} task</Badge>
                    {canManage ? (
                      <DeletePlanningButton projectId={projectId} id={m.id} kind="milestone" />
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PageSection>
  );
}
