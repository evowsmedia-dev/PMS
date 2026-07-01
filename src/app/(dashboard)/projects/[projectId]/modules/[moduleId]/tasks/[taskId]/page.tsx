import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskEditForm } from "@/components/task-edit-form";
import {
  TaskStatusSelect,
  TaskAssigneeSelect,
  TaskComments,
} from "@/components/task-detail-panel";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; moduleId: string; taskId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { projectId, moduleId, taskId } = await params;

  const task = await prisma.task.findFirst({
    where: { id: taskId, projectId, moduleId, deletedAt: null },
    include: {
      assignee: { select: { fullName: true } },
      relatedDocument: { select: { id: true, title: true } },
      history: { orderBy: { createdAt: "desc" }, include: { changedBy: { select: { fullName: true } } } },
      comments: {
        where: { deletedAt: null },
        include: { author: { select: { fullName: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!task) notFound();

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { fullName: true } } },
  });

  const projectRole = await getProjectRole(session.user.id, projectId);
  const roleCtx = { systemRole: session.user.systemRole };
  const canEdit = can(roleCtx, "task.edit", projectRole);
  const canReassign = can(roleCtx, "task.reassign", projectRole);
  const canComment = can(roleCtx, "comment.create", projectRole);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>{task.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <TaskStatusSelect
                projectId={projectId}
                moduleId={moduleId}
                taskId={taskId}
                status={task.status}
                canEdit={canEdit}
              />
              <TaskAssigneeSelect
                projectId={projectId}
                moduleId={moduleId}
                taskId={taskId}
                assigneeId={task.assigneeId}
                members={members.map((m) => ({ userId: m.userId, fullName: m.user.fullName }))}
                canReassign={canReassign}
              />
            </div>

            {task.relatedDocument ? (
              <p className="text-sm text-muted-foreground">
                Tài liệu liên quan:{" "}
                <Link
                  href={`/projects/${projectId}/modules/${moduleId}/documents/${task.relatedDocument.id}`}
                  className="text-primary hover:underline"
                >
                  {task.relatedDocument.title}
                </Link>
              </p>
            ) : null}
            {task.sourceHighlight ? (
              <p className="rounded-md bg-muted p-2 text-sm italic text-muted-foreground">
                &quot;{task.sourceHighlight}&quot;
              </p>
            ) : null}

            <TaskEditForm
              projectId={projectId}
              moduleId={moduleId}
              taskId={taskId}
              title={task.title}
              description={task.description ?? ""}
              priority={task.priority}
              dueDate={task.dueDate ? task.dueDate.toISOString().slice(0, 10) : ""}
              canEdit={canEdit}
            />

            <div className="border-t pt-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Lịch sử</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {task.history.map((h) => (
                  <li key={h.id}>
                    {h.changedBy.fullName} đổi {h.field}: {h.oldValue ?? "—"} → {h.newValue ?? "—"} (
                    {h.createdAt.toLocaleString("vi-VN")})
                  </li>
                ))}
                {task.history.length === 0 ? <li>Chưa có lịch sử thay đổi.</li> : null}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit">
        <CardContent className="pt-6">
          <TaskComments
            projectId={projectId}
            moduleId={moduleId}
            taskId={taskId}
            comments={task.comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))}
            canComment={canComment}
          />
        </CardContent>
      </Card>
    </div>
  );
}
