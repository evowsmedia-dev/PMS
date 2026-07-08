import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KanbanBoard } from "@/components/kanban-board";
import { PageSection } from "@/components/page-shell";
import { TaskViewTabs } from "@/components/task-view-tabs";
import { TASK_PRIORITY_ORDER, TASK_PRIORITY_LABEL } from "@/lib/validation/task";
import { normalizeKanbanStatusOrder } from "@/lib/kanban-status-config";
import type { Prisma, TaskPriority } from "@/generated/prisma/client";

export default async function ProjectKanbanPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ assigneeId?: string; priority?: string; sprintId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { projectId } = await params;
  const sp = await searchParams;

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true, kanbanStatusOrder: true },
  });
  if (!project) notFound();

  const projectRole = await getProjectRole(session.user.id, projectId);
  const isAdmin = session.user.systemRole === "ADMIN";
  if (!isAdmin && !projectRole) redirect("/projects");

  const canCreate = await canAccess({ systemRole: session.user.systemRole }, "task.create", projectRole);
  const canMove = await canAccess({ systemRole: session.user.systemRole }, "task.move", projectRole);
  const kanbanStatuses = normalizeKanbanStatusOrder(project.kanbanStatusOrder);

  const where: Prisma.TaskWhereInput = {
    projectId,
    deletedAt: null,
    ...(sp.assigneeId ? { assigneeId: sp.assigneeId } : {}),
    ...(sp.priority ? { priority: sp.priority as TaskPriority } : {}),
    ...(sp.sprintId ? { sprintId: sp.sprintId } : {}),
  };

  const [tasks, members, sprints] = await Promise.all([
    prisma.task.findMany({
      where,
      include: { assignee: { select: { fullName: true } } },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, fullName: true } } },
    }),
    prisma.sprint.findMany({
      where: { projectId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { startDate: "desc" },
    }),
  ]);

  function buildHref(overrides: Record<string, string | undefined>) {
    const next = new URLSearchParams({
      ...(sp.assigneeId ? { assigneeId: sp.assigneeId } : {}),
      ...(sp.priority ? { priority: sp.priority } : {}),
      ...(sp.sprintId ? { sprintId: sp.sprintId } : {}),
    });
    for (const [k, v] of Object.entries(overrides)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    return qs ? `?${qs}` : "?";
  }

  return (
    <PageSection>
      <TaskViewTabs projectId={projectId} active="kanban" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Kanban Board</h1>
        {canCreate ? (
          <Button asChild size="sm">
            <Link href={`/projects/${projectId}/tasks/new`}>
              <Plus className="size-4" />
              Tạo task
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={buildHref({ assigneeId: undefined })}>
          <Badge variant={!sp.assigneeId ? "default" : "outline"}>Tất cả</Badge>
        </Link>
        {members.map((m) => (
          <Link
            key={m.userId}
            href={buildHref({ assigneeId: sp.assigneeId === m.userId ? undefined : m.userId })}
          >
            <Badge variant={sp.assigneeId === m.userId ? "default" : "outline"}>
              {m.user.fullName}
            </Badge>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={buildHref({ priority: undefined })}>
          <Badge variant={!sp.priority ? "default" : "outline"}>Mọi mức ưu tiên</Badge>
        </Link>
        {TASK_PRIORITY_ORDER.map((p) => (
          <Link key={p} href={buildHref({ priority: sp.priority === p ? undefined : p })}>
            <Badge variant={sp.priority === p ? "default" : "outline"}>{TASK_PRIORITY_LABEL[p]}</Badge>
          </Link>
        ))}
        {sprints.length > 0 ? (
          <>
            <Link href={buildHref({ sprintId: undefined })}>
              <Badge variant={!sp.sprintId ? "default" : "outline"}>Mọi sprint</Badge>
            </Link>
            {sprints.map((s) => (
              <Link key={s.id} href={buildHref({ sprintId: sp.sprintId === s.id ? undefined : s.id })}>
                <Badge variant={sp.sprintId === s.id ? "default" : "outline"}>{s.name}</Badge>
              </Link>
            ))}
          </>
        ) : null}
      </div>

      <KanbanBoard
        projectId={projectId}
        moduleId={null}
        initialStatuses={kanbanStatuses}
        canConfigureStatuses={canMove}
        initialTasks={tasks.map((t) => ({
          id: t.id,
          title: t.title,
          taskCode: t.taskCode,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
          moduleId: t.moduleId,
          assignee: t.assignee,
        }))}
      />
    </PageSection>
  );
}
