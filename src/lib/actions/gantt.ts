"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { logAudit } from "@/lib/audit";
import { refreshTaskDerivedFields } from "@/lib/task-rules";

async function requireEdit(userId: string, systemRole: string, projectId: string) {
  const projectRole = await getProjectRole(userId, projectId);
  return await canAccess({ systemRole: systemRole as never }, "task.edit", projectRole);
}

export async function updateTaskScheduleAction(
  projectId: string,
  taskId: string,
  startDate: string,
  dueDate: string,
) {
  const session = await auth();
  if (!session?.user) return;
  if (!(await requireEdit(session.user.id, session.user.systemRole, projectId))) return;

  const result = await prisma.task.updateMany({
    where: { id: taskId, projectId, deletedAt: null },
    data: {
      startDate: startDate ? new Date(startDate) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
    },
  });
  if (result.count === 0) return;

  await logAudit({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "Task",
    entityId: taskId,
    projectId,
    metadata: { field: "schedule" },
  });

  revalidatePath(`/projects/${projectId}/gantt`);
}

export async function addTaskDependencyAction(
  projectId: string,
  taskId: string,
  dependsOnTaskId: string,
) {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." };
  if (!(await requireEdit(session.user.id, session.user.systemRole, projectId))) {
    return { error: "Bạn không có quyền." };
  }
  if (taskId === dependsOnTaskId) return { error: "Task không thể phụ thuộc chính nó." };

  const tasks = await prisma.task.findMany({
    where: { id: { in: [taskId, dependsOnTaskId] }, projectId, deletedAt: null },
    select: { id: true },
  });
  if (tasks.length !== 2) return { error: "Không tìm thấy task trong dự án." };

  await prisma.taskDependency.upsert({
    where: { taskId_dependsOnTaskId: { taskId, dependsOnTaskId } },
    create: { taskId, dependsOnTaskId, createdById: session.user.id },
    update: {},
  });

  await refreshTaskDerivedFields(taskId);
  revalidatePath(`/projects/${projectId}/gantt`);
  revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
  return { success: "Đã thêm phụ thuộc." };
}

export async function removeTaskDependencyAction(projectId: string, dependencyId: string) {
  const session = await auth();
  if (!session?.user) return;
  if (!(await requireEdit(session.user.id, session.user.systemRole, projectId))) return;

  const dependency = await prisma.taskDependency.findFirst({
    where: { id: dependencyId, task: { projectId, deletedAt: null } },
    select: { id: true, taskId: true },
  });
  if (!dependency) return;
  await prisma.taskDependency.delete({ where: { id: dependency.id } });
  await refreshTaskDerivedFields(dependency.taskId);
  revalidatePath(`/projects/${projectId}/gantt`);
  revalidatePath(`/projects/${projectId}/tasks/${dependency.taskId}`);
}
