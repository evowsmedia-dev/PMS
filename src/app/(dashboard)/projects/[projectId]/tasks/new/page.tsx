import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { PageSection } from "@/components/page-shell";
import { TaskProjectCreateForm } from "@/components/task-project-create-form";

export default async function NewProjectTaskPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { projectId } = await params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true },
  });
  if (!project) notFound();

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!(await canAccess({ systemRole: session.user.systemRole }, "task.create", projectRole))) {
    redirect(`/projects/${projectId}/tasks`);
  }

  const [members, epics, sprints, milestones] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, fullName: true } } },
    }),
    prisma.epic.findMany({
      where: { projectId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.sprint.findMany({
      where: { projectId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { startDate: "desc" },
    }),
    prisma.milestone.findMany({
      where: { projectId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  return (
    <PageSection>
      <h1 className="text-lg font-semibold">Tạo task mới</h1>
      <TaskProjectCreateForm
        projectId={projectId}
        members={members.map((m) => ({ userId: m.userId, fullName: m.user.fullName }))}
        epics={epics.map((e) => ({ id: e.id, label: e.name }))}
        sprints={sprints.map((s) => ({ id: s.id, label: s.name }))}
        milestones={milestones.map((m) => ({ id: m.id, label: m.name }))}
      />
    </PageSection>
  );
}
