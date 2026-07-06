import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

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
          title: true,
          assigneeId: true,
          dueDate: true,
          assignee: { select: { fullName: true } },
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
      const workload = getWorkloadStatus(memberTasks.length, dueSoonTasks.length, lateTasks.length);

      return {
        id: m.userId,
        name: m.user.fullName,
        activeTasks: memberTasks.length,
        dueSoonTasks,
        lateTasks,
        workload,
      };
    })
    .sort((a, b) => b.lateTasks.length - a.lateTasks.length || b.activeTasks - a.activeTasks);

  const staffedMembers = perMember.filter((m) => m.activeTasks > 0).length;
  const availableMembers = perMember.filter((m) => m.activeTasks === 0).length;
  const staffedRatio = members.length > 0 ? Math.round((staffedMembers / members.length) * 100) : 0;
  const availableRatio = members.length > 0 ? Math.round((availableMembers / members.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Trạng thái nhân sự</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <section className="rounded-[14px] border border-red-300 bg-red-50 p-4 text-red-700">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-1 size-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase">Cảnh báo rủi ro</p>
                      <p className="text-sm text-red-600">Task trễ hạn / task đang làm</p>
                    </div>
                    <p className="text-4xl font-semibold leading-none">{overdueRatio}%</p>
                  </div>
                  <div className="mt-4 space-y-2">
                    {overdueAssignedTasks.length === 0 ? (
                      <p className="text-sm text-red-600">Không có task được giao đang trễ hạn.</p>
                    ) : (
                      overdueAssignedTasks.slice(0, 5).map((task) => (
                        <p key={task.id} className="text-sm font-medium">
                          {task.title} - {task.assignee?.fullName ?? "Chưa rõ nhân sự"} - Trễ{" "}
                          {getOverdueDays(task.dueDate, now)} ngày
                        </p>
                      ))
                    )}
                    {overdueAssignedTasks.length > 5 ? (
                      <p className="text-xs text-red-600">+{overdueAssignedTasks.length - 5} task trễ hạn khác.</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium">Ma trận phân bổ công việc</h3>
                <p className="text-sm text-muted-foreground">Tập trung người đang quá tải và người còn khả dụng.</p>
              </div>
              <div className="overflow-x-auto rounded-[14px] border">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/60 text-left">
                      <th className="px-3 py-2 font-medium">Nhân sự</th>
                      <th className="px-3 py-2 font-medium">Task đang làm</th>
                      <th className="px-3 py-2 font-medium">Sắp đến hạn</th>
                      <th className="px-3 py-2 font-medium">Đang trễ</th>
                      <th className="px-3 py-2 font-medium">Trạng thái khối lượng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perMember.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-muted-foreground">
                          Chưa có nhân sự.
                        </td>
                      </tr>
                    ) : (
                      perMember.map((member) => (
                        <tr key={member.id} className="border-b last:border-b-0">
                          <td className="px-3 py-2 font-medium">{member.name}</td>
                          <td className="px-3 py-2">{member.activeTasks}</td>
                          <td className="px-3 py-2">
                            {member.dueSoonTasks.length}
                            {member.dueSoonTasks.length > 0 ? (
                              <span className="ml-1 text-muted-foreground">
                                ({member.dueSoonTasks.map((t) => t.title).join(", ")})
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2">
                            {member.lateTasks.length}
                            {member.lateTasks.length > 0 ? (
                              <span className="ml-1 text-red-600">
                                ({member.lateTasks.map((t) => t.title).join(", ")})
                              </span>
                            ) : null}
                          </td>
                          <td className={`px-3 py-2 font-medium ${member.workload.alert ? "text-red-600" : ""}`}>
                            {member.workload.label}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium">Tiến độ & năng lực</h3>
                <p className="text-sm text-muted-foreground">Theo số nhân sự trong dự án và task chưa đóng.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <CapacityBar
                  label="Tỷ lệ nhân sự có việc"
                  value={staffedRatio}
                  detail={`${staffedMembers}/${members.length} người có task`}
                />
                <CapacityBar
                  label="Tỷ lệ nhân sự khả dụng thực tế"
                  value={availableRatio}
                  detail={`${availableMembers}/${members.length} quỹ thời gian đang trống`}
                />
              </div>
            </div>
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

function getOverdueDays(dueDate: Date | null, now: Date) {
  if (!dueDate) return 0;
  return Math.max(1, Math.ceil((now.getTime() - dueDate.getTime()) / DAY_MS));
}

function getWorkloadStatus(active: number, dueSoon: number, late: number) {
  if (late > 0) return { label: "🔴 Quá tải (Cần hỗ trợ)", alert: true };
  if (active === 0) return { label: "🟢 Sẵn sàng (Khuyến khích giao task)", alert: false };
  if (dueSoon > 0) return { label: "Cần theo dõi hạn gần", alert: false };
  if (active <= 2) return { label: "🟢 Nhàn rỗi", alert: false };
  return { label: "Ổn định", alert: false };
}

function CapacityBar({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-[14px] border p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-2xl font-semibold">{value}%</p>
      </div>
      <div className="mt-3 h-2 rounded-full bg-muted">
        <div className="h-2 rounded-full bg-primary" style={{ width: `${value}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
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
