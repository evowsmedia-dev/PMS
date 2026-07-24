import Link from "next/link";
import { Activity, BarChart3, ChevronRight, CircleHelp, Gauge, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ResponsiveTableFrame } from "@/components/page-shell";
import type { BiDashboardMetrics, PortfolioBiMetrics, ProjectBiSummary } from "@/lib/reports/bi-dashboard";
import { routeSlug } from "@/lib/route-slug";

export function ProjectBiDashboardTabs({
  activeView,
  projectRouteSegment,
}: {
  activeView: "executive" | "manager";
  projectRouteSegment: string;
}) {
  const tabs = [
    { value: "executive", label: "Quản lý cấp cao", helper: "Tuần / tháng" },
    { value: "manager", label: "Quản lý cấp trung", helper: "Giờ / ngày" },
  ] as const;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-1">
      {tabs.map((tab) => {
        const active = activeView === tab.value;
        return (
          <Link
            key={tab.value}
            href={`/projects/${projectRouteSegment}/bi-dashboard?view=${tab.value}`}
            className={
              active
                ? "rounded-md border bg-background px-3 py-2 text-sm font-semibold text-foreground"
                : "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground"
            }
          >
            <span>{tab.label}</span>
            <span className="ml-2 text-xs font-normal text-muted-foreground">{tab.helper}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function ProjectBiExecutiveSection({
  metrics,
  projectRouteSegment,
  summary,
}: {
  metrics: ProjectBiSummary;
  projectRouteSegment: string;
  summary: string[];
}) {
  const health = healthStatus(metrics);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Sức khỏe dự án" value={health.label} helper={health.helper} variant={health.variant} />
        <MetricCard label="Tiến độ tổng" value={formatNullable(metrics.progress.completionRatePercent, "%")} helper={`${metrics.counts.completedTasks}/${metrics.counts.tasks} task`} />
        <MetricCard label="SPI proxy" value={formatNullable(metrics.progress.spi, "x")} helper="Actual progress / target progress" variant={metrics.progress.spi !== null && metrics.progress.spi < 0.8 ? "warning" : "neutral"} />
        <MetricCard label="Dự toán timeline" value={formatVnd(metrics.forecast.timelineAmountVnd)} helper={`${formatNumber(metrics.forecast.timelineMandays)} ngày công`} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-start gap-2 text-base">
              <span>Tổng quan chiến lược dự án</span>
              <MetricHelp label="Tổng quan chiến lược dự án" explanation={metricExplanation("Tổng quan chiến lược dự án")} />
            </CardTitle>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={`/projects/${projectRouteSegment}/bi-dashboard?view=manager`}>
              Drill-down cấp trung
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <ProgressComparison metrics={metrics} />
            <ExecutiveRiskPanel metrics={metrics} />
          </div>
          <SummaryPanel title="Nhận xét tóm tắt" items={summary} />
        </CardContent>
      </Card>

      <UnavailableMetrics metrics={metrics} />
    </div>
  );
}

export function ProjectBiManagerSection({ metrics, summary }: { metrics: ProjectBiSummary; summary: string[] }) {
  return (
    <div className="space-y-4">
      <BiMetricGrid metrics={metrics} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ProgressComparison metrics={metrics} />
        <ExecutiveRiskPanel metrics={metrics} />
      </div>
      <MemberPerformanceTable members={metrics.members} />
      <SummaryPanel title="Hành động đề xuất" items={summary} />
      <UnavailableMetrics metrics={metrics} />
    </div>
  );
}

export function PortfolioBiDashboardSection({ portfolio }: { portfolio: PortfolioBiMetrics }) {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="BI Dashboard tổng hợp"
        description="Tổng hợp toàn bộ dự án bạn có quyền xem; click dự án để drill-down vào BI riêng của dự án."
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Tổng dự án" value={formatNumber(portfolio.totals.projectCount)} helper="Dự án active trong phạm vi quyền" />
        <MetricCard label="Tỷ lệ hoàn thành" value={formatNullable(portfolio.aggregate.progress.completionRatePercent, "%")} helper={`${portfolio.totals.completedTasks}/${portfolio.totals.activeTasks + portfolio.totals.completedTasks} task`} />
        <MetricCard label="Task cần chú ý" value={formatNumber(portfolio.totals.overdueTasks + portfolio.totals.blockedTasks)} helper={`${portfolio.totals.overdueTasks} quá hạn, ${portfolio.totals.blockedTasks} blocked`} variant={portfolio.totals.overdueTasks + portfolio.totals.blockedTasks > 0 ? "warning" : "neutral"} />
        <MetricCard label="Actual / Estimate" value={`${formatNumber(portfolio.totals.totalActualHours)}h`} helper={`${formatNumber(portfolio.totals.totalEstimateHours)}h estimate`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ProgressComparison metrics={portfolio.aggregate} />
        <ExecutiveRiskPanel metrics={portfolio.aggregate} />
      </div>
      <AttentionProjectsTable projects={portfolio.attentionProjects} />
      <UnavailableMetrics metrics={portfolio.aggregate} />
    </div>
  );
}

export function AttentionProjectsTable({ projects }: { projects: ProjectBiSummary[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-start justify-between gap-2 text-sm">
          <span>Dự án cần chú ý</span>
          <MetricHelp label="Dự án cần chú ý" explanation={metricExplanation("Dự án cần chú ý")} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có dự án để phân tích.</p>
        ) : (
          <ResponsiveTableFrame minWidth="min-w-[960px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Dự án</th>
                  <th className="px-4 py-2 text-right">Health score</th>
                  <th className="px-4 py-2 text-right">SPI proxy</th>
                  <th className="px-4 py-2 text-right">Trễ hạn</th>
                  <th className="px-4 py-2 text-right">Blocked</th>
                  <th className="px-4 py-2 text-right">Bug mở</th>
                  <th className="px-4 py-2 text-right">Dự toán</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.projectId} className="border-t">
                    <td className="px-4 py-2">
                      <Link href={`/projects/${routeSlug(project.projectCode)}/bi-dashboard?view=executive`} className="font-medium hover:underline">
                        {project.projectCode} - {project.projectName}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right">{formatNumber(project.riskScore)}</td>
                    <td className="px-4 py-2 text-right">{formatNullable(project.progress.spi, "x")}</td>
                    <td className="px-4 py-2 text-right">{formatNumber(project.quality.overdueTasks)}</td>
                    <td className="px-4 py-2 text-right">{formatNumber(project.quality.blockedTasks)}</td>
                    <td className="px-4 py-2 text-right">{formatNumber(project.quality.openBugs)}</td>
                    <td className="px-4 py-2 text-right">{formatVnd(project.forecast.timelineAmountVnd)}</td>
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
    { label: "Progress thực tế", value: formatNullable(metrics.progress.actualPercent, "%"), helper: `${formatNumber(metrics.effort.actualHours)}h / ${formatNumber(metrics.effort.estimateHours)}h` },
    { label: "Target kế hoạch", value: formatNullable(metrics.progress.targetPercent, "%"), helper: "Theo timeline dự án/task" },
    { label: "SPI proxy", value: formatNullable(metrics.progress.spi, "x"), helper: "Actual % / Target %", warn: metrics.progress.spi !== null && metrics.progress.spi < 0.8 },
    { label: "Đúng hạn", value: formatNullable(metrics.progress.onTimeCompletionRatePercent, "%"), helper: "Done trước hoặc bằng due date" },
    { label: "Cycle time", value: formatNullable(metrics.progress.cycleTimeDays, " ngày"), helper: "Trung bình task đã Done" },
    { label: "Lead time", value: formatNullable(metrics.progress.leadTimeDays, " ngày"), helper: "Từ tạo yêu cầu đến Done" },
    { label: "Velocity", value: formatNullable(metrics.effort.velocityStoryPoints, " SP/sprint"), helper: "Story points Done / sprint" },
    { label: "Resource utilization", value: formatNullable(metrics.effort.resourceUtilizationPercent, "%"), helper: "Actual hours / capacity proxy" },
    { label: "Defect rate", value: formatNullable(metrics.quality.defectRatePercent, "%"), helper: `${formatNumber(metrics.quality.openBugs)} bug mở`, warn: metrics.quality.openBugs > 0 },
    { label: "Issue resolution", value: formatNullable(metrics.quality.issueResolutionRatePercent, "%"), helper: "Bug verified/closed" },
    { label: "Burndown rate", value: formatNullable(metrics.progress.burndownRatePercent, "%"), helper: "Remaining latest / first snapshot" },
    { label: "Effort variance", value: formatNullable(metrics.effort.effortVariancePercent, "%"), helper: "Actual vs estimate", warn: (metrics.effort.effortVariancePercent ?? 0) > 20 },
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
        <CardTitle className="flex items-start justify-between gap-2 text-sm">
          <span className="flex items-center gap-2">
            <BarChart3 className="size-4" />
            Tiến độ so với kế hoạch
          </span>
          <MetricHelp label="Tiến độ so với kế hoạch" explanation={metricExplanation("Tiến độ so với kế hoạch")} />
        </CardTitle>
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

function ExecutiveRiskPanel({ metrics }: { metrics: BiDashboardMetrics }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-start justify-between gap-2 text-sm">
          <span className="flex items-center gap-2">
            <Gauge className="size-4" />
            Rủi ro nổi bật
          </span>
          <MetricHelp label="Rủi ro nổi bật" explanation={metricExplanation("Rủi ro nổi bật")} />
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <MiniStat label="Task quá hạn" value={formatNumber(metrics.quality.overdueTasks)} />
        <MiniStat label="Task blocked" value={formatNumber(metrics.quality.blockedTasks)} />
        <MiniStat label="Bug mở" value={formatNumber(metrics.quality.openBugs)} />
        <MiniStat label="Critical bug" value={formatNumber(metrics.quality.criticalBugs)} />
      </CardContent>
    </Card>
  );
}

function MemberPerformanceTable({ members }: { members: ProjectBiSummary["members"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-start justify-between gap-2 text-sm">
          <span className="flex items-center gap-2">
            <Users className="size-4" />
            Hiệu suất thành viên nhóm
          </span>
          <MetricHelp label="Hiệu suất thành viên nhóm" explanation={metricExplanation("Hiệu suất thành viên nhóm")} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">Dự án chưa có thành viên để phân tích nguồn lực.</p>
        ) : (
          <ResponsiveTableFrame minWidth="min-w-[1040px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Nhân sự</th>
                  <th className="px-4 py-2">Vai trò</th>
                  <th className="px-4 py-2 text-right">Task active</th>
                  <th className="px-4 py-2 text-right">Hoàn thành</th>
                  <th className="px-4 py-2 text-right">Quá hạn</th>
                  <th className="px-4 py-2 text-right">Ngày công được giao</th>
                  <th className="px-4 py-2 text-right">Actual</th>
                  <th className="px-4 py-2 text-right">Actual / ngày công</th>
                  <th className="px-4 py-2 text-right">Estimate</th>
                  <th className="px-4 py-2 text-right">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.userId} className="border-t">
                    <td className="px-4 py-2 font-medium">{member.name}</td>
                    <td className="px-4 py-2">{member.role}</td>
                    <td className="px-4 py-2 text-right">{formatNumber(member.activeTasks)}</td>
                    <td className="px-4 py-2 text-right">{formatNumber(member.completedTasks)}</td>
                    <td className="px-4 py-2 text-right">{formatNumber(member.overdueTasks)}</td>
                    <td className="px-4 py-2 text-right">{formatNumber(member.assignedMandays)} ngày</td>
                    <td className="px-4 py-2 text-right">{formatNumber(member.actualHours)}h</td>
                    <td className="px-4 py-2 text-right">{formatNullable(member.assignedMandayUtilizationPercent, "%")}</td>
                    <td className="px-4 py-2 text-right">{formatNumber(member.estimateHours)}h</td>
                    <td className="px-4 py-2 text-right">{formatNullable(member.utilizationPercent, "%")}</td>
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

function UnavailableMetrics({ metrics }: { metrics: BiDashboardMetrics }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-start justify-between gap-2 text-sm">
          <span>Chỉ số cần cấu hình thêm dữ liệu</span>
          <MetricHelp label="Chỉ số cần cấu hình thêm dữ liệu" explanation={metricExplanation("Chỉ số cần cấu hình thêm dữ liệu")} />
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 md:grid-cols-2">
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

function SummaryPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-start justify-between gap-2 text-sm">
          <span className="flex items-center gap-2">
            <Activity className="size-4" />
            {title}
          </span>
          <MetricHelp label={title} explanation={metricExplanation(title)} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {items.map((item) => (
            <li key={item} className="leading-6">
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function MetricCard({
  label,
  value,
  helper,
  warn,
  variant,
}: {
  label: string;
  value: string;
  helper?: string;
  warn?: boolean;
  variant?: "neutral" | "success" | "warning" | "danger";
}) {
  const badgeVariant = variant ?? (warn ? "warning" : "neutral");
  const explanation = metricExplanation(label);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-start justify-between gap-2 text-xs font-medium text-muted-foreground">
          <span>{label}</span>
          <span className="flex items-center gap-1">
            {warn || variant ? <Badge variant={badgeVariant} className="status-badge">Live</Badge> : null}
            <MetricHelp label={label} explanation={explanation} />
          </span>
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
  const explanation = metricExplanation(label);
  return (
    <div className="rounded-[10px] border bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <MetricHelp label={label} explanation={explanation} />
      </div>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function MetricHelp({
  label,
  explanation,
}: {
  label: string;
  explanation: { meaning: string; example: string };
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Giải thích chỉ số ${label}`}
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground hover:text-foreground"
        >
          <CircleHelp className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-sm leading-6 text-muted-foreground">{explanation.meaning}</p>
          <div className="rounded-md border bg-muted/30 p-2 text-sm leading-6">
            <span className="font-medium">Ví dụ: </span>
            <span className="text-muted-foreground">{explanation.example}</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
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

function healthStatus(metrics: ProjectBiSummary) {
  if (metrics.quality.overdueTasks > 0 || metrics.quality.blockedTasks > 0 || (metrics.progress.spi !== null && metrics.progress.spi < 0.8)) {
    return { label: "Cần chú ý", helper: "Có trễ hạn, blocked hoặc SPI thấp", variant: "warning" as const };
  }
  if (metrics.counts.tasks === 0) {
    return { label: "Chưa đủ dữ liệu", helper: "Cần task/time log để đánh giá", variant: "neutral" as const };
  }
  return { label: "Ổn định", helper: "Chưa ghi nhận tín hiệu rủi ro chính", variant: "success" as const };
}

function metricExplanation(label: string) {
  const explanations: Record<string, { meaning: string; example: string }> = {
    "Sức khỏe dự án": {
      meaning: "Đánh giá nhanh tình trạng dự án dựa trên task quá hạn, task blocked và SPI proxy.",
      example: "Nếu có 3 task quá hạn hoặc SPI dưới 0.8, trạng thái sẽ chuyển sang Cần chú ý.",
    },
    "Tiến độ tổng": {
      meaning: "Tỷ lệ task đã hoàn thành trên tổng task active của dự án hoặc danh mục.",
      example: "Hoàn thành 8 trên 20 task thì tiến độ tổng là 40%.",
    },
    "SPI proxy": {
      meaning: "Chỉ số so sánh tiến độ thực tế với tiến độ kế hoạch. Giá trị dưới 1 thường cho thấy chậm nhịp.",
      example: "Actual progress 40% và target 50% thì SPI proxy = 0.8x.",
    },
    "Dự toán timeline": {
      meaning: "Tổng chi phí dự toán lấy từ Timeline dự toán của dự án.",
      example: "10 ngày công x 3.600.000 VND thì dự toán timeline là 36.000.000 VND.",
    },
    "Tổng dự án": {
      meaning: "Số dự án active trong phạm vi quyền xem của user hiện tại.",
      example: "Admin thấy 12 dự án active; user thường chỉ thấy các dự án mình là thành viên.",
    },
    "Tỷ lệ hoàn thành": {
      meaning: "Tỷ lệ task đã Done trên tổng task được tính, không tính task Cancelled.",
      example: "15 task Done trên 30 task được tính thì tỷ lệ hoàn thành là 50%.",
    },
    "Task cần chú ý": {
      meaning: "Tổng số task quá hạn và task blocked cần quản lý xem xét.",
      example: "2 task quá hạn và 1 task blocked thì Task cần chú ý là 3.",
    },
    "Actual / Estimate": {
      meaning: "So sánh tổng giờ thực tế đã log với tổng giờ estimate của task.",
      example: "Actual 80h so với estimate 100h cho thấy đã dùng 80% effort dự kiến.",
    },
    "Progress thực tế": {
      meaning: "Tỷ lệ effort thực tế so với effort estimate của các task được tính.",
      example: "Đã log 40h trên estimate 100h thì progress thực tế là 40%.",
    },
    "Target kế hoạch": {
      meaning: "Tỷ lệ tiến độ kỳ vọng tại thời điểm hiện tại dựa trên ngày bắt đầu/kết thúc kế hoạch.",
      example: "Dự án đi qua nửa timeline kế hoạch thì target kế hoạch khoảng 50%.",
    },
    "Đúng hạn": {
      meaning: "Tỷ lệ task Done trước hoặc đúng due date trong các task Done có due date.",
      example: "8/10 task hoàn thành đúng hạn thì chỉ số đúng hạn là 80%.",
    },
    "Cycle time": {
      meaning: "Thời gian trung bình từ lúc bắt đầu xử lý đến khi task Done.",
      example: "Ba task mất 2, 4, 6 ngày thì cycle time trung bình là 4 ngày.",
    },
    "Lead time": {
      meaning: "Thời gian trung bình từ lúc task được tạo đến khi task Done.",
      example: "Task tạo ngày 1 và Done ngày 6 thì lead time là 5 ngày.",
    },
    Velocity: {
      meaning: "Số story point trung bình hoàn thành theo sprint có task Done.",
      example: "Team hoàn thành 40 story point trong 2 sprint thì velocity là 20 SP/sprint.",
    },
    "Resource utilization": {
      meaning: "Tỷ lệ giờ thực tế đã log so với capacity proxy của thành viên dự án.",
      example: "Team có capacity proxy 320h và log 160h thì utilization là 50%.",
    },
    "Defect rate": {
      meaning: "Tỷ lệ bug mở so với số task deliverable đã hoàn thành.",
      example: "2 bug mở trên 10 task Done thì defect rate là 20%.",
    },
    "Issue resolution": {
      meaning: "Tỷ lệ bug đã Closed hoặc Verified trên tổng bug.",
      example: "6 bug đã xử lý trên tổng 8 bug thì issue resolution là 75%.",
    },
    "Burndown rate": {
      meaning: "Tỷ lệ khối lượng còn lại mới nhất so với snapshot đầu kỳ.",
      example: "Ban đầu còn 20 task, hiện còn 5 task thì burndown rate là 25%.",
    },
    "Effort variance": {
      meaning: "Chênh lệch phần trăm giữa actual effort và estimate effort.",
      example: "Actual 120h so với estimate 100h thì effort variance là +20%.",
    },
    "Schedule variance": {
      meaning: "Chênh lệch giữa tiến độ thực tế và target kế hoạch.",
      example: "Actual 45% và target 60% thì schedule variance là -15%.",
    },
    "Completion rate": {
      meaning: "Tỷ lệ task đã hoàn thành trong phạm vi đang tính.",
      example: "12 task Done trên 40 task active/non-cancelled thì completion rate là 30%.",
    },
    "EV proxy": {
      meaning: "Earned Value proxy, dùng progress thực tế khi chưa có ngân sách BAC thật.",
      example: "Progress thực tế 35% thì EV proxy hiển thị 35%.",
    },
    "PV proxy": {
      meaning: "Planned Value proxy, dùng target kế hoạch khi chưa có ngân sách BAC thật.",
      example: "Theo timeline hôm nay đáng lẽ đạt 50% thì PV proxy là 50%.",
    },
    "Task quá hạn": {
      meaning: "Số task chưa Done nhưng đã quá due date hoặc quá hạn Dev/Test.",
      example: "Một task due hôm qua và chưa Done sẽ được tính là task quá hạn.",
    },
    "Task blocked": {
      meaning: "Số task đang có trạng thái Blocked hoặc bị chặn bởi dependency chưa hoàn thành.",
      example: "Task B phụ thuộc Task A chưa Done thì Task B có thể bị tính blocked.",
    },
    "Bug mở": {
      meaning: "Số bug chưa Closed hoặc Verified.",
      example: "Bug status Open hoặc Reopened sẽ được tính là bug mở.",
    },
    "Critical bug": {
      meaning: "Số bug có mức độ Critical hoặc Blocker.",
      example: "Bug làm người dùng không đăng nhập được thường được xếp Critical/Blocker.",
    },
  };

  return (
    explanations[label] ?? {
      meaning: "Chỉ số này được tính từ dữ liệu live hiện có trong PMS.",
      example: "Khi task, bug hoặc time log thay đổi, chỉ số sẽ cập nhật sau refresh hoặc auto-refresh.",
    }
  );
}

function formatNullable(value: number | null, suffix: string) {
  if (value === null) return "Chưa đủ dữ liệu";
  return `${formatNumber(value)}${suffix}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value);
}

function formatVnd(value: number) {
  if (value <= 0) return "Chưa đủ dữ liệu";
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value)} VND`;
}
