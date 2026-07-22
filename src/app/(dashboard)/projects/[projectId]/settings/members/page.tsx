import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddMemberForm, MemberList } from "@/components/project-members";
import { PageShell, PageSection } from "@/components/page-shell";
import { projectCodeRouteSegment, projectRouteWhere } from "@/lib/route-slug";

export default async function ProjectMembersPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { projectId: projectSegment } = await params;

  const project = await prisma.project.findFirst({
    where: projectRouteWhere(projectSegment),
    include: {
      members: {
        where: { user: { isActive: true } },
        include: {
          user: { select: { fullName: true, email: true } },
          documentTypeAssignments: { select: { moduleId: true } },
        },
        orderBy: { addedAt: "asc" },
      },
      modules: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true },
      },
    },
  });
  if (!project) notFound();
  const projectId = project.id;
  const projectRouteSegment = projectCodeRouteSegment(project);
  if (projectSegment !== projectRouteSegment) redirect(`/projects/${projectRouteSegment}/settings/members`);

  const projectRole = await getProjectRole(session.user.id, projectId);
  const canManage = await canAccess(
    { systemRole: session.user.systemRole },
    "project.manageMembers",
    projectRole,
  );
  if (!canManage) redirect(`/projects/${projectId}/overview`);

  return (
    <PageShell size="compact">
      <PageSection>
      <Card>
        <CardHeader>
          <CardTitle>Thêm thành viên</CardTitle>
        </CardHeader>
        <CardContent>
          <AddMemberForm projectId={project.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Thành viên dự án ({project.members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <MemberList projectId={project.id} members={project.members} modules={project.modules} />
        </CardContent>
      </Card>
      </PageSection>
    </PageShell>
  );
}
