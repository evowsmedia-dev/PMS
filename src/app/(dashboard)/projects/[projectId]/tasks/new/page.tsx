import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { PageSection } from "@/components/page-shell";
import { CreateTaskOrBug } from "@/components/create-task-or-bug";

export default async function NewProjectTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ parentTaskId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { projectId } = await params;
  const sp = await searchParams;

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true },
  });
  if (!project) notFound();

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!(await canAccess({ systemRole: session.user.systemRole }, "task.create", projectRole))) {
    redirect(`/projects/${projectId}/tasks`);
  }

  const [members, epics, sprints, milestones, documents] = await Promise.all([
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
    prisma.document.findMany({
      where: { projectId, deletedAt: null, module: { deletedAt: null } },
      select: { id: true, title: true, module: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const tasks = await prisma.task.findMany({
    where: { projectId, deletedAt: null },
    select: { id: true, title: true, taskCode: true },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return (
    <PageSection>
      <h1 className="text-lg font-semibold">Tạo mới</h1>
      <CreateTaskOrBug
        projectId={projectId}
        members={members.map((m) => ({ userId: m.userId, fullName: m.user.fullName }))}
        epics={epics.map((e) => ({ id: e.id, label: e.name }))}
        sprints={sprints.map((s) => ({ id: s.id, label: s.name }))}
        milestones={milestones.map((m) => ({ id: m.id, label: m.name }))}
        tasks={tasks.map((t) => ({ id: t.id, label: `${t.taskCode ? t.taskCode + " · " : ""}${t.title}` }))}
        documents={documents.map((document) => ({
          id: document.id,
          label: `${document.module.name} · ${document.title}`,
        }))}
        defaultParentTaskId={sp.parentTaskId}
      />
    </PageSection>
  );
}
