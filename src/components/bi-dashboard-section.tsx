import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveTableFrame } from "@/components/page-shell";
import type { BiDashboardMetrics, ProjectBiSummary } from "@/lib/reports/bi-dashboard";
import { routeSlug } from "@/lib/route-slug";

export function ProjectBiDashboardSection({ metrics }: { metrics: ProjectBiSummary }) {
  return (
    <div className="space-y-4">
      <BiMetricGrid metrics={metrics} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ProgressComparison metrics={metrics} />
        <UnavailableMetrics metrics={metrics} />
      </div>
    </div>
  );
}

export function PortfolioBiDashboardSection({
  metrics,
}: {
  metrics: BiDashboardMetrics;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader title="BI Dashboard tổng quan" description="Tổng hợp các dự án bạn có quyền xem." />
      <BiMetricGrid metrics={metrics} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ProgressComparison metrics={metrics} />
        <UnavailableMetrics metrics={metrics} />
      </div>
    </div>
  );
}

export function AttentionProjectsTable({ projects }: { projects: ProjectBiSummary[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Dự án cần chú ý</CardTitle>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có dự án để phân tích.</p>
        ) : (
          <ResponsiveTableFrame minWidth="min-w-[900px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Dự án</th>
                  <th className="px-4 py-2 text-right">SPI proxy</th>
                  <th className="px-4 py-2 text-right">Trễ hạn</th>
                  <th className="px-4 py-2 text-right">Blocked</th>
                  <th className="px-4 py-2 text-right">Bug mở</th>
                  <th className="px-4 py-2 text-right">Defect rate</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.projectId} className="border-t">
                    <td className="px-4 py-2">
                      <Link href={`/projects/${routeSlug(project.projectCode)}/overview`} className="font-medium hover:underline">
                        {project.projectCode} - {project.projectName}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right">{formatNullable(project.progress.spi, "x")}</td>
                    <td className="px-4 py-2 text-right">{formatNumber(project.quality.overdueTasks)}</td>
                    <td className="px-4 py-2 text-right">{formatNumber(project.quality.blockedTasks)}</td>
                    <td className="px-4 py-2 text-right">{formatNumber(project.quality.openBugs)}</td>
                    <td className="px-4 py-2 text-right">{formatNullable(project.quality.defectRatePercent, "%")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTableFrame>
        )}
      </CardContent>
    </Card>
  );
}

function BiMetricGrid({ metrics }: { metrics: BiDashboardMetrics }) {
  const cards = [
    {
      label: "Progress thực tế",
      value: formatNullable(metrics.progress.actualPercent, "%"),
      helper: `${formatNumber(metrics.effort.actualHours)}h / ${formatNumber(metrics.effort.estimateHours)}h`,
    },
    {
      label: "Target kế hoạch",
      value: formatNullable(metrics.progress.targetPercent, "%"),
      helper: "Theo timeline dự án/task",
    },
    {
      label: "SPI proxy",
      value: formatNullable(metrics.progress.spi, "x"),
      helper: "Actual % / Target %",
      warn: metrics.progress.spi !== null && metrics.progress.spi < 0.8,
    },
    {
      label: "Đúng hạn",
      value: formatNullable(metrics.progress.onTimeCompletionRatePercent, "%"),
      helper: "Done trước hoặc bằng due date",
    },
    {
      label: "Cycle time",
      value: formatNullable(metrics.progress.cycleTimeDays, " ngày"),
      helper: "Trung bình task đã Done",
    },
    {
      label: "Lead time",
      value: formatNullable(metrics.progress.leadTimeDays, " ngày"),
      helper: "Từ tạo yêu cầu đến Done",
    },
    {
      label: "Velocity",
      value: formatNullable(metrics.effort.velocityStoryPoints, " SP/sprint"),
      helper: "Story points Done / sprint",
    },
    {
      label: "Resource utilization",
      value: formatNullable(metrics.effort.resourceUtilizationPercent, "%"),
      helper: "Actual hours / capacity proxy",
    },
    {
      label: "Defect rate",
      value: formatNullable(metrics.quality.defectRatePercent, "%"),
      helper: `${formatNumber(metrics.quality.openBugs)} bug mở`,
      warn: metrics.quality.openBugs > 0,
    },
    {
      label: "Issue resolution",
      value: formatNullable(metrics.quality.issueResolutionRatePercent, "%"),
      helper: "Bug verified/closed",
    },
    {
      label: "Burndown rate",
      value: formatNullable(metrics.progress.burndownRatePercent, "%"),
      helper: "Remaining latest / first snapshot",
    },
    {
      label: "Effort variance",
      value: formatNullable(metrics.effort.effortVariancePercent, "%"),
      helper: "Actual vs estimate",
      warn: (metrics.effort.effortVariancePercent ?? 0) > 20,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <MetricCard key={card.label} {...card} />
      ))}
    </div>
  );
}

function ProgressComparison({ metrics }: { metrics: BiDashboardMetrics }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Tiến độ so với kế hoạch</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ProgressRow label="Actual progress" value={metrics.progress.actualPercent} />
        <ProgressRow label="Target progress" value={metrics.progress.targetPercent} />
        <div className="grid grid-cols-2 gap-3">
          <MiniStat label="Schedule variance" value={formatNullable(metrics.progress.scheduleVariancePercent, "%")} />
          <MiniStat label="Completion rate" value={formatNullable(metrics.progress.completionRatePercent, "%")} />
          <MiniStat label="EV proxy" value={formatNullable(metrics.evm.evProxyPercent, "%")} />
          <MiniStat label="PV proxy" value={formatNullable(metrics.evm.pvProxyPercent, "%")} />
        </div>
      </CardContent>
    </Card>
  );
}

function UnavailableMetrics({ metrics }: { metrics: BiDashboardMetrics }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Chỉ số cần cấu hình thêm dữ liệu</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {metrics.unavailable.map((metric) => (
          <div key={metric.label} className="flex items-center justify-between gap-4 rounded-[10px] border bg-muted/30 px-3 py-2">
            <span className="text-sm font-medium">{metric.label}</span>
            <Badge variant="outline">{metric.value}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MetricCard({
  label,
  value,
  helper,
  warn,
}: {
  label: string;
  value: string;
  helper?: string;
  warn?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
          <span>{label}</span>
          {warn ? <Badge variant="outline">Cần chú ý</Badge> : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold leading-none">{value}</p>
        {helper ? <p className="mt-2 text-xs text-muted-foreground">{helper}</p> : null}
      </CardContent>
    </Card>
  );
}

function ProgressRow({ label, value }: { label: string; value: number | null }) {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{formatNullable(value, "%")}</span>
      </div>
      <div className="h-2 rounded-full border bg-muted">
        <div className="h-full rounded-full bg-foreground" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function formatNullable(value: number | null, suffix: string) {
  if (value === null) return "Chưa đủ dữ liệu";
  return `${formatNumber(value)}${suffix}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value);
}
