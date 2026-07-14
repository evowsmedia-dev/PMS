import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectEditForm } from "@/components/project-settings-forms";
import { ArchiveProjectButton } from "@/components/project-danger-actions";
import { PageShell, PageSection } from "@/components/page-shell";
import { projectCodeRouteSegment, projectRouteWhere } from "@/lib/route-slug";

export default async function ProjectEditSettingsPage({
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
  if (projectSegment !== projectRouteSegment) redirect(`/projects/${projectRouteSegment}/settings/edit`);

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!(await canAccess({ systemRole: session.user.systemRole }, "project.editSettings", projectRole))) {
    redirect(`/projects/${projectId}/overview`);
  }

  const subsystems = await prisma.projectSubsystem.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <PageShell size="compact">
      <PageSection>
      <Card>
        <CardHeader>
          <CardTitle>Chỉnh sửa dự án</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectEditForm
            projectId={project.id}
            name={project.name}
            description={project.description ?? ""}
            subsystemId={project.subsystemId ?? ""}
            subsystems={subsystems}
            priority={project.priority}
            highlightNote={project.highlightNote ?? ""}
            startDate={project.startDate ? project.startDate.toISOString().slice(0, 10) : ""}
            endDate={project.endDate ? project.endDate.toISOString().slice(0, 10) : ""}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Lưu trữ</CardTitle>
        </CardHeader>
        <CardContent>
          <ArchiveProjectButton
            projectId={project.id}
            isArchived={project.status === "ARCHIVED"}
          />
        </CardContent>
      </Card>
      </PageSection>
    </PageShell>
  );
}
