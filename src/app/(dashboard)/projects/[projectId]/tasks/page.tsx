import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plus, LayoutGrid } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageSection } from "@/components/page-shell";
import { taskHref } from "@/lib/task-href";
import {
  TASK_STATUS_LABEL,
  TASK_TYPE_LABEL,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_ORDER,
  TASK_PRIORITY_ORDER,
} from "@/lib/validation/task";
import type { Prisma, TaskPriority, TaskStatus } from "@/generated/prisma/client";

export default async function ProjectTasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ status?: string; priority?: string; assigneeId?: string }>;
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
  const isAdmin = session.user.systemRole === "ADMIN";
  if (!isAdmin && !projectRole) redirect("/projects");

  const canCreate = await canAccess({ systemRole: session.user.systemRole }, "task.create", projectRole);

  const where: Prisma.TaskWhereInput = {
    projectId,
    deletedAt: null,
    ...(sp.status ? { status: sp.status as TaskStatus } : {}),
    ...(sp.priority ? { priority: sp.priority as TaskPriority } : {}),
    ...(sp.assigneeId ? { assigneeId: sp.assigneeId } : {}),
  };

  const [tasks, members] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        assignee: { select: { fullName: true } },
        sprint: { select: { name: true } },
        epic: { select: { name: true } },
      },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      take: 300,
    }),
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, fullName: true } } },
    }),
  ]);

  function buildHref(overrides: Record<string, string | undefined>) {
    const next = new URLSearchParams({
      ...(sp.status ? { status: sp.status } : {}),
      ...(sp.priority ? { priority: sp.priority } : {}),
      ...(sp.assigneeId ? { assigneeId: sp.assigneeId } : {}),
    });
    for (const [k, v] of Object.entries(overrides)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    return qs ? `?${qs}` : "?";
  }

  const now = new Date();

  return (
    <PageSection>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Task ({tasks.length})</h1>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/projects/${projectId}/kanban`}>
              <LayoutGrid className="size-4" />
              Kanban
            </Link>
          </Button>
          {canCreate ? (
            <Button asChild size="sm">
              <Link href={`/projects/${projectId}/tasks/new`}>
                <Plus className="size-4" />
                Tạo task
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={buildHref({ status: undefined })}>
          <Badge variant={!sp.status ? "default" : "outline"}>Mọi trạng thái</Badge>
        </Link>
        {TASK_STATUS_ORDER.map((s) => (
          <Link key={s} href={buildHref({ status: sp.status === s ? undefined : s })}>
            <Badge variant={sp.status === s ? "default" : "outline"}>{TASK_STATUS_LABEL[s]}</Badge>
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
        <Link href={buildHref({ assigneeId: sp.assigneeId ? undefined : session.user.id })}>
          <Badge variant={sp.assigneeId === session.user.id ? "default" : "outline"}>Của tôi</Badge>
        </Link>
        {members.map((m) => (
          <Link
            key={m.userId}
            href={buildHref({ assigneeId: sp.assigneeId === m.userId ? undefined : m.userId })}
          >
            <Badge variant={sp.assigneeId === m.userId ? "default" : "outline"}>{m.user.fullName}</Badge>
          </Link>
        ))}
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có task nào.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-3 py-2 font-medium">Mã</th>
                <th className="px-3 py-2 font-medium">Tiêu đề</th>
                <th className="px-3 py-2 font-medium">Loại</th>
                <th className="px-3 py-2 font-medium">Trạng thái</th>
                <th className="px-3 py-2 font-medium">Ưu tiên</th>
                <th className="px-3 py-2 font-medium">Người thực hiện</th>
                <th className="px-3 py-2 font-medium">Hạn</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => {
                const overdue = t.dueDate && t.dueDate < now && t.status !== "DONE";
                return (
                  <tr key={t.id} className="border-b last:border-none hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {t.taskCode ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={taskHref(projectId, t.moduleId, t.id)}
                        className="font-medium hover:underline"
                      >
                        {t.title}
                      </Link>
                      {t.sprint ? (
                        <span className="ml-2 text-xs text-muted-foreground">· {t.sprint.name}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-xs">{TASK_TYPE_LABEL[t.type]}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline">{TASK_STATUS_LABEL[t.status]}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs">{TASK_PRIORITY_LABEL[t.priority]}</td>
                    <td className="px-3 py-2 text-xs">{t.assignee?.fullName ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {t.dueDate ? (
                        <span className={overdue ? "font-medium text-destructive" : ""}>
                          {t.dueDate.toLocaleDateString("vi-VN")}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageSection>
  );
}
