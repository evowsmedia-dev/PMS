import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { computeProjectMetrics } from "@/lib/reports/snapshot";
import {
  TASK_STATUS_LABEL,
  TASK_STATUS_ORDER,
  BUG_SEVERITY_LABEL,
  BUG_SEVERITY_ORDER,
} from "@/lib/validation/task";

const DONE_STATUSES = ["DONE", "CANCELLED"];

/**
 * Project-wide health report (KPIs, task-status & bug-severity bars, per-member
 * workload, burndown). Embedded in the project dashboard for users with
 * `report.view`. All metrics are project-wide (no module scoping).
 */
export async function ProjectReportSection({ projectId }: { projectId: string }) {
  const now = new Date();

  const [metrics, statusGroups, severityGroups, tasks, members, snapshots] = await Promise.all([
    computeProjectMetrics(projectId),
    prisma.task.groupBy({ by: ["status"], where: { projectId, deletedAt: null }, _count: true }),
    prisma.bug.groupBy({ by: ["severity"], where: { projectId, deletedAt: null }, _count: true }),
    prisma.task.findMany({
      where: { projectId, deletedAt: null, assigneeId: { not: null } },
      select: { assigneeId: true, status: true, dueDate: true, actualHours: true },
    }),
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, fullName: true } } },
    }),
    prisma.dailyProjectSnapshot.findMany({
      where: { projectId },
      orderBy: { snapshotDate: "asc" },
      take: 60,
    }),
  ]);

  const statusCount = new Map(statusGroups.map((g) => [g.status, g._count]));
  const severityCount = new Map(severityGroups.map((g) => [g.severity, g._count]));

  const workload = members.map((m) => {
    const own = tasks.filter((t) => t.assigneeId === m.userId);
    return {
      name: m.user.fullName,
      assigned: own.length,
      inProgress: own.filter((t) => t.status === "IN_PROGRESS").length,
      overdue: own.filter((t) => t.dueDate && t.dueDate < now && !DONE_STATUSES.includes(t.status)).length,
      done: own.filter((t) => DONE_STATUSES.includes(t.status)).length,
      hours: own.reduce((sum, t) => sum + Number(t.actualHours), 0),
    };
  });

  const completionRate =
    metrics.totalTasks > 0 ? Math.round((metrics.completedTasks / metrics.totalTasks) * 100) : 0;

  const healthCards = [
    { label: "Tổng task", value: metrics.totalTasks },
    { label: "Hoàn thành", value: metrics.completedTasks },
    { label: "Tỷ lệ hoàn thành", value: `${completionRate}%` },
    { label: "Quá hạn", value: metrics.overdueTasks, alert: metrics.overdueTasks > 0 },
    { label: "Bị chặn", value: metrics.blockedTasks, alert: metrics.blockedTasks > 0 },
    { label: "Bug mở", value: metrics.openBugs, alert: metrics.openBugs > 0 },
    { label: "Bug nghiêm trọng", value: metrics.criticalBugs, alert: metrics.criticalBugs > 0 },
    { label: "Giờ ước tính / thực tế", value: `${metrics.totalEstimateHours} / ${metrics.totalActualHours}` },
  ];

  const maxStatus = Math.max(1, ...[...statusCount.values()]);
  const maxSeverity = Math.max(1, ...[...severityCount.values()]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {healthCards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">{c.label}</CardTitle>
            </CardHeader>
            <CardContent className={`text-xl font-semibold ${c.alert ? "text-destructive" : ""}`}>
              {c.value}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Phân bố trạng thái task</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {TASK_STATUS_ORDER.filter((s) => (statusCount.get(s) ?? 0) > 0).map((s) => {
              const count = statusCount.get(s) ?? 0;
              return (
                <div key={s} className="flex items-center gap-2 text-xs">
                  <span className="w-28 shrink-0 text-muted-foreground">{TASK_STATUS_LABEL[s]}</span>
                  <div className="h-3 flex-1 rounded bg-muted">
                    <div
                      className="h-3 rounded bg-primary/60"
                      style={{ width: `${(count / maxStatus) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-right font-medium">{count}</span>
                </div>
              );
            })}
            {statusCount.size === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có task.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Bug theo mức độ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {BUG_SEVERITY_ORDER.filter((s) => (severityCount.get(s) ?? 0) > 0).map((s) => {
              const count = severityCount.get(s) ?? 0;
              return (
                <div key={s} className="flex items-center gap-2 text-xs">
                  <span className="w-28 shrink-0 text-muted-foreground">{BUG_SEVERITY_LABEL[s]}</span>
                  <div className="h-3 flex-1 rounded bg-muted">
                    <div
                      className="h-3 rounded bg-destructive/60"
                      style={{ width: `${(count / maxSeverity) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-right font-medium">{count}</span>
                </div>
              );
            })}
            {severityCount.size === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có bug.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Khối lượng theo người</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-3 py-2 font-medium">Thành viên</th>
                <th className="px-3 py-2 font-medium">Được giao</th>
                <th className="px-3 py-2 font-medium">Đang làm</th>
                <th className="px-3 py-2 font-medium">Quá hạn</th>
                <th className="px-3 py-2 font-medium">Hoàn thành</th>
                <th className="px-3 py-2 font-medium">Giờ thực tế</th>
              </tr>
            </thead>
            <tbody>
              {workload.map((w) => (
                <tr key={w.name} className="border-b last:border-none">
                  <td className="px-3 py-2">{w.name}</td>
                  <td className="px-3 py-2">{w.assigned}</td>
                  <td className="px-3 py-2">{w.inProgress}</td>
                  <td className={`px-3 py-2 ${w.overdue > 0 ? "font-medium text-destructive" : ""}`}>
                    {w.overdue}
                  </td>
                  <td className="px-3 py-2">{w.done}</td>
                  <td className="px-3 py-2">{w.hours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Burndown</CardTitle>
          <Badge variant="outline">{snapshots.length} ngày</Badge>
        </CardHeader>
        <CardContent>
          {snapshots.length < 2 ? (
            <p className="text-sm text-muted-foreground">
              Cần ít nhất 2 ngày snapshot để vẽ burndown. Snapshot được tạo tự động mỗi ngày.
            </p>
          ) : (
            <Burndown
              points={snapshots.map((s) => ({
                date: s.snapshotDate,
                remaining: s.totalTasks - s.completedTasks,
              }))}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Burndown({ points }: { points: { date: Date; remaining: number }[] }) {
  const w = 640;
  const h = 160;
  const pad = 24;
  const maxRemaining = Math.max(1, ...points.map((p) => p.remaining));
  const stepX = (w - pad * 2) / Math.max(1, points.length - 1);

  const coords = points.map((p, i) => {
    const x = pad + i * stepX;
    const y = h - pad - (p.remaining / maxRemaining) * (h - pad * 2);
    return { x, y };
  });
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

  const idealStart = coords[0];
  const idealEnd = { x: pad + (points.length - 1) * stepX, y: h - pad };

  return (
    <div className="overflow-x-auto">
      <svg width={w} height={h} className="text-primary">
        <line
          x1={idealStart.x}
          y1={idealStart.y}
          x2={idealEnd.x}
          y2={idealEnd.y}
          stroke="currentColor"
          strokeOpacity={0.25}
          strokeDasharray="4 4"
        />
        <path d={path} fill="none" stroke="currentColor" strokeWidth={2} />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={2.5} fill="currentColor" />
        ))}
      </svg>
    </div>
  );
}
