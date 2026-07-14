import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProjectRole } from "@/lib/project-role";
import { PageSection } from "@/components/page-shell";
import { TaskViewTabs } from "@/components/task-view-tabs";
import { GanttChart, type GanttTask } from "@/components/gantt-chart";
import { projectCodeRouteSegment, projectRouteWhere } from "@/lib/route-slug";

export default async function GanttPage({
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
  if (projectSegment !== projectRouteSegment) redirect(`/projects/${projectRouteSegment}/gantt`);

  const projectRole = await getProjectRole(session.user.id, projectId);
  const isAdmin = session.user.systemRole === "ADMIN";
  if (!isAdmin && !projectRole) redirect("/projects");

  const tasks = await prisma.task.findMany({
    where: {
      projectId,
      deletedAt: null,
      OR: [
        { plannedStartAt: { not: null } },
        { startDate: { not: null } },
        { dueDate: { not: null } },
        { devDueAt: { not: null } },
        { testDueAt: { not: null } },
      ],
    },
    include: {
      epic: { select: { id: true, name: true } },
      assignee: { select: { fullName: true } },
      dependencies: { select: { dependsOnTaskId: true } },
    },
    orderBy: [{ startDate: "asc" }, { plannedStartAt: "asc" }, { dueDate: "asc" }],
  });

  const ganttTasks: GanttTask[] = tasks.map((task) => ({
    id: task.id,
    moduleId: task.moduleId,
    taskCode: task.taskCode,
    title: task.title,
    status: task.status,
    progressPercent: task.progressPercent,
    plannedStartAt: task.plannedStartAt?.toISOString() ?? null,
    startDate: task.startDate?.toISOString() ?? null,
    dueDate: task.dueDate?.toISOString() ?? null,
    devDueAt: task.devDueAt?.toISOString() ?? null,
    testDueAt: task.testDueAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    devEstimateHours: Number(task.devEstimateHours),
    testEstimateHours: Number(task.testEstimateHours),
    actualDevHours: Number(task.actualDevHours),
    actualTestHours: Number(task.actualTestHours),
    assigneeName: task.assignee?.fullName ?? null,
    dependencyCount: task.dependencies.length,
    epicName: task.epic?.name ?? "Không thuộc epic",
  }));

  return (
    <PageSection>
      <TaskViewTabs projectId={projectId} projectRouteSegment={projectRouteSegment} active="gantt" />
      {ganttTasks.length === 0 ? (
        <>
          <h1 className="text-lg font-semibold">Gantt Chart</h1>
          <p className="text-sm text-muted-foreground">
            Chưa có task nào có ngày kế hoạch hoặc hạn hoàn thành để hiển thị trên Gantt.
          </p>
        </>
      ) : (
        <GanttChart projectRouteSegment={projectRouteSegment} tasks={ganttTasks} />
      )}
    </PageSection>
  );
}
