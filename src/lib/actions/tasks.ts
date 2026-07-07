"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { getAssignedModuleIdsForUser } from "@/lib/document-type-access";
import { logAudit } from "@/lib/audit";
import {
  generateAiTaskCandidatesFromDocuments,
  isAiTaskGenerationConfigured,
  type AutoTaskCandidate,
} from "@/lib/auto-task-generator";
import { taskFormSchema, TASK_PRIORITY_ORDER } from "@/lib/validation/task";
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
    parentTaskId: formData.get("parentTaskId") ?? "",
    startDate: formData.get("startDate") ?? "",
    dueDate: formData.get("dueDate") ?? "",
    estimateHours: formData.get("estimateHours") ?? undefined,
    storyPoint: formData.get("storyPoint") ?? undefined,
    acceptanceCriteria: formData.get("acceptanceCriteria") ?? "",
    relatedDocumentId: formData.get("relatedDocumentId") ?? "",
    sourceHighlight: formData.get("sourceHighlight") ?? "",
  });
}

export interface AutoGenerateTasksState extends ActionState {
  created?: number;
  skipped?: number;
  scannedDocuments?: number;
  candidates?: number;
}

export interface AutoTaskPreviewCandidate extends AutoTaskCandidate {
  duplicate?: boolean;
}

export interface AutoTaskPreviewState extends ActionState {
  scannedDocuments?: number;
  candidates?: number;
  proposals?: AutoTaskPreviewCandidate[];
}

const autoTaskCandidateInputSchema = z.array(
  z.object({
    documentId: z.string().min(1),
    moduleId: z.string().min(1),
    sourceKey: z.string().min(1).max(240),
    sourceLabel: z.string().min(1).max(240),
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(5000),
    acceptanceCriteria: z.string().min(1).max(5000),
    type: z.enum(["STORY", "TASK", "TEST"]),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    sourceEvidence: z.string().max(500),
    confidence: z.number().min(0).max(1),
    needsClarification: z.boolean(),
  }),
).max(100);

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
      parentTaskId: values.parentTaskId || null,
      startDate: values.startDate ? new Date(values.startDate) : null,
      dueDate: values.dueDate ? new Date(values.dueDate) : null,
      estimateHours: values.estimateHours ?? 0,
      storyPoint: values.storyPoint ?? 0,
      acceptanceCriteria: values.acceptanceCriteria || null,
      relatedDocumentId: values.relatedDocumentId || null,
      sourceHighlight: values.sourceHighlight || null,
      createdById: session.user.id,
      reporterId: session.user.id,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  // Dependencies chosen at creation time.
  const creatorId = session.user.id;
  const dependsOn = formData
    .getAll("dependsOn")
    .map((v) => String(v))
    .filter((id) => id && id !== task.id);
  if (dependsOn.length > 0) {
    await prisma.taskDependency.createMany({
      data: dependsOn.map((dependsOnTaskId) => ({
        taskId: task.id,
        dependsOnTaskId,
        createdById: creatorId,
      })),
      skipDuplicates: true,
    });
  }

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

export async function autoGenerateTasksFromDocumentsAction(
  projectId: string,
  _prevState: AutoGenerateTasksState,
): Promise<AutoGenerateTasksState> {
  void _prevState;
  const preview = await previewAutoTasksFromDocumentsAction(projectId);
  if (preview.error || !preview.proposals) {
    return {
      error: preview.error,
      success: preview.success,
      created: 0,
      skipped: 0,
      scannedDocuments: preview.scannedDocuments,
      candidates: preview.candidates,
    };
  }
  if (preview.proposals.length === 0) {
    return {
      success: preview.success,
      created: 0,
      skipped: 0,
      scannedDocuments: preview.scannedDocuments,
      candidates: preview.candidates,
    };
  }
  return createAutoTasksFromDocumentsAction(
    projectId,
    preview.proposals.filter((proposal) => !proposal.duplicate),
  );
}

export async function previewAutoTasksFromDocumentsAction(
  projectId: string,
): Promise<AutoTaskPreviewState> {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." };

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true },
  });
  if (!project) return { error: "Không tìm thấy dự án." };

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!(await canAccess({ systemRole: session.user.systemRole }, "task.create", projectRole))) {
    return { error: "Bạn không có quyền tạo task." };
  }

  const assignedModuleIds = await getAssignedModuleIdsForUser({
    projectId,
    userId: session.user.id,
    systemRole: session.user.systemRole,
    projectRole,
  });

  const documents = await prisma.document.findMany({
    where: {
      projectId,
      deletedAt: null,
      ...(assignedModuleIds ? { moduleId: { in: [...assignedModuleIds] } } : {}),
      module: { deletedAt: null },
    },
    select: {
      id: true,
      title: true,
      description: true,
      currentContent: true,
      contentFormat: true,
      moduleId: true,
      module: { select: { name: true } },
    },
    orderBy: [{ module: { sortOrder: "asc" } }, { updatedAt: "desc" }],
    take: 200,
  });

  if (documents.length === 0) {
    return {
      success: "Không có tài liệu active để AI phân tích.",
      scannedDocuments: 0,
      candidates: 0,
      proposals: [],
    };
  }

  if (!isAiTaskGenerationConfigured()) {
    return {
      error: "AI chưa được cấu hình. Cần thiết lập OPENAI_API_KEY trên môi trường chạy app.",
      scannedDocuments: documents.length,
      candidates: 0,
      proposals: [],
    };
  }

  let candidates: AutoTaskCandidate[];
  try {
    candidates = await generateAiTaskCandidatesFromDocuments(documents);
  } catch (error) {
    console.error("AI task generation failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      error: getAiTaskGenerationErrorMessage(error),
      scannedDocuments: documents.length,
      candidates: 0,
      proposals: [],
    };
  }

  if (candidates.length === 0) {
    return {
      success: `AI đã quét ${documents.length} tài liệu nhưng chưa tìm thấy logic đủ rõ để tạo task.`,
      scannedDocuments: documents.length,
      candidates: 0,
      proposals: [],
    };
  }

  const existingKeys = await findExistingAutoTaskKeys(projectId, documents.map((doc) => doc.id), candidates);
  const proposals = candidates.map((candidate) => ({
    ...candidate,
    duplicate: existingKeys.has(`${candidate.documentId}:${candidate.sourceKey}`),
  }));

  return {
    success: `AI đề xuất ${candidates.length} task từ ${documents.length} tài liệu.`,
    scannedDocuments: documents.length,
    candidates: candidates.length,
    proposals,
  };
}

function getAiTaskGenerationErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes("model") || lowerMessage.includes("not found") || lowerMessage.includes("404")) {
    return "AI model hiện không khả dụng. Vui lòng kiểm tra AI_TASK_MODEL hoặc dùng model khác.";
  }
  if (lowerMessage.includes("api key") || lowerMessage.includes("unauthorized") || lowerMessage.includes("401")) {
    return "OPENAI_API_KEY không hợp lệ hoặc không có quyền gọi model hiện tại.";
  }
  if (lowerMessage.includes("rate limit") || lowerMessage.includes("429")) {
    return "OpenAI đang giới hạn request. Vui lòng thử lại sau ít phút.";
  }
  if (lowerMessage.includes("schema") || lowerMessage.includes("validation")) {
    return "AI trả dữ liệu chưa đúng format task. Vui lòng thử lại.";
  }
  return "AI chưa tạo được task từ tài liệu. Vui lòng kiểm tra cấu hình model/API key hoặc thử lại.";
}

export async function createAutoTasksFromDocumentsAction(
  projectId: string,
  rawCandidates: unknown,
): Promise<AutoGenerateTasksState> {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." };

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true, code: true },
  });
  if (!project) return { error: "Không tìm thấy dự án." };

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!(await canAccess({ systemRole: session.user.systemRole }, "task.create", projectRole))) {
    return { error: "Bạn không có quyền tạo task." };
  }

  const parsed = autoTaskCandidateInputSchema.safeParse(rawCandidates);
  if (!parsed.success) {
    return { error: "Danh sách task AI không hợp lệ. Vui lòng tạo preview lại." };
  }

  const candidates = parsed.data;
  if (candidates.length === 0) {
    return { error: "Bạn chưa chọn task nào để tạo.", created: 0, skipped: 0, candidates: 0 };
  }

  const assignedModuleIds = await getAssignedModuleIdsForUser({
    projectId,
    userId: session.user.id,
    systemRole: session.user.systemRole,
    projectRole,
  });

  const sourceDocuments = await prisma.document.findMany({
    where: {
      projectId,
      deletedAt: null,
      id: { in: candidates.map((candidate) => candidate.documentId) },
      ...(assignedModuleIds ? { moduleId: { in: [...assignedModuleIds] } } : {}),
      module: { deletedAt: null },
    },
    select: { id: true, moduleId: true },
  });
  const sourceDocumentIds = new Set(sourceDocuments.map((doc) => doc.id));
  const sourceModuleByDocumentId = new Map(sourceDocuments.map((doc) => [doc.id, doc.moduleId]));
  const accessibleCandidates = candidates.filter((candidate) => sourceDocumentIds.has(candidate.documentId));
  if (accessibleCandidates.length === 0) {
    return { error: "Không có task nào thuộc tài liệu bạn có quyền truy cập.", created: 0, skipped: candidates.length };
  }

  const existingKeys = await findExistingAutoTaskKeys(projectId, [...sourceDocumentIds], accessibleCandidates);
  const creatableCandidates = accessibleCandidates.filter(
    (candidate) => !existingKeys.has(`${candidate.documentId}:${candidate.sourceKey}`),
  );

  if (creatableCandidates.length === 0) {
    return {
      success: `Không tạo task mới. ${candidates.length} task dự kiến đã tồn tại.`,
      created: 0,
      skipped: candidates.length,
      scannedDocuments: sourceDocuments.length,
      candidates: candidates.length,
    };
  }

  const [taskCount, maxOrder] = await Promise.all([
    prisma.task.count({ where: { projectId } }),
    prisma.task.aggregate({
      where: { projectId, status: "BACKLOG", deletedAt: null },
      _max: { sortOrder: true },
    }),
  ]);
  const taskCodePrefix = (project.code || "TASK").toUpperCase();
  const firstSortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  const createdTasks = await prisma.$transaction(
    creatableCandidates.map((candidate, index) =>
      prisma.task.create({
        data: {
          projectId,
          moduleId: sourceModuleByDocumentId.get(candidate.documentId) ?? candidate.moduleId,
          taskCode: `${taskCodePrefix}-${taskCount + index + 1}`,
          title: candidate.title,
          description: candidate.description,
          acceptanceCriteria: candidate.acceptanceCriteria,
          type: candidate.type,
          priority: candidate.priority,
          status: "BACKLOG",
          assigneeId: null,
          relatedDocumentId: candidate.documentId,
          sourceHighlight: candidate.sourceKey,
          createdById: session.user.id,
          reporterId: session.user.id,
          sortOrder: firstSortOrder + index,
        },
      }),
    ),
  );

  await logAudit({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "Task",
    entityId: createdTasks[0]?.id,
    projectId,
    metadata: {
      mode: "auto_from_documents",
      generator: "ai_preview",
      created: createdTasks.length,
      skipped: candidates.length - creatableCandidates.length,
      scannedDocuments: sourceDocuments.length,
    },
  });

  revalidateTaskPaths(projectId, null);
  revalidatePath(`/projects/${projectId}/overview`);
  revalidatePath("/dashboard/my-tasks");

  return {
    success: `Đã tạo ${createdTasks.length} task, bỏ qua ${candidates.length - creatableCandidates.length} task trùng.`,
    created: createdTasks.length,
    skipped: candidates.length - creatableCandidates.length,
    scannedDocuments: sourceDocuments.length,
    candidates: candidates.length,
  };
}

async function findExistingAutoTaskKeys(
  projectId: string,
  documentIds: string[],
  candidates: Pick<AutoTaskCandidate, "sourceKey">[],
) {
  const existingTasks = await prisma.task.findMany({
    where: {
      projectId,
      deletedAt: null,
      relatedDocumentId: { in: documentIds },
      sourceHighlight: { in: candidates.map((candidate) => candidate.sourceKey) },
    },
    select: { relatedDocumentId: true, sourceHighlight: true },
  });
  return new Set(existingTasks.map((task) => `${task.relatedDocumentId ?? ""}:${task.sourceHighlight ?? ""}`));
}

/** Sets (or clears) a task's parent for the tree hierarchy. */
export async function setTaskParentAction(
  projectId: string,
  taskId: string,
  parentTaskId: string,
) {
  const session = await auth();
  if (!session?.user) return;
  if (!(await requireTaskEditAccess(session.user.id, session.user.systemRole, projectId))) return;
  if (parentTaskId === taskId) return;

  await prisma.task.update({
    where: { id: taskId },
    data: { parentTaskId: parentTaskId || null },
  });

  revalidateTaskPaths(projectId, null, taskId);
}

async function requireTaskEditAccess(userId: string, systemRole: string, projectId: string) {
  const projectRole = await getProjectRole(userId, projectId);
  return await canAccess({ systemRole: systemRole as never }, "task.edit", projectRole);
}

export async function updateTaskPriorityAction(
  projectId: string,
  moduleId: string | null,
  taskId: string,
  priority: string,
) {
  const session = await auth();
  if (!session?.user) return;
  if (!(await requireTaskEditAccess(session.user.id, session.user.systemRole, projectId))) return;
  if (!TASK_PRIORITY_ORDER.includes(priority as (typeof TASK_PRIORITY_ORDER)[number])) return;

  const before = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  if (before.priority === priority) return;

  await prisma.task.update({
    where: { id: taskId },
    data: { priority: priority as never },
  });

  await prisma.taskHistory.create({
    data: {
      taskId,
      changedById: session.user.id,
      field: "priority",
      oldValue: before.priority,
      newValue: priority,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "Task",
    entityId: taskId,
    projectId,
  });

  revalidateTaskPaths(projectId, moduleId, taskId);
}

export async function updateTaskDueDateAction(
  projectId: string,
  moduleId: string | null,
  taskId: string,
  dueDate: string,
) {
  const session = await auth();
  if (!session?.user) return;
  if (!(await requireTaskEditAccess(session.user.id, session.user.systemRole, projectId))) return;

  const before = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  const nextDue = dueDate ? new Date(dueDate) : null;
  const beforeDue = before.dueDate ? before.dueDate.toISOString().slice(0, 10) : "";
  if (beforeDue === dueDate) return;

  await prisma.task.update({
    where: { id: taskId },
    data: { dueDate: nextDue },
  });

  await prisma.taskHistory.create({
    data: {
      taskId,
      changedById: session.user.id,
      field: "dueDate",
      oldValue: beforeDue || null,
      newValue: dueDate || null,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "Task",
    entityId: taskId,
    projectId,
  });

  revalidateTaskPaths(projectId, moduleId, taskId);
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
