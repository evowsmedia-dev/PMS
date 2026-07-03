import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell, PageSection } from "@/components/page-shell";

export default async function DashboardOverviewPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isAdmin = session.user.systemRole === "ADMIN";
  const projectFilter = isAdmin
    ? { deletedAt: null }
    : { deletedAt: null, members: { some: { userId: session.user.id } } };

  const [projectCount, projectsWithModuleCounts, documentCount, taskCount] = await Promise.all([
    prisma.project.count({ where: projectFilter }),
    prisma.project.findMany({
      where: projectFilter,
      select: { _count: { select: { modules: { where: { deletedAt: null } } } } },
    }),
    prisma.document.count({ where: { deletedAt: null, project: projectFilter } }),
    prisma.task.count({ where: { deletedAt: null, project: projectFilter } }),
  ]);
  const moduleCount = projectsWithModuleCounts.reduce(
    (sum, project) => sum + project._count.modules,
    0,
  );

  return (
    <PageShell size="standard">
      <PageSection>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Tổng dự án</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{projectCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Tổng phân hệ</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{moduleCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Tổng tài liệu</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{documentCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Tổng task</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{taskCount}</CardContent>
        </Card>
      </div>
      </PageSection>
    </PageShell>
  );
}
