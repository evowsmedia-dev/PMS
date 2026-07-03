import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteProjectButton } from "@/components/project-danger-actions";
import { PageShell } from "@/components/page-shell";

export default async function ProjectDeleteSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { projectId } = await params;

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!can({ systemRole: session.user.systemRole }, "project.editSettings", projectRole)) {
    redirect(`/projects/${projectId}/overview`);
  }

  const project = await prisma.project.findFirst({ where: { id: projectId, deletedAt: null } });
  if (!project) notFound();

  return (
    <PageShell size="compact">
    <Card>
      <CardHeader>
        <CardTitle>Xóa dự án &quot;{project.name}&quot;</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Hành động này sẽ ẩn dự án khỏi danh sách của mọi thành viên. Toàn bộ tài liệu, task
          và bình luận vẫn được lưu (soft delete) và có thể khôi phục qua audit log.
        </p>
        <DeleteProjectButton projectId={project.id} />
      </CardContent>
    </Card>
    </PageShell>
  );
}
