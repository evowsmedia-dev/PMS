import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { canAccessModule, getAssignedModuleIdsForUser } from "@/lib/document-type-access";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KanbanBoard } from "@/components/kanban-board";
import { PageSection } from "@/components/page-shell";
import { TASK_STATUS_ORDER } from "@/lib/validation/task";
import { makeKanbanStatusColumn } from "@/lib/kanban-status-config";
import { Plus } from "lucide-react";
import type { Prisma, TaskPriority } from "@/generated/prisma/client";

export default async function ModuleTasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; moduleId: string }>;
  searchParams: Promise<{ assigneeId?: string; priority?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { projectId, moduleId } = await params;
  const sp = await searchParams;

  const module_ = await prisma.module.findFirst({ where: { id: moduleId, projectId } });
  if (!module_) notFound();

  const projectRole = await getProjectRole(session.user.id, projectId);
  const canCreate = await canAccess({ systemRole: session.user.systemRole }, "task.create", projectRole);
  const assignedModuleIds = await getAssignedModuleIdsForUser({
    projectId,
    userId: session.user.id,
    systemRole: session.user.systemRole,
    projectRole,
  });
  if (!canAccessModule(assignedModuleIds, moduleId)) redirect(`/projects/${projectId}/overview`);

  const where: Prisma.TaskWhereInput = {
    projectId,
    moduleId,
    deletedAt: null,
    ...(sp.assigneeId ? { assigneeId: sp.assigneeId } : {}),
    ...(sp.priority ? { priority: sp.priority as TaskPriority } : {}),
  };

  const [tasks, members] = await Promise.all([
    prisma.task.findMany({
      where,
      include: { assignee: { select: { fullName: true } } },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, fullName: true } } },
    }),
  ]);

  function buildHref(overrides: Record<string, string | undefined>) {
    const next = new URLSearchParams({
      ...(sp.assigneeId ? { assigneeId: sp.assigneeId } : {}),
      ...(sp.priority ? { priority: sp.priority } : {}),
      ...overrides,
    });
    for (const [k, v] of Object.entries(overrides)) {
      if (!v) next.delete(k);
    }
    return `?${next.toString()}`;
  }

  return (
    <PageSection>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Kanban Board</h1>
        {canCreate ? (
          <Button asChild size="sm">
            <Link href={`/projects/${projectId}/modules/${moduleId}/tasks/new`}>
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
        {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => (
          <Link key={p} href={buildHref({ priority: sp.priority === p ? undefined : p })}>
            <Badge variant={sp.priority === p ? "default" : "outline"}>{p}</Badge>
          </Link>
        ))}
      </div>

      <KanbanBoard
        projectId={projectId}
        moduleId={moduleId}
        initialColumns={TASK_STATUS_ORDER.map((status) => makeKanbanStatusColumn([status]))}
        canConfigureStatuses={false}
        initialTasks={tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
          assignee: t.assignee,
        }))}
      />
    </PageSection>
  );
}
