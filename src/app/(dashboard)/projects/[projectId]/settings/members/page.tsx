import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddMemberForm, MemberList } from "@/components/project-members";
import { PageShell, PageSection } from "@/components/page-shell";

export default async function ProjectMembersPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { projectId } = await params;

  const projectRole = await getProjectRole(session.user.id, projectId);
  const canManage = can(
    { systemRole: session.user.systemRole },
    "project.manageMembers",
    projectRole,
  );
  if (!canManage) redirect(`/projects/${projectId}/overview`);

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: {
      members: {
        include: { user: { select: { fullName: true, email: true } } },
        orderBy: { addedAt: "asc" },
      },
    },
  });
  if (!project) notFound();

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
          <MemberList projectId={project.id} members={project.members} />
        </CardContent>
      </Card>
      </PageSection>
    </PageShell>
  );
}
