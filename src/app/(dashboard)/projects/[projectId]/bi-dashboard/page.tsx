import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { computeProjectBiMetrics } from "@/lib/reports/bi-dashboard";
import type { ProjectBiSummary } from "@/lib/reports/bi-dashboard";
import {
  ProjectBiDashboardTabs,
  ProjectBiExecutiveSection,
  ProjectBiManagerSection,
} from "@/components/bi-dashboard-section";
import { BiDashboardAutoRefresh } from "@/components/bi-dashboard-auto-refresh";
import { BiDashboardSyncButton } from "@/components/bi-dashboard-sync-button";
import { PageSection, PageToolbar } from "@/components/page-shell";
import { projectCodeRouteSegment, projectRouteWhere } from "@/lib/route-slug";

export default async function ProjectBiDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { projectId: projectSegment } = await params;
  const project = await prisma.project.findFirst({
    where: projectRouteWhere(projectSegment),
    select: { id: true, name: true, code: true },
  });
  if (!project) notFound();
  const projectId = project.id;
  const projectRouteSegment = projectCodeRouteSegment(project);
  if (projectSegment !== projectRouteSegment) redirect(`/projects/${projectRouteSegment}/bi-dashboard`);

  const projectRole = await getProjectRole(session.user.id, projectId);
  const canViewReports = await canAccess(
    { systemRole: session.user.systemRole },
    "report.view",
    projectRole,
  );
  if (!canViewReports) redirect(`/projects/${projectId}/overview`);

  const metrics = await computeProjectBiMetrics(projectId);
  if (!metrics) notFound();
  const summary = buildBiSummary(metrics);
  const sp = await searchParams;
  const activeView = sp.view === "manager" ? "manager" : "executive";

  return (
    <PageSection>
      <BiDashboardAutoRefresh intervalMs={activeView === "manager" ? 60_000 : 300_000} />
      <PageToolbar
        title="BI Dashboard"
        description={`${project.code} - ${project.name}`}
        actions={<BiDashboardSyncButton projectId={projectId} />}
      />
      <ProjectBiDashboardTabs activeView={activeView} projectRouteSegment={projectRouteSegment} />
      {activeView === "manager" ? (
        <ProjectBiManagerSection metrics={metrics} summary={summary} />
      ) : (
        <ProjectBiExecutiveSection metrics={metrics} projectRouteSegment={projectRouteSegment} summary={summary} />
      )}
    </PageSection>
  );
}

function buildBiSummary(metrics: ProjectBiSummary) {
  const summary: string[] = [];
  const actual = metrics.progress.actualPercent;
  const target = metrics.progress.targetPercent;
  const spi = metrics.progress.spi;
  const completion = metrics.progress.completionRatePercent;
  const effortVariance = metrics.effort.effortVariancePercent;
  const utilization = metrics.effort.resourceUtilizationPercent;

  if (metrics.counts.tasks === 0) {
    return [
      "Dự án chưa có task active để phân tích tiến độ, effort và chất lượng.",
      "Hãy tạo task, estimate và time log để dashboard có thể đưa ra nhận xét vận hành chính xác hơn.",
    ];
  }

  if (actual !== null && target !== null) {
    const diff = actual - target;
    if (diff < -10) {
      summary.push(
        `Tiến độ thực tế đang thấp hơn kế hoạch ${formatPercent(Math.abs(diff))}; SPI proxy hiện là ${formatRatio(spi)}, cần rà soát các task trễ hoặc blocked.`,
      );
    } else if (diff > 10) {
      summary.push(
        `Tiến độ thực tế đang cao hơn kế hoạch ${formatPercent(diff)}; SPI proxy hiện là ${formatRatio(spi)}, dự án đang có tín hiệu vượt nhịp kế hoạch.`,
      );
    } else {
      summary.push(
        `Tiến độ thực tế đang bám sát kế hoạch với chênh lệch ${formatPercent(diff)}; SPI proxy hiện là ${formatRatio(spi)}.`,
      );
    }
  } else {
    summary.push("Dữ liệu ngày kế hoạch hoặc estimate chưa đủ để so sánh tiến độ thực tế với target.");
  }

  const riskParts = [];
  if (metrics.quality.overdueTasks > 0) riskParts.push(`${metrics.quality.overdueTasks} task quá hạn`);
  if (metrics.quality.blockedTasks > 0) riskParts.push(`${metrics.quality.blockedTasks} task blocked`);
  if (metrics.quality.openBugs > 0) riskParts.push(`${metrics.quality.openBugs} bug mở`);
  if (riskParts.length > 0) {
    summary.push(`Điểm cần chú ý hiện tại: ${riskParts.join(", ")}.`);
  } else {
    summary.push("Chưa ghi nhận task quá hạn, task blocked hoặc bug mở trong dữ liệu hiện tại.");
  }

  if (effortVariance !== null) {
    if (effortVariance > 20) {
      summary.push(
        `Actual effort đang vượt estimate ${formatPercent(effortVariance)} (${formatHours(metrics.effort.actualHours)} / ${formatHours(metrics.effort.estimateHours)}), nên kiểm tra scope hoặc chất lượng estimate.`,
      );
    } else if (effortVariance < -20) {
      summary.push(
        `Actual effort đang thấp hơn estimate ${formatPercent(Math.abs(effortVariance))}; cần xác nhận team đã log giờ đầy đủ trước khi kết luận tiết kiệm effort.`,
      );
    } else {
      summary.push(
        `Effort đang trong vùng kiểm soát: ${formatHours(metrics.effort.actualHours)} actual so với ${formatHours(metrics.effort.estimateHours)} estimate.`,
      );
    }
  } else {
    summary.push("Chưa đủ estimate/time log để đánh giá chênh lệch effort.");
  }

  if (completion !== null) {
    summary.push(`Tỷ lệ hoàn thành hiện tại là ${formatPercent(completion)} trên ${metrics.counts.tasks} task được tính.`);
  }

  if (utilization !== null) {
    summary.push(`Resource utilization proxy hiện là ${formatPercent(utilization)}, tính theo actual hours trên capacity proxy của thành viên dự án.`);
  }

  return summary;
}

function formatPercent(value: number) {
  return `${formatNumber(value)}%`;
}

function formatRatio(value: number | null) {
  return value === null ? "chưa đủ dữ liệu" : `${formatNumber(value)}x`;
}

function formatHours(value: number) {
  return `${formatNumber(value)}h`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value);
}
