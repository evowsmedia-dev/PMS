import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const DONE_STATUSES = ["DONE", "CANCELLED"] as const;

/**
 * Project-wide health report (personnel status + burndown). Embedded in the
 * project dashboard for users with `report.view`. The headline KPIs and
 * status distributions live in the dashboard's top cards; this section holds
 * the personnel workload and burndown. All metrics are project-wide (no
 * module scoping).
 */
export async function ProjectReportSection({ projectId }: { projectId: string }) {
  const now = new Date();

  const [tasks, totalTasks, overdueTasks, members, snapshots] =
    await Promise.all([
      prisma.task.findMany({
        where: { projectId, deletedAt: null, assigneeId: { not: null } },
        select: { assigneeId: true },
      }),
      prisma.task.count({ where: { projectId, deletedAt: null } }),
      prisma.task.count({
        where: {
          projectId,
          deletedAt: null,
          dueDate: { lt: now },
          status: { notIn: [...DONE_STATUSES] },
        },
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

  // Per-member assigned-task counts for the personnel chart.
  const perMember = members
    .map((m) => ({
      name: m.user.fullName,
      assigned: tasks.filter((t) => t.assigneeId === m.userId).length,
    }))
    .sort((a, b) => b.assigned - a.assigned);
  const maxAssigned = Math.max(1, ...perMember.map((p) => p.assigned));

  const assignedTasks = tasks.length;
  const assignedRatio = totalTasks > 0 ? Math.round((assignedTasks / totalTasks) * 100) : 0;
  const overdueRatio = totalTasks > 0 ? Math.round((overdueTasks / totalTasks) * 100) : 0;

  const staffStats = [
    { label: "Tổng nhân sự", value: members.length },
    { label: "Tỉ lệ task được giao", value: `${assignedRatio}%` },
    { label: "Trễ hạn", value: `${overdueRatio}%`, alert: overdueTasks > 0 },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Trạng thái nhân sự</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              {perMember.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có nhân sự.</p>
              ) : (
                perMember.map((p) => (
                  <div key={p.name} className="flex items-center gap-2 text-xs">
                    <span className="w-28 shrink-0 truncate text-muted-foreground">{p.name}</span>
                    <div className="h-3 flex-1 rounded bg-muted">
                      <div
                        className="h-3 rounded bg-primary/60"
                        style={{ width: `${(p.assigned / maxAssigned) * 100}%` }}
                      />
                    </div>
                    <span className="w-6 text-right font-medium">{p.assigned}</span>
                  </div>
                ))
              )}
            </div>
            <dl className="space-y-1 border-t pt-3 text-sm">
              {staffStats.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">{s.label}</dt>
                  <dd className={`font-medium ${s.alert ? "text-destructive" : ""}`}>{s.value}</dd>
                </div>
              ))}
            </dl>
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
