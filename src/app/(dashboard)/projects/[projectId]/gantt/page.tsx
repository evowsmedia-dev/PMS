import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProjectRole } from "@/lib/project-role";
import { Badge } from "@/components/ui/badge";
import { PageSection } from "@/components/page-shell";
import { TaskViewTabs } from "@/components/task-view-tabs";
import { taskHref } from "@/lib/task-href";
import { TASK_STATUS_LABEL } from "@/lib/validation/task";
import { projectCodeRouteSegment, projectRouteWhere } from "@/lib/route-slug";

const DAY_MS = 24 * 60 * 60 * 1000;

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
      OR: [{ startDate: { not: null } }, { dueDate: { not: null } }],
    },
    include: {
      epic: { select: { id: true, name: true } },
      assignee: { select: { fullName: true } },
      dependencies: { select: { dependsOnTaskId: true } },
    },
    orderBy: [{ startDate: "asc" }, { dueDate: "asc" }],
  });

  if (tasks.length === 0) {
    return (
      <PageSection>
        <TaskViewTabs projectId={projectId} projectRouteSegment={projectRouteSegment} active="gantt" />
        <h1 className="text-lg font-semibold">Gantt Chart</h1>
        <p className="text-sm text-muted-foreground">
          Chưa có task nào có ngày bắt đầu/hạn hoàn thành để hiển thị trên Gantt. Thêm ngày cho task
          để xem timeline.
        </p>
      </PageSection>
    );
  }

  // Compute the overall date window across all scheduled tasks.
  const dates: number[] = [];
  for (const t of tasks) {
    if (t.startDate) dates.push(t.startDate.getTime());
    if (t.dueDate) dates.push(t.dueDate.getTime());
  }
  const min = Math.min(...dates);
  const max = Math.max(...dates);
  const spanMs = Math.max(max - min, DAY_MS);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const now = today.getTime();

  function bar(startMs: number | null, endMs: number | null) {
    const s = startMs ?? endMs ?? min;
    const e = endMs ?? startMs ?? max;
    const left = ((s - min) / spanMs) * 100;
    const width = Math.max(((e - s) / spanMs) * 100, 1.5);
    return { left, width };
  }

  // Group by epic (tasks with no epic go under "Không thuộc epic").
  const groups = new Map<string, { name: string; tasks: typeof tasks }>();
  for (const t of tasks) {
    const key = t.epic?.id ?? "__none";
    if (!groups.has(key)) groups.set(key, { name: t.epic?.name ?? "Không thuộc epic", tasks: [] });
    groups.get(key)!.tasks.push(t);
  }

  const nowLeft = ((now - min) / spanMs) * 100;
  const showNow = now >= min && now <= max;

  return (
    <PageSection>
      <TaskViewTabs projectId={projectId} projectRouteSegment={projectRouteSegment} active="gantt" />
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Gantt Chart</h1>
        <span className="text-xs text-muted-foreground">
          {new Date(min).toLocaleDateString("vi-VN")} – {new Date(max).toLocaleDateString("vi-VN")}
        </span>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <div className="min-w-[720px]">
          {[...groups.values()].map((group) => (
            <div key={group.name} className="border-b last:border-none">
              <div className="bg-muted/40 px-3 py-1.5 text-xs font-semibold uppercase text-muted-foreground">
                {group.name}
              </div>
              {group.tasks.map((t) => {
                const b = bar(
                  t.startDate ? t.startDate.getTime() : null,
                  t.dueDate ? t.dueDate.getTime() : null,
                );
                const overdue = t.dueDate && t.dueDate.getTime() < now && t.status !== "DONE";
                return (
                  <div key={t.id} className="flex items-center gap-2 px-3 py-1.5">
                    <div className="w-48 shrink-0 truncate text-sm">
                      <Link
                        href={taskHref(projectId, t.moduleId, t.id)}
                        className="hover:underline"
                        title={t.title}
                      >
                        {t.taskCode ? (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {t.taskCode}{" "}
                          </span>
                        ) : null}
                        {t.title}
                      </Link>
                    </div>
                    <div className="relative h-5 flex-1 rounded bg-muted/50">
                      {showNow ? (
                        <div
                          className="absolute top-0 bottom-0 z-10 w-px bg-primary/60"
                          style={{ left: `${nowLeft}%` }}
                        />
                      ) : null}
                      <div
                        className={`absolute top-0 h-5 rounded ${
                          overdue ? "bg-destructive/30" : "bg-primary/25"
                        }`}
                        style={{ left: `${b.left}%`, width: `${b.width}%` }}
                        title={`${t.startDate?.toLocaleDateString("vi-VN") ?? "?"} → ${
                          t.dueDate?.toLocaleDateString("vi-VN") ?? "?"
                        } · ${TASK_STATUS_LABEL[t.status]}`}
                      >
                        <div
                          className={`h-5 rounded ${overdue ? "bg-destructive/70" : "bg-primary/70"}`}
                          style={{ width: `${Math.min(Math.max(t.progressPercent, 0), 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="hidden w-24 shrink-0 text-right text-[11px] text-muted-foreground sm:block">
                      {t.dependencies.length > 0 ? (
                        <Badge variant="outline" className="text-[10px]">
                          {t.dependencies.length} phụ thuộc
                        </Badge>
                      ) : (
                        (t.assignee?.fullName ?? "")
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Thanh đậm = tiến độ (%). Màu đỏ = quá hạn. Vạch dọc = hôm nay.
      </p>
    </PageSection>
  );
}
