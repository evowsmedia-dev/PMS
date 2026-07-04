import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { getAssignedModuleIdsForUser } from "@/lib/document-type-access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageSection } from "@/components/page-shell";
import { TASK_STATUS_LABEL, TASK_STATUS_ORDER } from "@/lib/validation/task";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { projectId } = await params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: {
      subsystem: { select: { name: true } },
      members: { include: { user: { select: { fullName: true, email: true } } } },
      modules: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true },
      },
    },
  });
  if (!project) notFound();

  const projectRole = await getProjectRole(session.user.id, projectId);
  const canEditSettings = can(
    { systemRole: session.user.systemRole },
    "project.editSettings",
    projectRole,
  );

  const assignedModuleIds = await getAssignedModuleIdsForUser({
    projectId,
    userId: session.user.id,
    systemRole: session.user.systemRole,
    projectRole,
  });
  const visibleModuleIds = assignedModuleIds
    ? project.modules.filter((m) => assignedModuleIds.has(m.id)).map((m) => m.id)
    : project.modules.map((m) => m.id);
  const visibleScope = { projectId, deletedAt: null, moduleId: { in: visibleModuleIds } };

  const [documentCount, taskCount, docStatusCounts, taskStatusCounts] = await Promise.all([
    prisma.document.count({ where: visibleScope }),
    prisma.task.count({ where: visibleScope }),
    prisma.document.groupBy({
      by: ["status"],
      where: visibleScope,
      _count: true,
    }),
    prisma.task.groupBy({
      by: ["status"],
      where: visibleScope,
      _count: true,
    }),
  ]);
  const taskCountByStatus = new Map(taskStatusCounts.map((s) => [s.status, s._count]));
  const totalTasks = taskStatusCounts.reduce((sum, s) => sum + s._count, 0);
  const doneTasks = taskCountByStatus.get("DONE") ?? 0;
  const taskCompletion = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const taskSegments = TASK_STATUS_ORDER.map((status, index) => ({
    status,
    count: taskCountByStatus.get(status) ?? 0,
    label: TASK_STATUS_LABEL[status],
    className: ["bg-foreground", "bg-foreground/70", "bg-foreground/40", "bg-muted-foreground/25"][index],
  }));

  return (
    <PageSection>
      <div className="grid grid-cols-3 gap-3">
        <Card className="min-h-24">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Tài liệu</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{documentCount}</CardContent>
        </Card>
        <Card className="min-h-24">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Task</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{taskCount}</CardContent>
        </Card>
        <Card className="min-h-24">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Thành viên</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{project.members.length}</CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Trạng thái tài liệu</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {docStatusCounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có tài liệu.</p>
            ) : (
              docStatusCounts.map((s) => (
                <Badge key={s.status} variant="outline">
                  {s.status}: {s._count}
                </Badge>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tiến độ task</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {taskStatusCounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có task.</p>
            ) : (
              <>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-3xl font-semibold">{taskCompletion}%</p>
                    <p className="text-sm text-muted-foreground">Hoàn thành</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {doneTasks}/{totalTasks} task
                  </p>
                </div>
                <div className="flex h-3 overflow-hidden rounded-4xl border border-border bg-muted">
                  {taskSegments.map((segment) =>
                    segment.count > 0 ? (
                      <div
                        key={segment.status}
                        className={segment.className}
                        style={{ width: `${(segment.count / totalTasks) * 100}%` }}
                        title={`${segment.label}: ${segment.count}`}
                      />
                    ) : null,
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {taskSegments.map((segment) => (
                    <div key={segment.status} className="flex items-center justify-between gap-2 rounded-lg border border-border px-2 py-1.5 text-sm">
                      <span className="min-w-0 truncate text-muted-foreground">{segment.label}</span>
                      <span className="font-medium">{segment.count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Thông tin chung</CardTitle>
            {canEditSettings ? (
              <Button asChild size="icon" variant="ghost" className="size-7">
                <Link href={`/projects/${projectId}/settings/edit`}>
                  <Pencil className="size-3.5" />
                </Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Mã dự án</span>
              <span className="truncate font-medium">{project.code}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Trạng thái</span>
              <Badge variant="outline">{project.status}</Badge>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Độ ưu tiên</span>
              <Badge variant="outline">{project.priority}</Badge>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="text-muted-foreground">Phân hệ</span>
              <span className="min-w-0 text-right font-medium">
                {project.subsystem?.name ?? "Chưa chọn"}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="text-muted-foreground">Loại tài liệu</span>
              <div className="min-w-0 text-right">
                <span className="font-medium">{project.modules.length}</span>
                {project.modules.length > 0 ? (
                  <p className="mt-1 text-muted-foreground">
                    {project.modules.map((m) => m.name).join(", ")}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Bắt đầu</span>
              <span>{project.startDate ? project.startDate.toLocaleDateString("vi-VN") : "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Kết thúc</span>
              <span>{project.endDate ? project.endDate.toLocaleDateString("vi-VN") : "—"}</span>
            </div>
            {project.description ? (
              <p className="border-t pt-2 text-muted-foreground">{project.description}</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {project.highlightNote ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Vấn đề nổi bật</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{project.highlightNote}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Thành viên dự án</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {project.members.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{m.user.fullName}</span>
              <Badge variant="secondary">{m.role}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageSection>
  );
}
