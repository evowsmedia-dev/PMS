"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { canAccessModule, getAssignedModuleIdsForUser } from "@/lib/document-type-access";
import { logAudit } from "@/lib/audit";
import {
  generateAiTaskCandidateResult,
  isAiTaskGenerationConfigured,
  type AutoTaskCandidate,
} from "@/lib/auto-task-generator";
import {
  AI_SUBTASK_PROMPT_VERSION,
  buildAiSubtaskContext,
  calculateAiSubtaskCoverage,
  generateAiSubtaskProposalResult,
  type AiSubtaskCoverageReport,
  type AiSubtaskProposal,
  type AiSubtaskSourceReference,
} from "@/lib/ai-subtask-generator";
import { logAiUsage } from "@/lib/ai-usage";
import { taskFormSchema, taskTimeLogSchema, TASK_PRIORITY_ORDER } from "@/lib/validation/task";
import {
  isValidKanbanStatusColumnConfig,
  normalizeKanbanStatusColumns,
  serializeKanbanStatusColumns,
  visibleKanbanStatuses,
  type KanbanStatusColumn,
} from "@/lib/kanban-status-config";
import { deriveTaskEffortFields, refreshTaskDerivedFields } from "@/lib/task-rules";
import type { ActionState } from "@/lib/actions/profile";

/** Revalidate both the module-scoped and project-scoped task views so a change
 * is reflected wherever the task is shown. */
function revalidateTaskPaths(projectId: string, moduleId: string | null, taskId?: string) {
  revalidatePath(`/projects/${projectId}/tasks`);
  revalidatePath(`/projects/${projectId}/kanban`);
  revalidatePath(`/projects/${projectId}/overview`);
  revalidatePath(`/dashboard/my-tasks`);
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
  const optionalValue = (key: string) => {
    const value = String(formData.get(key) ?? "");
    return value === "__none" ? "" : value;
  };
  return taskFormSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    type: formData.get("type") || "TASK",
    assigneeId: optionalValue("assigneeId"),
    reviewerId: optionalValue("reviewerId"),
    testerId: optionalValue("testerId"),
    priority: formData.get("priority") || "MEDIUM",
    epicId: optionalValue("epicId"),
    sprintId: optionalValue("sprintId"),
    milestoneId: optionalValue("milestoneId"),
    parentTaskId: optionalValue("parentTaskId"),
    startDate: formData.get("startDate") ?? "",
    plannedStartAt: formData.get("plannedStartAt") ?? formData.get("startDate") ?? "",
    dueDate: formData.get("dueDate") ?? "",
    devDueAt: formData.get("devDueAt") ?? formData.get("dueDate") ?? "",
    testDueAt: formData.get("testDueAt") ?? "",
    estimateHours: formData.get("estimateHours") ?? undefined,
    devEstimateHours: formData.get("devEstimateHours") ?? formData.get("estimateHours") ?? undefined,
    testEstimateHours: formData.get("testEstimateHours") ?? undefined,
    testEstimateSource: formData.get("testEstimateSource") || "AUTO",
    standardEstimateMandays: formData.get("standardEstimateMandays") ?? undefined,
    storyPoint: formData.get("storyPoint") ?? undefined,
    acceptanceCriteria: formData.get("acceptanceCriteria") ?? "",
    relatedDocumentId: formData.get("relatedDocumentId") ?? "",
    sourceHighlight: formData.get("sourceHighlight") ?? "",
  });
}

function normalizeRelatedDocumentIds(formData: FormData) {
  return Array.from(new Set(formData.getAll("relatedDocumentIds").map((value) => String(value)).filter(Boolean)));
}

function normalizeExternalLinks(formData: FormData) {
  const raw = String(formData.get("externalLinks") ?? "");
  return raw
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((url) => ({ url }));
}

async function replaceTaskRelatedDocuments(taskId: string, projectId: string, documentIds: string[]) {
  const documents = documentIds.length
    ? await prisma.document.findMany({
        where: { id: { in: documentIds }, projectId, deletedAt: null },
        select: { id: true },
      })
    : [];
  const validIds = documents.map((document) => document.id);

  await prisma.taskRelatedDocument.deleteMany({ where: { taskId } });
  if (validIds.length > 0) {
    await prisma.taskRelatedDocument.createMany({
      data: validIds.map((documentId) => ({ taskId, documentId })),
      skipDuplicates: true,
    });
  }
  return validIds;
}

function extractMentionNames(content: string) {
  return Array.from(content.matchAll(/@([\w.]+)/g)).map((match) => match[1]);
}

async function mentionedProjectUserIds(projectId: string, content: string) {
  const mentionNames = extractMentionNames(content);
  if (mentionNames.length === 0) return [];

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, fullName: true, email: true } } },
  });
  const mentionedUserIds = new Set<string>();
  for (const name of mentionNames) {
    const match = members.find(
      (member) =>
        member.user.email.split("@")[0].toLowerCase() === name.toLowerCase() ||
        member.user.fullName.replaceAll(" ", "").toLowerCase() === name.toLowerCase(),
    );
    if (match) mentionedUserIds.add(match.user.id);
  }
  return Array.from(mentionedUserIds);
}

async function notifyTaskMentions({
  projectId,
  taskId,
  taskCode,
  title,
  content,
}: {
  projectId: string;
  taskId: string;
  taskCode?: string | null;
  title: string;
  content: string;
}) {
  const mentionedUserIds = await mentionedProjectUserIds(projectId, content);
  if (mentionedUserIds.length === 0) return mentionedUserIds;

  await prisma.notification.createMany({
    data: mentionedUserIds.map((userId) => ({
      userId,
      type: "task_mention",
      title: `Bạn được nhắc trong task ${taskCode ?? ""}`.trim(),
      content: title,
      entityType: "Task",
      entityId: taskId,
      projectId,
    })),
  });
  return mentionedUserIds;
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

export interface AiSubtaskPreviewProposal extends AiSubtaskProposal {
  duplicate?: boolean;
}

export interface AiSubtaskPreviewState extends ActionState {
  proposals?: AiSubtaskPreviewProposal[];
  parentEstimateHours?: number;
  generation?: AiSubtaskGenerationSummary;
  generations?: AiSubtaskGenerationSummary[];
  sourceReferences?: AiSubtaskSourceReference[];
  coverageReport?: AiSubtaskCoverageReport;
  contextCurrent?: boolean;
}

export interface AiSubtaskGenerationSummary {
  id: string;
  versionNo: number;
  model: string;
  promptVersion: string;
  status: string;
  contextHash: string;
  totalEstimateHours: number;
  createdAt: string;
  createdByName: string;
}

export interface CreateAiSubtasksState extends ActionState {
  created?: number;
  skipped?: number;
}

const aiSubtaskInputSchema = z
  .array(
    z.object({
      sourceKey: z.string().trim().min(1).max(120),
      title: z.string().trim().min(1).max(200),
      description: z.string().trim().min(1).max(5000),
      acceptanceCriteria: z.string().trim().min(1).max(5000),
      devEstimateHours: z.number().min(0.5).max(8).refine((value) => value * 2 === Math.round(value * 2), {
        message: "Dev estimate phải theo bước 0.5 giờ.",
      }),
      confidence: z.number().min(0).max(1),
      dependencies: z.array(z.string().trim().min(1).max(120)).max(10),
      coveredSourceRefs: z.array(z.string().trim().min(1).max(160)).min(1).max(30),
      sourceEvidence: z.string().trim().min(1).max(1000),
    }),
  )
  .min(1)
  .max(20);

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
  const relatedDocumentIds = normalizeRelatedDocumentIds(formData);
  const externalLinks = normalizeExternalLinks(formData);

  const maxOrder = await prisma.task.aggregate({
    where: { projectId, moduleId, status: "TODO", deletedAt: null },
    _max: { sortOrder: true },
  });
  const status = "TODO";
  const devDueAt = values.devDueAt ? new Date(values.devDueAt) : values.dueDate ? new Date(values.dueDate) : null;
  const testDueAt = values.testDueAt ? new Date(values.testDueAt) : null;
  const derived = deriveTaskEffortFields({
    status,
    devEstimateHours: values.devEstimateHours ?? values.estimateHours ?? 0,
    testEstimateHours: values.testEstimateHours ?? null,
    testEstimateSource: values.testEstimateSource,
    standardEstimateMandays: values.standardEstimateMandays ?? 0,
    devDueAt,
    testDueAt,
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
      status,
      dueDate: values.dueDate ? new Date(values.dueDate) : null,
      startDate: values.startDate ? new Date(values.startDate) : null,
      plannedStartAt: values.plannedStartAt ? new Date(values.plannedStartAt) : null,
      devDueAt,
      testDueAt,
      ...derived,
      relatedDocumentId: relatedDocumentIds[0] ?? (values.relatedDocumentId || null),
      externalLinks,
      sourceHighlight: values.sourceHighlight || null,
      createdById: session.user.id,
      reporterId: session.user.id,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
  await replaceTaskRelatedDocuments(
    task.id,
    projectId,
    relatedDocumentIds.length > 0 ? relatedDocumentIds : values.relatedDocumentId ? [values.relatedDocumentId] : [],
  );
  if (values.description) {
    await notifyTaskMentions({
      projectId,
      taskId: task.id,
      taskCode: task.taskCode,
      title: task.title,
      content: values.description,
    });
  }

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
  const relatedDocumentIds = normalizeRelatedDocumentIds(formData);
  const externalLinks = normalizeExternalLinks(formData);

  const maxOrder = await prisma.task.aggregate({
    where: { projectId, status: "BACKLOG", deletedAt: null },
    _max: { sortOrder: true },
  });
  const status = "BACKLOG";
  const plannedStartAt = values.plannedStartAt
    ? new Date(values.plannedStartAt)
    : values.startDate
      ? new Date(values.startDate)
      : null;
  const devDueAt = values.devDueAt ? new Date(values.devDueAt) : values.dueDate ? new Date(values.dueDate) : null;
  const testDueAt = values.testDueAt ? new Date(values.testDueAt) : null;
  const derived = deriveTaskEffortFields({
    status,
    devEstimateHours: values.devEstimateHours ?? values.estimateHours ?? 0,
    testEstimateHours: values.testEstimateHours ?? null,
    testEstimateSource: values.testEstimateSource,
    standardEstimateMandays: values.standardEstimateMandays ?? 0,
    devDueAt,
    testDueAt,
  });

  const task = await prisma.task.create({
    data: {
      projectId,
      taskCode: await nextTaskCode(projectId),
      title: values.title,
      description: values.description || null,
      type: values.type,
      priority: values.priority,
      status,
      assigneeId: values.assigneeId || null,
      reviewerId: values.reviewerId || null,
      testerId: values.testerId || null,
      epicId: values.epicId || null,
      sprintId: values.sprintId || null,
      milestoneId: values.milestoneId || null,
      parentTaskId: values.parentTaskId || null,
      startDate: values.startDate ? new Date(values.startDate) : null,
      plannedStartAt,
      dueDate: values.dueDate ? new Date(values.dueDate) : null,
      devDueAt,
      testDueAt,
      ...derived,
      storyPoint: values.storyPoint ?? 0,
      acceptanceCriteria: values.acceptanceCriteria || null,
      relatedDocumentId: relatedDocumentIds[0] ?? (values.relatedDocumentId || null),
      externalLinks,
      sourceHighlight: values.sourceHighlight || null,
      createdById: session.user.id,
      reporterId: session.user.id,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
  await replaceTaskRelatedDocuments(
    task.id,
    projectId,
    relatedDocumentIds.length > 0 ? relatedDocumentIds : values.relatedDocumentId ? [values.relatedDocumentId] : [],
  );
  if (values.description) {
    await notifyTaskMentions({
      projectId,
      taskId: task.id,
      taskCode: task.taskCode,
      title: task.title,
      content: values.description,
    });
  }

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
    await refreshTaskDerivedFields(task.id);
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
    const aiResult = await generateAiTaskCandidateResult(documents);
    candidates = aiResult.candidates;
    await logAiUsage({
      userId: session.user.id,
      projectId,
      operation: "auto_task_preview",
      model: aiResult.model,
      usage: aiResult.usage,
      metadata: {
        scannedDocuments: documents.length,
        generatedCandidates: candidates.length,
      },
    });
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
  if (lowerMessage.includes("abort") || lowerMessage.includes("timeout") || lowerMessage.includes("timed out")) {
    return "AI phản hồi quá thời gian 45 giây. Hãy thử lại; hệ thống đã dừng request để tránh màn hình chờ vô hạn.";
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

export async function previewAiSubtasksAction(
  projectId: string,
  taskId: string,
  options: { forceNew?: boolean; generationId?: string } = {},
): Promise<AiSubtaskPreviewState> {
  const access = await getAiSubtaskParentAccess(projectId, taskId);
  if ("error" in access) return { error: access.error };

  const { session, task, documents } = access;
  if (!task.description?.trim() && !task.acceptanceCriteria?.trim() && documents.length === 0) {
    return {
      success: "Task chưa có đủ mô tả, tiêu chí nghiệm thu hoặc tài liệu liên quan để AI phân rã.",
      proposals: [],
      parentEstimateHours: Number(task.devEstimateHours),
    };
  }

  const parentContext = {
    id: task.id,
    title: task.title,
    description: task.description ?? "",
    acceptanceCriteria: task.acceptanceCriteria ?? "",
    priority: task.priority,
    moduleName: task.module?.name ?? null,
    epicName: task.epic?.name ?? null,
    sprintName: task.sprint?.name ?? null,
    milestoneName: task.milestone?.name ?? null,
    devEstimateHours: Number(task.devEstimateHours),
    documents: documents.map((document) => ({
      id: document.id,
      title: document.title,
      currentContent: document.currentContent,
    })),
    externalLinks: normalizeStoredExternalLinks(task.externalLinks),
  };
  const prepared = buildAiSubtaskContext(parentContext);
  const requestedGeneration = options.generationId
    ? await prisma.aiSubtaskGeneration.findFirst({
        where: { id: options.generationId, projectId, parentTaskId: taskId },
        include: { createdBy: { select: { fullName: true } } },
      })
    : null;
  const cachedGeneration =
    !options.forceNew && !requestedGeneration
      ? await prisma.aiSubtaskGeneration.findFirst({
          where: { projectId, parentTaskId: taskId, contextHash: prepared.contextHash },
          include: { createdBy: { select: { fullName: true } } },
          orderBy: { versionNo: "desc" },
        })
      : null;
  const reusableGeneration = requestedGeneration ?? cachedGeneration;
  if (reusableGeneration) {
    return buildAiSubtaskPreviewState({
      projectId,
      taskId,
      task,
      generation: reusableGeneration,
      currentContextHash: prepared.contextHash,
    });
  }

  if (!isAiTaskGenerationConfigured()) {
    return { error: "AI chưa được cấu hình. Cần thiết lập OPENAI_API_KEY trên môi trường chạy app." };
  }

  try {
    const aiResult = await generateAiSubtaskProposalResult(parentContext);

    await logAiUsage({
      userId: session.user.id,
      projectId,
      operation: "auto_subtask_preview",
      model: aiResult.model,
      usage: aiResult.usage,
      metadata: {
        parentTaskId: taskId,
        generatedProposals: aiResult.proposals.length,
        contextHash: aiResult.contextHash,
        promptVersion: AI_SUBTASK_PROMPT_VERSION,
      },
    });

    const latest = await prisma.aiSubtaskGeneration.aggregate({
      where: { parentTaskId: taskId },
      _max: { versionNo: true },
    });
    const generation = await prisma.aiSubtaskGeneration.create({
      data: {
        projectId,
        parentTaskId: taskId,
        createdById: session.user.id,
        versionNo: (latest._max.versionNo ?? 0) + 1,
        model: aiResult.model,
        promptVersion: AI_SUBTASK_PROMPT_VERSION,
        contextHash: aiResult.contextHash,
        contextSnapshot: aiResult.contextSnapshot as unknown as Prisma.InputJsonValue,
        proposals: aiResult.proposals as unknown as Prisma.InputJsonValue,
        coverageReport: aiResult.coverageReport as unknown as Prisma.InputJsonValue,
        totalEstimateHours: aiResult.proposals.reduce(
          (sum, proposal) => sum + proposal.devEstimateHours,
          0,
        ),
      },
      include: { createdBy: { select: { fullName: true } } },
    });

    return buildAiSubtaskPreviewState({
      projectId,
      taskId,
      task,
      generation,
      currentContextHash: prepared.contextHash,
      success:
        aiResult.proposals.length > 0
          ? `AI đã tạo phiên bản ${generation.versionNo} với ${aiResult.proposals.length} sub-task.`
          : "AI chưa tìm thấy phạm vi đủ rõ để tạo sub-task.",
    });
  } catch (error) {
    console.error("AI subtask generation failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
    return { error: getAiTaskGenerationErrorMessage(error) };
  }
}

async function buildAiSubtaskPreviewState({
  projectId,
  taskId,
  task,
  generation,
  currentContextHash,
  success,
}: {
  projectId: string;
  taskId: string;
  task: { devEstimateHours: unknown };
  generation: {
    id: string;
    versionNo: number;
    model: string;
    promptVersion: string;
    status: string;
    contextHash: string;
    totalEstimateHours: unknown;
    proposals: unknown;
    coverageReport: unknown;
    contextSnapshot: unknown;
    createdAt: Date;
    createdBy: { fullName: string };
  };
  currentContextHash: string;
  success?: string;
}): Promise<AiSubtaskPreviewState> {
  const parsedProposals = aiSubtaskInputSchema.safeParse(generation.proposals);
  if (!parsedProposals.success) return { error: "Phiên bản AI đã lưu có format không hợp lệ." };
  const snapshot = generation.contextSnapshot as {
    sourceReferences?: AiSubtaskSourceReference[];
  };
  const sourceReferences = snapshot.sourceReferences ?? [];
  const coverageReport = calculateAiSubtaskCoverage(parsedProposals.data, sourceReferences);
  const sourceHighlights = parsedProposals.data.map(
    (proposal) => `AI_SUBTASK:${taskId}:${proposal.sourceKey}`,
  );
  const existing = sourceHighlights.length
    ? await prisma.task.findMany({
        where: { projectId, deletedAt: null, sourceHighlight: { in: sourceHighlights } },
        select: { sourceHighlight: true },
      })
    : [];
  const existingKeys = new Set(existing.map((item) => item.sourceHighlight));
  const generations = await prisma.aiSubtaskGeneration.findMany({
    where: { projectId, parentTaskId: taskId },
    include: { createdBy: { select: { fullName: true } } },
    orderBy: { versionNo: "desc" },
  });
  return {
    success: success ?? `Đã tải lại phiên bản ${generation.versionNo}; không gọi AI mới.`,
    proposals: parsedProposals.data.map((proposal) => ({
      ...proposal,
      duplicate: existingKeys.has(`AI_SUBTASK:${taskId}:${proposal.sourceKey}`),
    })),
    parentEstimateHours: Number(task.devEstimateHours),
    generation: summarizeAiSubtaskGeneration(generation),
    generations: generations.map(summarizeAiSubtaskGeneration),
    sourceReferences,
    coverageReport,
    contextCurrent: generation.contextHash === currentContextHash,
  };
}

function summarizeAiSubtaskGeneration(generation: {
  id: string;
  versionNo: number;
  model: string;
  promptVersion: string;
  status: string;
  contextHash: string;
  totalEstimateHours: unknown;
  createdAt: Date;
  createdBy: { fullName: string };
}): AiSubtaskGenerationSummary {
  return {
    id: generation.id,
    versionNo: generation.versionNo,
    model: generation.model,
    promptVersion: generation.promptVersion,
    status: generation.status,
    contextHash: generation.contextHash,
    totalEstimateHours: Number(generation.totalEstimateHours),
    createdAt: generation.createdAt.toISOString(),
    createdByName: generation.createdBy.fullName,
  };
}

export async function createAiSubtasksAction(
  projectId: string,
  taskId: string,
  generationId: string,
  rawProposals: unknown,
): Promise<CreateAiSubtasksState> {
  const access = await getAiSubtaskParentAccess(projectId, taskId);
  if ("error" in access) return { error: access.error };

  const parsed = aiSubtaskInputSchema.safeParse(rawProposals);
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "Danh sách sub-task không hợp lệ. Mỗi Dev estimate phải từ 0.5 đến 8 giờ.",
    };
  }

  const { session, task, projectRole, documents } = access;
  const proposals = parsed.data;
  if (new Set(proposals.map((proposal) => proposal.sourceKey)).size !== proposals.length) {
    return { error: "Các sub-task không được trùng source key." };
  }
  const generation = await prisma.aiSubtaskGeneration.findFirst({
    where: { id: generationId, projectId, parentTaskId: taskId },
  });
  if (!generation) return { error: "Không tìm thấy phiên bản AI đã chọn." };
  const snapshot = generation.contextSnapshot as {
    sourceReferences?: AiSubtaskSourceReference[];
  };
  const coverageReport = calculateAiSubtaskCoverage(
    proposals,
    snapshot.sourceReferences ?? [],
  );
  if (!coverageReport.complete) {
    return {
      error: `Chưa thể tạo task: còn thiếu coverage ${coverageReport.missingSourceRefs.join(", ") || "hoặc có source reference không hợp lệ"}.`,
    };
  }
  const sourceHighlights = proposals.map(
    (proposal) => `AI_SUBTASK:${taskId}:${proposal.sourceKey}`,
  );
  const existing = await prisma.task.findMany({
    where: { projectId, deletedAt: null, sourceHighlight: { in: sourceHighlights } },
    select: { sourceHighlight: true },
  });
  const existingKeys = new Set(existing.map((item) => item.sourceHighlight));
  const creatable = proposals.filter(
    (proposal) => !existingKeys.has(`AI_SUBTASK:${taskId}:${proposal.sourceKey}`),
  );

  if (creatable.length === 0) {
    return {
      success: `Không tạo sub-task mới. ${proposals.length} đề xuất đã tồn tại.`,
      created: 0,
      skipped: proposals.length,
    };
  }

  const [project, taskCount, maxOrder] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { code: true } }),
    prisma.task.count({ where: { projectId } }),
    prisma.task.aggregate({
      where: { projectId, status: "BACKLOG", deletedAt: null },
      _max: { sortOrder: true },
    }),
  ]);
  const prefix = (project?.code ?? "TASK").toUpperCase();
  const firstSortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
  const relatedDocumentIds = documents.map((document) => document.id);

  const createdTasks = await prisma.$transaction(
    creatable.map((proposal, index) => {
      const derived = deriveTaskEffortFields({
        status: "BACKLOG",
        devEstimateHours: proposal.devEstimateHours,
        testEstimateHours: null,
        testEstimateSource: "AUTO",
        standardEstimateMandays: proposal.devEstimateHours / 8,
      });
      return prisma.task.create({
        data: {
          projectId,
          moduleId: task.moduleId,
          taskCode: `${prefix}-${taskCount + index + 1}`,
          title: proposal.title,
          description: proposal.description,
          acceptanceCriteria: proposal.acceptanceCriteria,
          type: "SUBTASK",
          priority: task.priority,
          status: "BACKLOG",
          assigneeId: null,
          epicId: task.epicId,
          sprintId: task.sprintId,
          milestoneId: task.milestoneId,
          parentTaskId: task.id,
          relatedDocumentId: relatedDocumentIds[0] ?? task.relatedDocumentId,
          sourceHighlight: `AI_SUBTASK:${taskId}:${proposal.sourceKey}`,
          aiSubtaskGenerationId: generation.id,
          createdById: session.user.id,
          reporterId: session.user.id,
          sortOrder: firstSortOrder + index,
          ...derived,
          relatedDocuments:
            relatedDocumentIds.length > 0
              ? {
                  create: relatedDocumentIds.map((documentId) => ({ documentId })),
                }
              : undefined,
        },
      });
    }),
  );

  await prisma.aiSubtaskGeneration.update({
    where: { id: generation.id },
    data: {
      proposals: proposals as unknown as Prisma.InputJsonValue,
      coverageReport: coverageReport as unknown as Prisma.InputJsonValue,
      totalEstimateHours: proposals.reduce(
        (sum, proposal) => sum + proposal.devEstimateHours,
        0,
      ),
      status: "ACCEPTED",
      acceptedAt: new Date(),
    },
  });
  await refreshTaskDerivedFields(taskId);
  await logAudit({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "Task",
    entityId: createdTasks[0]?.id,
    projectId,
    metadata: {
      mode: "auto_subtask",
      parentTaskId: taskId,
      generationId: generation.id,
      generationVersion: generation.versionNo,
      created: createdTasks.length,
      skipped: proposals.length - creatable.length,
      projectRole,
    },
  });

  revalidateTaskPaths(projectId, task.moduleId, taskId);
  for (const createdTask of createdTasks) {
    revalidateTaskPaths(projectId, task.moduleId, createdTask.id);
  }

  return {
    success: `Đã tạo ${createdTasks.length} sub-task, bỏ qua ${proposals.length - creatable.length} task trùng.`,
    created: createdTasks.length,
    skipped: proposals.length - creatable.length,
  };
}

export async function saveAiSubtaskDraftAction(
  projectId: string,
  taskId: string,
  generationId: string,
  rawProposals: unknown,
): Promise<ActionState> {
  const access = await getAiSubtaskParentAccess(projectId, taskId);
  if ("error" in access) return { error: access.error };
  const parsed = aiSubtaskInputSchema.safeParse(rawProposals);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Danh sách sub-task không hợp lệ." };
  }
  if (new Set(parsed.data.map((proposal) => proposal.sourceKey)).size !== parsed.data.length) {
    return { error: "Các sub-task không được trùng source key." };
  }
  const generation = await prisma.aiSubtaskGeneration.findFirst({
    where: { id: generationId, projectId, parentTaskId: taskId },
  });
  if (!generation) return { error: "Không tìm thấy phiên bản AI." };
  if (generation.status === "ACCEPTED") {
    return { error: "Phiên bản đã tạo task không thể chỉnh sửa." };
  }
  const snapshot = generation.contextSnapshot as {
    sourceReferences?: AiSubtaskSourceReference[];
  };
  const coverageReport = calculateAiSubtaskCoverage(
    parsed.data,
    snapshot.sourceReferences ?? [],
  );
  if (coverageReport.invalidSourceRefs.length > 0) {
    return { error: "Source mapping chứa tham chiếu không hợp lệ." };
  }
  await prisma.aiSubtaskGeneration.update({
    where: { id: generation.id },
    data: {
      proposals: parsed.data as unknown as Prisma.InputJsonValue,
      coverageReport: coverageReport as unknown as Prisma.InputJsonValue,
      totalEstimateHours: parsed.data.reduce(
        (sum, proposal) => sum + proposal.devEstimateHours,
        0,
      ),
    },
  });
  await logAudit({
    actorId: access.session.user.id,
    action: "UPDATE",
    entityType: "AiSubtaskGeneration",
    entityId: generation.id,
    projectId,
    metadata: { parentTaskId: taskId, versionNo: generation.versionNo },
  });
  return { success: `Đã lưu bản nháp phiên bản ${generation.versionNo}.` };
}

async function getAiSubtaskParentAccess(projectId: string, taskId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." } as const;

  const task = await prisma.task.findFirst({
    where: { id: taskId, projectId, deletedAt: null },
    include: {
      module: { select: { name: true } },
      epic: { select: { name: true } },
      sprint: { select: { name: true } },
      milestone: { select: { name: true } },
      relatedDocument: {
        select: { id: true, title: true, currentContent: true, moduleId: true },
      },
      relatedDocuments: {
        where: { document: { deletedAt: null, module: { deletedAt: null } } },
        include: {
          document: { select: { id: true, title: true, currentContent: true, moduleId: true } },
        },
      },
    },
  });
  if (!task) return { error: "Không tìm thấy task cha." } as const;
  if (task.parentTaskId) {
    return { error: "Không thể tự động phân rã tiếp một sub-task." } as const;
  }

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!(await canAccess({ systemRole: session.user.systemRole }, "task.create", projectRole))) {
    return { error: "Bạn không có quyền tạo sub-task." } as const;
  }

  const assignedModuleIds = await getAssignedModuleIdsForUser({
    projectId,
    userId: session.user.id,
    systemRole: session.user.systemRole,
    projectRole,
  });
  if (task.moduleId && !canAccessModule(assignedModuleIds, task.moduleId)) {
    return { error: "Bạn không có quyền truy cập phân hệ của task này." } as const;
  }

  const documentsById = new Map<
    string,
    { id: string; title: string; currentContent: string; moduleId: string }
  >();
  if (
    task.relatedDocument &&
    canAccessModule(assignedModuleIds, task.relatedDocument.moduleId)
  ) {
    documentsById.set(task.relatedDocument.id, task.relatedDocument);
  }
  for (const relation of task.relatedDocuments) {
    if (canAccessModule(assignedModuleIds, relation.document.moduleId)) {
      documentsById.set(relation.document.id, relation.document);
    }
  }

  return { session, task, projectRole, documents: [...documentsById.values()] } as const;
}

function normalizeStoredExternalLinks(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) =>
      typeof item === "string"
        ? item
        : item && typeof item === "object" && "url" in item && typeof item.url === "string"
          ? item.url
          : "",
    )
    .filter(Boolean);
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
    data: {
      dueDate: nextDue,
      devDueAt: nextDue,
      ...deriveTaskEffortFields({
        status: before.status,
        devEstimateHours: Number(before.devEstimateHours),
        testEstimateHours: Number(before.testEstimateHours),
        testEstimateSource: before.testEstimateSource,
        standardEstimateMandays: Number(before.standardEstimateMandays),
        actualDevHours: Number(before.actualDevHours),
        actualTestHours: Number(before.actualTestHours),
        devDueAt: nextDue,
        testDueAt: before.testDueAt,
        isBlocked: before.isBlocked,
      }),
    },
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
  const relatedDocumentIds = normalizeRelatedDocumentIds(formData);
  const externalLinks = normalizeExternalLinks(formData);
  const shouldUpdateRelatedDocuments = formData.has("relatedDocumentsTouched") || formData.has("relatedDocumentId");
  const shouldUpdateExternalLinks = formData.has("externalLinks");

  const before = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  const has = (key: string) => formData.has(key);
  const nextStatus = has("status") ? values.status : before.status;
  const nextType = has("type") ? values.type : before.type;
  const nextAssigneeId = has("assigneeId") ? values.assigneeId || null : before.assigneeId;
  const nextReviewerId = has("reviewerId") ? values.reviewerId || null : before.reviewerId;
  const nextTesterId = has("testerId") ? values.testerId || null : before.testerId;
  const nextEpicId = has("epicId") ? values.epicId || null : before.epicId;
  const nextSprintId = has("sprintId") ? values.sprintId || null : before.sprintId;
  const nextMilestoneId = has("milestoneId") ? values.milestoneId || null : before.milestoneId;
  const nextParentTaskId = has("parentTaskId") ? values.parentTaskId || null : before.parentTaskId;
  const nextStartDate = has("startDate")
    ? values.startDate
      ? new Date(values.startDate)
      : null
    : before.startDate;
  const plannedStartAt = values.plannedStartAt
    ? new Date(values.plannedStartAt)
    : values.startDate && has("plannedStartAt")
      ? new Date(values.startDate)
      : has("plannedStartAt")
        ? null
        : before.plannedStartAt;
  const nextDueDate = has("dueDate")
    ? values.dueDate
      ? new Date(values.dueDate)
      : null
    : before.dueDate;
  const devDueAt = has("devDueAt")
    ? values.devDueAt
      ? new Date(values.devDueAt)
      : values.dueDate
        ? new Date(values.dueDate)
        : null
    : before.devDueAt;
  const testDueAt = has("testDueAt") ? (values.testDueAt ? new Date(values.testDueAt) : null) : before.testDueAt;
  const nextTestEstimateSource = has("testEstimateSource") ? values.testEstimateSource : before.testEstimateSource;
  const derived = deriveTaskEffortFields({
    status: nextStatus,
    devEstimateHours: has("devEstimateHours")
      ? values.devEstimateHours ?? 0
      : has("estimateHours")
        ? values.estimateHours ?? 0
        : Number(before.devEstimateHours),
    testEstimateHours: has("testEstimateHours") ? values.testEstimateHours ?? 0 : Number(before.testEstimateHours),
    testEstimateSource: nextTestEstimateSource,
    standardEstimateMandays: has("standardEstimateMandays")
      ? values.standardEstimateMandays ?? 0
      : Number(before.standardEstimateMandays),
    actualDevHours: Number(before.actualDevHours),
    actualTestHours: Number(before.actualTestHours),
    devDueAt,
    testDueAt,
    isBlocked: before.isBlocked,
  });

  await prisma.task.update({
    where: { id: taskId },
    data: {
      title: values.title,
      description: values.description || null,
      status: nextStatus,
      type: nextType,
      assigneeId: nextAssigneeId,
      reviewerId: nextReviewerId,
      testerId: nextTesterId,
      priority: values.priority,
      epicId: nextEpicId,
      sprintId: nextSprintId,
      milestoneId: nextMilestoneId,
      parentTaskId: nextParentTaskId,
      startDate: nextStartDate,
      plannedStartAt,
      dueDate: nextDueDate,
      devDueAt,
      testDueAt,
      ...derived,
      completedAt: nextStatus === "DONE" ? new Date() : nextStatus !== before.status ? null : before.completedAt,
      storyPoint: values.storyPoint ?? before.storyPoint,
      acceptanceCriteria: values.acceptanceCriteria || null,
      relatedDocumentId: shouldUpdateRelatedDocuments
        ? relatedDocumentIds[0] ?? null
        : has("relatedDocumentId")
          ? values.relatedDocumentId || null
          : before.relatedDocumentId,
      ...(shouldUpdateExternalLinks ? { externalLinks } : {}),
    },
  });
  if (shouldUpdateRelatedDocuments) {
    await replaceTaskRelatedDocuments(
      taskId,
      projectId,
      relatedDocumentIds.length > 0
        ? relatedDocumentIds
        : !formData.has("relatedDocumentsTouched") && has("relatedDocumentId") && values.relatedDocumentId
          ? [values.relatedDocumentId]
          : [],
    );
  }

  const historyEntries: {
    taskId: string;
    changedById: string;
    field: string;
    oldValue: string | null;
    newValue: string | null;
  }[] = [];
  if (before.assigneeId !== nextAssigneeId) {
    historyEntries.push({
      taskId,
      changedById: session.user.id,
      field: "assignee",
      oldValue: before.assigneeId,
      newValue: nextAssigneeId,
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
  if (before.status !== nextStatus) {
    historyEntries.push({
      taskId,
      changedById: session.user.id,
      field: "status",
      oldValue: before.status,
      newValue: nextStatus,
    });
  }
  if (before.title !== values.title) {
    historyEntries.push({
      taskId,
      changedById: session.user.id,
      field: "title",
      oldValue: before.title,
      newValue: values.title,
    });
  }
  if ((before.description ?? "") !== (values.description ?? "")) {
    historyEntries.push({
      taskId,
      changedById: session.user.id,
      field: "description",
      oldValue: before.description,
      newValue: values.description || null,
    });
    if (values.description) {
      await notifyTaskMentions({
        projectId,
        taskId,
        taskCode: before.taskCode,
        title: values.title,
        content: values.description,
      });
    }
  }
  if ((before.acceptanceCriteria ?? "") !== (values.acceptanceCriteria ?? "")) {
    historyEntries.push({
      taskId,
      changedById: session.user.id,
      field: "acceptanceCriteria",
      oldValue: before.acceptanceCriteria,
      newValue: values.acceptanceCriteria || null,
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

export async function updateProjectKanbanStatusOrderAction(
  projectId: string,
  columns: KanbanStatusColumn[],
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." };

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true },
  });
  if (!project) return { error: "Không tìm thấy dự án." };

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!(await canAccess({ systemRole: session.user.systemRole }, "task.move", projectRole))) {
    return { error: "Bạn không có quyền cấu hình Kanban." };
  }

  const nextColumns = normalizeKanbanStatusColumns(columns);
  if (!isValidKanbanStatusColumnConfig(nextColumns)) {
    return { error: "Cấu hình trạng thái Kanban không hợp lệ." };
  }
  const nextConfig = serializeKanbanStatusColumns(nextColumns);
  const nextStatuses = visibleKanbanStatuses(nextColumns);

  await prisma.project.update({
    where: { id: projectId },
    data: { kanbanStatusOrder: nextConfig },
  });

  await logAudit({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "ProjectKanban",
    entityId: projectId,
    projectId,
    metadata: { statuses: nextStatuses, columns: nextConfig },
  });

  revalidatePath(`/projects/${projectId}/kanban`);
  return { success: "Đã cập nhật cấu hình Kanban." };
}

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
  const derived = deriveTaskEffortFields({
    status,
    devEstimateHours: Number(before.devEstimateHours),
    testEstimateHours: Number(before.testEstimateHours),
    testEstimateSource: before.testEstimateSource,
    standardEstimateMandays: Number(before.standardEstimateMandays),
    actualDevHours: Number(before.actualDevHours),
    actualTestHours: Number(before.actualTestHours),
    devDueAt: before.devDueAt,
    testDueAt: before.testDueAt,
    isBlocked: before.isBlocked,
  });

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: status as never,
      completedAt: status === "DONE" ? new Date() : status === before.status ? undefined : null,
      ...derived,
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
  const dependents = await prisma.taskDependency.findMany({
    where: { dependsOnTaskId: taskId },
    select: { taskId: true },
  });
  await Promise.all(dependents.map((dependent) => refreshTaskDerivedFields(dependent.taskId)));
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

  const mentionNames = Array.from(content.matchAll(/@([\w.]+)/g)).map((m) => m[1]);
  const members = mentionNames.length
    ? await prisma.projectMember.findMany({
        where: { projectId },
        include: { user: { select: { id: true, fullName: true, email: true } } },
      })
    : [];
  const mentionedUserIds = new Set<string>();
  for (const name of mentionNames) {
    const match = members.find(
      (m) =>
        m.user.email.split("@")[0].toLowerCase() === name.toLowerCase() ||
        m.user.fullName.replaceAll(" ", "").toLowerCase() === name.toLowerCase(),
    );
    if (match) mentionedUserIds.add(match.user.id);
  }

  const task = await prisma.task.findFirst({
    where: { id: taskId, projectId, deletedAt: null },
    select: { title: true, taskCode: true },
  });

  const comment = await prisma.comment.create({
    data: {
      taskId,
      authorId: session.user.id,
      content,
      mentions: {
        create: Array.from(mentionedUserIds).map((userId) => ({ userId })),
      },
    },
  });
  if (mentionedUserIds.size > 0) {
    await prisma.notification.createMany({
      data: Array.from(mentionedUserIds).map((userId) => ({
        userId,
        type: "task_mention",
        title: `Bạn được nhắc trong task ${task?.taskCode ?? ""}`.trim(),
        content: task?.title ?? content.slice(0, 120),
        entityType: "Task",
        entityId: taskId,
        projectId,
      })),
    });
  }

  await logAudit({
    actorId: session.user.id,
    action: "COMMENT",
    entityType: "Task",
    entityId: taskId,
    projectId,
    metadata: { commentId: comment.id, mentionedUserIds: Array.from(mentionedUserIds) },
  });

  revalidateTaskPaths(projectId, moduleId, taskId);
  return { success: "Đã gửi nhận xét." };
}

export async function addTaskTimeLogAction(
  projectId: string,
  moduleId: string | null,
  taskId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." };

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!(await canAccess({ systemRole: session.user.systemRole }, "task.edit", projectRole))) {
    return { error: "Bạn không có quyền log giờ cho task này." };
  }

  const task = await prisma.task.findFirst({
    where: { id: taskId, projectId, deletedAt: null },
    select: { id: true },
  });
  if (!task) return { error: "Không tìm thấy task." };

  const parsed = taskTimeLogSchema.safeParse({
    workType: formData.get("workType") || "DEV",
    workDate: formData.get("workDate") ?? "",
    hours: formData.get("hours") ?? "",
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu log giờ không hợp lệ." };
  }
  const values = parsed.data;

  const timeLog = await prisma.timeLog.create({
    data: {
      taskId,
      userId: session.user.id,
      workType: values.workType,
      workDate: new Date(values.workDate),
      hours: values.hours,
      description: values.description || null,
    },
  });

  await refreshTaskDerivedFields(taskId);

  await logAudit({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "Task",
    entityId: taskId,
    projectId,
    metadata: {
      field: "timeLog",
      timeLogId: timeLog.id,
      workType: values.workType,
      hours: values.hours,
    },
  });

  revalidateTaskPaths(projectId, moduleId, taskId);
  revalidatePath(`/projects/${projectId}/overview`);
  return { success: "Đã ghi nhận giờ làm." };
}

export async function updateTaskTimeLogAction(
  projectId: string,
  moduleId: string | null,
  taskId: string,
  timeLogId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." };

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!(await canAccess({ systemRole: session.user.systemRole }, "task.edit", projectRole))) {
    return { error: "Bạn không có quyền chỉnh sửa log giờ cho task này." };
  }

  const timeLog = await prisma.timeLog.findFirst({
    where: {
      id: timeLogId,
      taskId,
      userId: session.user.id,
      task: { projectId, deletedAt: null, ...(moduleId ? { moduleId } : {}) },
    },
    select: { id: true },
  });
  if (!timeLog) return { error: "Không tìm thấy log giờ của bạn." };

  const parsed = taskTimeLogSchema.safeParse({
    workType: formData.get("workType") || "DEV",
    workDate: formData.get("workDate") ?? "",
    hours: formData.get("hours") ?? "",
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu log giờ không hợp lệ." };
  }
  const values = parsed.data;

  await prisma.timeLog.update({
    where: { id: timeLogId },
    data: {
      workType: values.workType,
      workDate: new Date(values.workDate),
      hours: values.hours,
      description: values.description || null,
    },
  });

  await refreshTaskDerivedFields(taskId);

  await logAudit({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "Task",
    entityId: taskId,
    projectId,
    metadata: {
      field: "timeLog",
      timeLogId,
      workType: values.workType,
      hours: values.hours,
    },
  });

  revalidateTaskPaths(projectId, moduleId, taskId);
  revalidatePath(`/projects/${projectId}/overview`);
  return { success: "Đã cập nhật log giờ." };
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
