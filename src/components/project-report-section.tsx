import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const DONE_STATUSES = ["DONE", "CANCELLED"] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Project-wide health report (personnel status + burndown). Embedded in the
 * project dashboard for users with `report.view`. The headline KPIs and
 * status distributions live in the dashboard's top cards; this section holds
 * the personnel workload and burndown. All metrics are project-wide (no
 * module scoping).
 */
export async function ProjectReportSection({ projectId }: { projectId: string }) {
  const now = new Date();
  const soon = new Date(now.getTime() + 3 * DAY_MS);

  const [activeAssignedTasks, members, snapshots] =
    await Promise.all([
      prisma.task.findMany({
        where: {
          projectId,
          deletedAt: null,
          assigneeId: { not: null },
          status: { notIn: [...DONE_STATUSES] },
        },
        select: {
          id: true,
          assigneeId: true,
          dueDate: true,
        },
        orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
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

  const overdueAssignedTasks = activeAssignedTasks.filter((t) => t.dueDate && t.dueDate < now);
  const overdueRatio =
    activeAssignedTasks.length > 0
      ? Math.round((overdueAssignedTasks.length / activeAssignedTasks.length) * 100)
      : 0;

  const perMember = members
    .map((m) => {
      const memberTasks = activeAssignedTasks.filter((t) => t.assigneeId === m.userId);
      const dueSoonTasks = memberTasks.filter((t) => t.dueDate && t.dueDate >= now && t.dueDate <= soon);
      const lateTasks = memberTasks.filter((t) => t.dueDate && t.dueDate < now);

      return {
        id: m.userId,
        name: m.user.fullName,
        activeTasks: memberTasks.length,
        dueSoonTasks: dueSoonTasks.length,
        lateTasks: lateTasks.length,
        available: memberTasks.length === 0 ? 1 : 0,
      };
    })
    .sort((a, b) => b.lateTasks - a.lateTasks || b.dueSoonTasks - a.dueSoonTasks || b.activeTasks - a.activeTasks);

  const heatmapMax = {
    activeTasks: Math.max(1, ...perMember.map((m) => m.activeTasks)),
    dueSoonTasks: Math.max(1, ...perMember.map((m) => m.dueSoonTasks)),
    lateTasks: Math.max(1, ...perMember.map((m) => m.lateTasks)),
    available: 1,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Rủi ro &amp; phân bổ nhân sự</CardTitle>
          </CardHeader>
          <CardContent>
            {perMember.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có nhân sự.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <HeatmapSummary label="Task đang làm" value={activeAssignedTasks.length} />
                  <HeatmapSummary
                    label="Sắp đến hạn"
                    value={perMember.reduce((sum, m) => sum + m.dueSoonTasks, 0)}
                  />
                  <HeatmapSummary label="Trễ hạn" value={overdueAssignedTasks.length} />
                  <HeatmapSummary label="Rủi ro" value={`${overdueRatio}%`} />
                </div>

                <div className="overflow-x-auto rounded-[14px] border bg-background p-3">
                  <div className="grid min-w-[560px] gap-2">
                    <div className="grid grid-cols-[150px_repeat(4,minmax(72px,1fr))] gap-2 text-xs font-medium text-muted-foreground">
                      <div>Nhân sự</div>
                      <div className="text-center">Đang làm</div>
                      <div className="text-center">Sắp hạn</div>
                      <div className="text-center">Trễ hạn</div>
                      <div className="text-center">Khả dụng</div>
                    </div>

                    {perMember.map((member) => (
                      <div key={member.id} className="grid grid-cols-[150px_repeat(4,minmax(72px,1fr))] gap-2">
                        <div className="flex min-w-0 items-center rounded-[10px] border bg-muted/40 px-3 text-sm font-medium">
                          <span className="truncate">{member.name}</span>
                        </div>
                        <HeatmapCell value={member.activeTasks} max={heatmapMax.activeTasks} />
                        <HeatmapCell value={member.dueSoonTasks} max={heatmapMax.dueSoonTasks} />
                        <HeatmapCell value={member.lateTasks} max={heatmapMax.lateTasks} />
                        <HeatmapCell value={member.available} max={heatmapMax.available} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Chú giải:</span>
                  <span>ô đen càng nhiều là giá trị càng cao trong cùng một cột</span>
                  <span>-</span>
                  <span>khả dụng = không có task đang làm</span>
                </div>
              </div>
            )}
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

function HeatmapSummary({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-[14px] border bg-muted/30 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold leading-none text-foreground">{value}</p>
    </div>
  );
}

function HeatmapCell({
  value,
  max,
}: {
  value: number;
  max: number;
}) {
  return (
    <div
      className="flex min-h-[34px] items-center justify-center gap-2 rounded-[10px] border bg-background px-2"
      title={`${value}`}
    >
      <MicroSquares value={value} max={max} />
      <span className="w-5 text-right text-xs font-medium tabular-nums">{value}</span>
    </div>
  );
}

function MicroSquares({ value, max }: { value: number; max: number }) {
  const total = 16;
  const ratio = Math.min(1, value / Math.max(1, max));
  const filled = value <= 0 ? 0 : Math.max(1, Math.ceil(ratio * total));

  return (
    <div className="grid grid-cols-8 gap-0.5" aria-hidden="true">
      {Array.from({ length: total }).map((_, index) => (
        <span
          key={index}
          className={`size-1 rounded-[1px] ${index < filled ? "bg-foreground" : "bg-muted"}`}
        />
      ))}
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
