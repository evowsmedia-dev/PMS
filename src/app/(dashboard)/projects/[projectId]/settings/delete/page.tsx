import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteProjectButton } from "@/components/project-danger-actions";
import { PageShell } from "@/components/page-shell";
import { projectCodeRouteSegment, projectRouteWhere } from "@/lib/route-slug";

export default async function ProjectDeleteSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { projectId: projectSegment } = await params;

  const project = await prisma.project.findFirst({ where: projectRouteWhere(projectSegment) });
  if (!project) notFound();
  const projectId = project.id;
  const projectRouteSegment = projectCodeRouteSegment(project);
  if (projectSegment !== projectRouteSegment) redirect(`/projects/${projectRouteSegment}/settings/delete`);

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!(await canAccess({ systemRole: session.user.systemRole }, "project.editSettings", projectRole))) {
    redirect(`/projects/${projectId}/overview`);
  }

  return (
    <PageShell size="compact">
    <Card>
      <CardHeader>
        <CardTitle>Xóa dự án &quot;{project.name}&quot;</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Hành động này sẽ xóa vĩnh viễn dự án khỏi hệ thống cùng tài liệu, task và bình luận
          liên quan. Audit log chỉ lưu lịch sử thao tác, không dùng để khôi phục dữ liệu.
        </p>
        <DeleteProjectButton projectId={project.id} />
      </CardContent>
    </Card>
    </PageShell>
  );
}
