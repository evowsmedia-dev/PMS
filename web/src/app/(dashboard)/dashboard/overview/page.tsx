import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityFeed } from "@/components/activity-feed";

export default async function DashboardOverviewPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isAdmin = session.user.systemRole === "ADMIN";
  const projectFilter = isAdmin
    ? { deletedAt: null }
    : { deletedAt: null, members: { some: { userId: session.user.id } } };

  const [projectCount, moduleCount, documentCount, taskCount] = await Promise.all([
    prisma.project.count({ where: projectFilter }),
    prisma.module.count({ where: { deletedAt: null, project: projectFilter } }),
    prisma.document.count({ where: { deletedAt: null, project: projectFilter } }),
    prisma.task.count({ where: { deletedAt: null, project: projectFilter } }),
  ]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Hoạt động gần đây</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityFeed userId={session.user.id} systemRole={session.user.systemRole} limit={10} />
        </CardContent>
      </Card>
    </div>
  );
}
