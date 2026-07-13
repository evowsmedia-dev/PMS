import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { computeProjectBiMetrics } from "@/lib/reports/bi-dashboard";
import { ProjectBiDashboardSection } from "@/components/bi-dashboard-section";
import { PageSection, PageToolbar } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";

export default async function ProjectBiDashboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { projectId } = await params;
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true, name: true, code: true },
  });
  if (!project) notFound();

  const projectRole = await getProjectRole(session.user.id, projectId);
  const canViewReports = await canAccess(
    { systemRole: session.user.systemRole },
    "report.view",
    projectRole,
  );
  if (!canViewReports) redirect(`/projects/${projectId}/overview`);

  const metrics = await computeProjectBiMetrics(projectId);
  if (!metrics) notFound();

  return (
    <PageSection>
      <PageToolbar
        title="BI Dashboard"
        description={`${project.code} - ${project.name}`}
      />
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Các chỉ số phase 1 được tính từ dữ liệu task, bug, time log, snapshot và thành viên dự án hiện có.
          Chỉ số chưa có nguồn dữ liệu sẽ hiển thị trạng thái chưa cấu hình thay vì dùng số giả.
        </CardContent>
      </Card>
      <ProjectBiDashboardSection metrics={metrics} />
    </PageSection>
  );
}
