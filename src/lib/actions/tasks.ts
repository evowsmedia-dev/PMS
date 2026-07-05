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

/** Revalidate both the module-scoped and project-scoped task views so a change
 * is reflected wherever the task is shown. */
function revalidateTaskPaths(projectId: string, moduleId: string | null, taskId?: string) {
  revalidatePath(`/projects/${projectId}/tasks`);
  revalidatePath(`/projects/${projectId}/kanban`);
  if (taskId) revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
  if (moduleId) {
    revalidatePath(`/projects/${projectId}/modules/${moduleId}/tasks`);
    if (taskId) revalidatePath(`/projects/${projectId}/modules/${moduleId}/tasks/${taskId}`);
  }
}

/** Generates the next per-project task code, e.g. "PMS-42". Falls back to a
 * numeric suffix off the current task count when the project has no code. */
async function nextTaskCode(projectId: string): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { code: true },
  });
  const prefix = (project?.code ?? "TASK").toUpperCase();
  const count = await prisma.task.count({ where: { projectId } });
  return `${prefix}-${count + 1}`;
}

function parseTaskForm(formData: FormData) {
  return taskFormSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    type: formData.get("type") || "TASK",
    assigneeId: formData.get("assigneeId") ?? "",
    reviewerId: formData.get("reviewerId") ?? "",
    testerId: formData.get("testerId") ?? "",
    priority: formData.get("priority") || "MEDIUM",
    epicId: formData.get("epicId") ?? "",
    sprintId: formData.get("sprintId") ?? "",
    milestoneId: formData.get("milestoneId") ?? "",
    startDate: formData.get("startDate") ?? "",
    dueDate: formData.get("dueDate") ?? "",
    estimateHours: formData.get("estimateHours") ?? undefined,
    storyPoint: formData.get("storyPoint") ?? undefined,
    acceptanceCriteria: formData.get("acceptanceCriteria") ?? "",
    relatedDocumentId: formData.get("relatedDocumentId") ?? "",
    sourceHighlight: formData.get("sourceHighlight") ?? "",
  });
}

/** Module-scoped create (legacy route). Keeps the original lightweight fields. */
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

  const parsed = parseTaskForm(formData);
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
      taskCode: await nextTaskCode(projectId),
      title: values.title,
      description: values.description || null,
      assigneeId: values.assigneeId || null,
      priority: values.priority,
      status: "TODO",
      dueDate: values.dueDate ? new Date(values.dueDate) : null,
      relatedDocumentId: values.relatedDocumentId || null,
      sourceHighlight: values.sourceHighlight || null,
      createdById: session.user.id,
      reporterId: session.user.id,
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

  revalidateTaskPaths(projectId, moduleId);
  redirect(`/projects/${projectId}/modules/${moduleId}/tasks/${task.id}`);
}

/** Project-level create with the full planning field set. */
export async function createProjectTaskAction(
  projectId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." };

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!(await canAccess({ systemRole: session.user.systemRole }, "task.create", projectRole))) {
    return { error: "Bạn không có quyền tạo task." };
  }

  const parsed = parseTaskForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }
  const values = parsed.data;

  const maxOrder = await prisma.task.aggregate({
    where: { projectId, status: "BACKLOG", deletedAt: null },
    _max: { sortOrder: true },
  });

  const task = await prisma.task.create({
    data: {
      projectId,
      taskCode: await nextTaskCode(projectId),
      title: values.title,
      description: values.description || null,
      type: values.type,
      priority: values.priority,
      status: "BACKLOG",
      assigneeId: values.assigneeId || null,
      reviewerId: values.reviewerId || null,
      testerId: values.testerId || null,
      epicId: values.epicId || null,
      sprintId: values.sprintId || null,
      milestoneId: values.milestoneId || null,
      startDate: values.startDate ? new Date(values.startDate) : null,
      dueDate: values.dueDate ? new Date(values.dueDate) : null,
      estimateHours: values.estimateHours ?? 0,
      storyPoint: values.storyPoint ?? 0,
      acceptanceCriteria: values.acceptanceCriteria || null,
      createdById: session.user.id,
      reporterId: session.user.id,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "Task",
    entityId: task.id,
    projectId,
    metadata: { title: values.title, type: values.type },
  });

  revalidateTaskPaths(projectId, null);
  redirect(`/projects/${projectId}/tasks/${task.id}`);
}

async function requireTaskEditAccess(userId: string, systemRole: string, projectId: string) {
  const projectRole = await getProjectRole(userId, projectId);
  return await canAccess({ systemRole: systemRole as never }, "task.edit", projectRole);
}

export async function updateTaskAction(
  projectId: string,
  moduleId: string | null,
  taskId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." };

  if (!(await requireTaskEditAccess(session.user.id, session.user.systemRole, projectId))) {
    return { error: "Bạn không có quyền chỉnh sửa task này." };
  }

  const parsed = parseTaskForm(formData);
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
      type: values.type,
      assigneeId: values.assigneeId || null,
      reviewerId: values.reviewerId || null,
      testerId: values.testerId || null,
      priority: values.priority,
      epicId: values.epicId || null,
      sprintId: values.sprintId || null,
      milestoneId: values.milestoneId || null,
      startDate: values.startDate ? new Date(values.startDate) : null,
      dueDate: values.dueDate ? new Date(values.dueDate) : null,
      estimateHours: values.estimateHours ?? before.estimateHours,
      storyPoint: values.storyPoint ?? before.storyPoint,
      acceptanceCriteria: values.acceptanceCriteria || null,
      relatedDocumentId: values.relatedDocumentId || null,
    },
  });

  const historyEntries: {
    taskId: string;
    changedById: string;
    field: string;
    oldValue: string | null;
    newValue: string | null;
  }[] = [];
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

  revalidateTaskPaths(projectId, moduleId, taskId);
  return { success: "Đã cập nhật task." };
}

export async function reassignTaskAction(
  projectId: string,
  moduleId: string | null,
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

  revalidateTaskPaths(projectId, moduleId, taskId);
}

const REOPEN_STATUSES = new Set(["REOPENED", "BUG_FIXING"]);

export async function changeTaskStatusAction(
  projectId: string,
  moduleId: string | null,
  taskId: string,
  status: string,
  reason?: string,
) {
  const session = await auth();
  if (!session?.user) return;

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!(await canAccess({ systemRole: session.user.systemRole }, "task.move", projectRole))) return;

  const before = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  if (before.status === status) return;

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: status as never,
      completedAt: status === "DONE" ? new Date() : status === before.status ? undefined : null,
      progressPercent: status === "DONE" ? 100 : before.progressPercent,
    },
  });

  await prisma.taskHistory.create({
    data: {
      taskId,
      changedById: session.user.id,
      field: "status",
      oldValue: before.status,
      newValue: status,
      reason: REOPEN_STATUSES.has(status) ? reason?.trim() || null : null,
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

  revalidateTaskPaths(projectId, moduleId, taskId);
}

export async function addTaskCommentAction(
  projectId: string,
  moduleId: string | null,
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

  revalidateTaskPaths(projectId, moduleId, taskId);
  return { success: "Đã gửi nhận xét." };
}

/** Soft-delete a task. */
export async function deleteTaskAction(
  projectId: string,
  moduleId: string | null,
  taskId: string,
) {
  const session = await auth();
  if (!session?.user) return;

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!(await canAccess({ systemRole: session.user.systemRole }, "task.edit", projectRole))) return;

  await prisma.task.update({ where: { id: taskId }, data: { deletedAt: new Date() } });

  await logAudit({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "Task",
    entityId: taskId,
    projectId,
  });

  revalidateTaskPaths(projectId, moduleId);
  redirect(
    moduleId
      ? `/projects/${projectId}/modules/${moduleId}/tasks`
      : `/projects/${projectId}/tasks`,
  );
}
