import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { getAssignedModuleIdsForUser } from "@/lib/document-type-access";
import { computeProjectMetrics } from "@/lib/reports/snapshot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageSection } from "@/components/page-shell";
import { ProjectReportSection } from "@/components/project-report-section";
import { ProjectBiDashboardSection } from "@/components/bi-dashboard-section";
import { computeProjectBiMetrics } from "@/lib/reports/bi-dashboard";
import {
  TASK_STATUS_LABEL,
  TASK_STATUS_ORDER,
  BUG_STATUS_LABEL,
  BUG_STATUS_ORDER,
} from "@/lib/validation/task";

// Fixed palette so chart colors stay stable across renders regardless of which
// statuses happen to be present.
const CHART_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#0ea5e9",
  "#ef4444",
  "#14b8a6",
  "#a855f7",
  "#84cc16",
  "#f43f5e",
  "#64748b",
];

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
      modules: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true },
      },
    },
  });
  if (!project) notFound();

  const projectRole = await getProjectRole(session.user.id, projectId);
  const roleCtx = { systemRole: session.user.systemRole };
  const canEditSettings = await canAccess(roleCtx, "project.editSettings", projectRole);
  const canViewReports = await canAccess(roleCtx, "report.view", projectRole);

  const assignedModuleIds = await getAssignedModuleIdsForUser({
    projectId,
    userId: session.user.id,
    systemRole: session.user.systemRole,
    projectRole,
  });
  const visibleModuleIds = assignedModuleIds
    ? project.modules.filter((m) => assignedModuleIds.has(m.id)).map((m) => m.id)
    : project.modules.map((m) => m.id);
  const docScope = { projectId, deletedAt: null, moduleId: { in: visibleModuleIds } };

  // Task and bug metrics are project-wide (they include module-less tasks and
  // subtasks); document status stays module-scoped to what the user can see.
  const [metrics, taskStatusCounts, bugStatusCounts, docStatusCounts, biMetrics] = await Promise.all([
    computeProjectMetrics(projectId),
    prisma.task.groupBy({ by: ["status"], where: { projectId, deletedAt: null }, _count: true }),
    prisma.bug.groupBy({ by: ["status"], where: { projectId, deletedAt: null }, _count: true }),
    prisma.document.groupBy({ by: ["status"], where: docScope, _count: true }),
    canViewReports ? computeProjectBiMetrics(projectId) : Promise.resolve(null),
  ]);

  const taskCountByStatus = new Map(taskStatusCounts.map((s) => [s.status, s._count]));
  const taskSegments = TASK_STATUS_ORDER.map((status, index) => ({
    label: TASK_STATUS_LABEL[status],
    value: taskCountByStatus.get(status) ?? 0,
    color: CHART_COLORS[index % CHART_COLORS.length],
  })).filter((s) => s.value > 0);

  const bugCountByStatus = new Map(bugStatusCounts.map((s) => [s.status, s._count]));
  const bugSegments = BUG_STATUS_ORDER.map((status, index) => ({
    label: BUG_STATUS_LABEL[status],
    value: bugCountByStatus.get(status) ?? 0,
    color: CHART_COLORS[index % CHART_COLORS.length],
  })).filter((s) => s.value > 0);

  const totalDocuments = docStatusCounts.reduce((sum, s) => sum + s._count, 0);
  const docSegments = docStatusCounts.map((s, index) => ({
    label: s.status,
    value: s._count,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));

  const completionRate =
    metrics.totalTasks > 0 ? Math.round((metrics.completedTasks / metrics.totalTasks) * 100) : 0;
  const effortVariance =
    metrics.totalEstimateHours > 0
      ? Math.round(((metrics.totalActualHours - metrics.totalEstimateHours) / metrics.totalEstimateHours) * 100)
      : 0;

  const taskStats = [
    { label: "Tổng task", value: metrics.totalTasks },
    { label: "Hoàn thành", value: metrics.completedTasks },
    { label: "Tỷ lệ hoàn thành", value: `${completionRate}%` },
    { label: "Quá hạn", value: metrics.overdueTasks, alert: metrics.overdueTasks > 0 },
    { label: "Blocked", value: metrics.blockedTasks, alert: metrics.blockedTasks > 0 },
    {
      label: "Giờ ước tính / thực tế",
      value: `${metrics.totalEstimateHours} / ${metrics.totalActualHours}`,
    },
    {
      label: "Variance ngày công",
      value: `${effortVariance}%`,
      alert: effortVariance > 20,
    },
  ];

  const bugStats = [
    { label: "Tổng bug", value: metrics.totalBugs },
    { label: "Bug mở", value: metrics.openBugs, alert: metrics.openBugs > 0 },
    { label: "Nghiêm trọng", value: metrics.criticalBugs, alert: metrics.criticalBugs > 0 },
  ];

  return (
    <PageSection>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Trạng thái task</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {metrics.totalTasks === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có task.</p>
            ) : (
              <StatusDonut segments={taskSegments} total={metrics.totalTasks} />
            )}
            <StatList stats={taskStats} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Trạng thái test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {metrics.totalBugs === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có bug.</p>
            ) : (
              <StatusDonut segments={bugSegments} total={metrics.totalBugs} />
            )}
            <StatList stats={bugStats} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Trạng thái tài liệu</CardTitle>
          </CardHeader>
          <CardContent>
            {totalDocuments === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có tài liệu.</p>
            ) : (
              <StatusDonut segments={docSegments} total={totalDocuments} />
            )}
          </CardContent>
        </Card>
      </div>

      {canViewReports && biMetrics ? <ProjectBiDashboardSection metrics={biMetrics} /> : null}

      {canViewReports ? <ProjectReportSection projectId={projectId} /> : null}

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
        <CardContent className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
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
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Bắt đầu</span>
            <span>{project.startDate ? project.startDate.toLocaleDateString("vi-VN") : "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Kết thúc</span>
            <span>{project.endDate ? project.endDate.toLocaleDateString("vi-VN") : "—"}</span>
          </div>
          <div className="flex items-start justify-between gap-4 sm:col-span-2">
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
          {project.description ? (
            <p className="border-t pt-2 text-muted-foreground sm:col-span-2">{project.description}</p>
          ) : null}
        </CardContent>
      </Card>

      {project.highlightNote ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Vấn đề nổi bật</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{project.highlightNote}</CardContent>
        </Card>
      ) : null}
    </PageSection>
  );
}

function StatList({
  stats,
}: {
  stats: { label: string; value: string | number; alert?: boolean }[];
}) {
  return (
    <dl className="space-y-1 border-t pt-3 text-sm">
      {stats.map((s) => (
        <div key={s.label} className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">{s.label}</dt>
          <dd className={`font-medium ${s.alert ? "text-destructive" : ""}`}>{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function StatusDonut({
  segments,
  total,
}: {
  segments: { label: string; value: number; color: string }[];
  total: number;
}) {
  const size = 148;
  const stroke = 20;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const renderedSegments = segments.map((segment, index) => {
    const length = (segment.value / total) * circ;
    const offset = segments
      .slice(0, index)
      .reduce((sum, previous) => sum + (previous.value / total) * circ, 0);
    return { ...segment, length, offset };
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0 text-muted-foreground"
      >
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.12}
            strokeWidth={stroke}
          />
          {renderedSegments.map((s, i) => (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${s.length} ${circ - s.length}`}
              strokeDashoffset={-s.offset}
            />
          ))}
        </g>
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground text-2xl font-semibold"
        >
          {total}
        </text>
      </svg>
      <ul className="w-full space-y-1.5 text-sm">
        {segments.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{s.label}</span>
            <span className="font-medium">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
