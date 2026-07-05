"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { logAudit } from "@/lib/audit";
import { taskFormSchema } from "@/lib/validation/task";
import type { ActionState } from "@/lib/actions/profile";

export async function createTaskAction(
  projectId: string,
  moduleId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." };

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!(await canAccess({ systemRole: session.user.systemRole }, "task.create", projectRole))) {
    return { error: "Bạn không có quyền tạo task." };
  }

  const parsed = taskFormSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    assigneeId: formData.get("assigneeId") ?? "",
    priority: formData.get("priority") || "MEDIUM",
    dueDate: formData.get("dueDate") ?? "",
    relatedDocumentId: formData.get("relatedDocumentId") ?? "",
    sourceHighlight: formData.get("sourceHighlight") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }
  const values = parsed.data;

  const maxOrder = await prisma.task.aggregate({
    where: { projectId, moduleId, status: "TODO", deletedAt: null },
    _max: { sortOrder: true },
  });

  const task = await prisma.task.create({
    data: {
      projectId,
      moduleId,
      title: values.title,
      description: values.description || null,
      assigneeId: values.assigneeId || null,
      priority: values.priority,
      dueDate: values.dueDate ? new Date(values.dueDate) : null,
      relatedDocumentId: values.relatedDocumentId || null,
      sourceHighlight: values.sourceHighlight || null,
      createdById: session.user.id,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "Task",
    entityId: task.id,
    projectId,
    metadata: { title: values.title },
  });

  revalidatePath(`/projects/${projectId}/modules/${moduleId}/tasks`);
  redirect(`/projects/${projectId}/modules/${moduleId}/tasks/${task.id}`);
}

async function requireTaskEditAccess(userId: string, systemRole: string, projectId: string) {
  const projectRole = await getProjectRole(userId, projectId);
  return await canAccess({ systemRole: systemRole as never }, "task.edit", projectRole);
}

export async function updateTaskAction(
  projectId: string,
  moduleId: string,
  taskId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." };

  if (!(await requireTaskEditAccess(session.user.id, session.user.systemRole, projectId))) {
    return { error: "Bạn không có quyền chỉnh sửa task này." };
  }

  const parsed = taskFormSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    assigneeId: formData.get("assigneeId") ?? "",
    priority: formData.get("priority") || "MEDIUM",
    dueDate: formData.get("dueDate") ?? "",
    relatedDocumentId: formData.get("relatedDocumentId") ?? "",
    sourceHighlight: "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }
  const values = parsed.data;

  const before = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });

  await prisma.task.update({
    where: { id: taskId },
    data: {
      title: values.title,
      description: values.description || null,
      assigneeId: values.assigneeId || null,
      priority: values.priority,
      dueDate: values.dueDate ? new Date(values.dueDate) : null,
      relatedDocumentId: values.relatedDocumentId || null,
    },
  });

  const historyEntries = [];
  if (before.assigneeId !== (values.assigneeId || null)) {
    historyEntries.push({
      taskId,
      changedById: session.user.id,
      field: "assignee",
      oldValue: before.assigneeId,
      newValue: values.assigneeId || null,
    });
  }
  if (before.priority !== values.priority) {
    historyEntries.push({
      taskId,
      changedById: session.user.id,
      field: "priority",
      oldValue: before.priority,
      newValue: values.priority,
    });
  }
  if (historyEntries.length > 0) {
    await prisma.taskHistory.createMany({ data: historyEntries });
  }

  await logAudit({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "Task",
    entityId: taskId,
    projectId,
  });

  revalidatePath(`/projects/${projectId}/modules/${moduleId}/tasks/${taskId}`);
  return { success: "Đã cập nhật task." };
}

export async function reassignTaskAction(
  projectId: string,
  moduleId: string,
  taskId: string,
  assigneeId: string,
) {
  const session = await auth();
  if (!session?.user) return;

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!(await canAccess({ systemRole: session.user.systemRole }, "task.reassign", projectRole))) return;

  const before = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });

  await prisma.task.update({
    where: { id: taskId },
    data: { assigneeId: assigneeId || null },
  });

  await prisma.taskHistory.create({
    data: {
      taskId,
      changedById: session.user.id,
      field: "assignee",
      oldValue: before.assigneeId,
      newValue: assigneeId || null,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "ASSIGN",
    entityType: "Task",
    entityId: taskId,
    projectId,
    metadata: { assigneeId },
  });

  revalidatePath(`/projects/${projectId}/modules/${moduleId}/tasks/${taskId}`);
  revalidatePath(`/projects/${projectId}/modules/${moduleId}/tasks`);
}

export async function changeTaskStatusAction(
  projectId: string,
  moduleId: string,
  taskId: string,
  status: string,
) {
  const session = await auth();
  if (!session?.user) return;

  if (!(await requireTaskEditAccess(session.user.id, session.user.systemRole, projectId))) return;

  const before = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });

  await prisma.task.update({ where: { id: taskId }, data: { status: status as never } });

  await prisma.taskHistory.create({
    data: {
      taskId,
      changedById: session.user.id,
      field: "status",
      oldValue: before.status,
      newValue: status,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "STATUS_CHANGE",
    entityType: "Task",
    entityId: taskId,
    projectId,
    metadata: { from: before.status, to: status },
  });

  revalidatePath(`/projects/${projectId}/modules/${moduleId}/tasks/${taskId}`);
  revalidatePath(`/projects/${projectId}/modules/${moduleId}/tasks`);
}

export async function addTaskCommentAction(
  projectId: string,
  moduleId: string,
  taskId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." };

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!(await canAccess({ systemRole: session.user.systemRole }, "comment.create", projectRole))) {
    return { error: "Bạn không có quyền bình luận." };
  }

  const content = String(formData.get("content") ?? "").trim();
  if (!content) return { error: "Nội dung không được để trống." };

  await prisma.comment.create({
    data: { taskId, authorId: session.user.id, content },
  });

  await logAudit({
    actorId: session.user.id,
    action: "COMMENT",
    entityType: "Task",
    entityId: taskId,
    projectId,
  });

  revalidatePath(`/projects/${projectId}/modules/${moduleId}/tasks/${taskId}`);
  return { success: "Đã gửi nhận xét." };
}
