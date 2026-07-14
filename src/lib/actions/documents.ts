"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { canAccessModule, getAssignedModuleIdsForUser } from "@/lib/document-type-access";
import { logAudit } from "@/lib/audit";
import { HTML_MOCKUP_MARKER, sanitizeDocumentHtml } from "@/lib/document-content";
import { documentFormSchema } from "@/lib/validation/document";
import { DOC_TEMPLATES } from "@/lib/document-templates";
import type { ActionState } from "@/lib/actions/profile";
import type { DocStatus } from "@/generated/prisma/enums";

export async function createDocumentAction(
  projectId: string,
  moduleId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." };

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!(await canAccess({ systemRole: session.user.systemRole }, "document.create", projectRole))) {
    return { error: "Bạn không có quyền tạo tài liệu." };
  }
  if (
    !(await assertCanAccessRouteModule({
      userId: session.user.id,
      systemRole: session.user.systemRole,
      projectId,
      moduleId,
    }))
  ) {
    return { error: "Bạn không có quyền truy cập phân hệ này." };
  }

  const parsed = documentFormSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    role: formData.get("role"),
    description: formData.get("description") ?? "",
    content: formData.get("content") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }
  const values = parsed.data;
  const templateId = String(formData.get("templateId") ?? "").trim() || null;
  const rfidDescription = getRfidDescription(formData);
  const description = [values.description, rfidDescription].filter(Boolean).join("\n");
  let docId = "";

  await prisma.$transaction(async (tx) => {
    const doc = await tx.document.create({
      data: {
        projectId,
        moduleId,
        title: values.title,
        category: values.category,
        role: values.role,
        description: description || null,
        currentContent: values.content || "",
        contentFormat: "MARKDOWN",
        authorId: session.user.id,
        templateId,
      },
    });
    docId = doc.id;
    await tx.documentVersion.create({
      data: {
        documentId: doc.id,
        versionNo: 1,
        title: doc.title,
        category: doc.category,
        role: doc.role,
        status: doc.status,
        description: doc.description,
        content: doc.currentContent,
        contentFormat: doc.contentFormat,
        editedById: session.user.id,
        changeNote: "Tạo mới",
      },
    });
  });

  await logAudit({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "Document",
    entityId: docId,
    projectId,
    metadata: { title: values.title },
  });

  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath(`/projects/${projectId}/overview`);
  revalidatePath(`/projects/${projectId}/modules/${moduleId}/documents`);
  redirect(`/projects/${projectId}/modules/${moduleId}/documents/${docId}`);
}

function getRfidDescription(formData: FormData) {
  const templateId = String(formData.get("templateId") ?? "").trim();

  if (templateId !== "rfid-process-flow") return "";

  const actor = String(formData.get("rfidActor") ?? "").trim();
  const rfid = String(formData.get("rfidMode") ?? "").trim();
  const document = String(formData.get("rfidDocument") ?? "").trim();
  const parts = [
    actor ? `Actor: ${actor}` : "",
    rfid ? `RFID: ${rfid}` : "",
    document ? `Chứng từ: ${document}` : "",
  ].filter(Boolean);

  return parts.join("\n");
}

/** Adds another process-flow document to the same flow group as `docId`
 * (grouped under docId's root, or docId itself if it has no parent). */
export async function createFlowDocumentAction(
  projectId: string,
  moduleId: string,
  docId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." };

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!(await canAccess({ systemRole: session.user.systemRole }, "document.create", projectRole))) {
    return { error: "Bạn không có quyền tạo tài liệu." };
  }
  if (
    !(await assertCanAccessRouteModule({
      userId: session.user.id,
      systemRole: session.user.systemRole,
      projectId,
      moduleId,
    }))
  ) {
    return { error: "Bạn không có quyền truy cập phân hệ này." };
  }

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Vui lòng nhập tiêu đề sơ đồ quy trình." };

  const doc = await getRouteDocument(projectId, moduleId, docId);
  if (!doc) return { error: "Không tìm thấy tài liệu." };

  const rootId = doc.parentDocumentId ?? doc.id;
  const template = DOC_TEMPLATES["rfid-process-flow"];
  let newDocId = "";

  await prisma.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: {
        projectId,
        moduleId,
        title,
        category: doc.category,
        role: doc.role,
        currentContent: template.content,
        contentFormat: "MARKDOWN",
        templateId: "rfid-process-flow",
        parentDocumentId: rootId,
        authorId: session.user.id,
      },
    });
    newDocId = created.id;
    await tx.documentVersion.create({
      data: {
        documentId: created.id,
        versionNo: 1,
        title: created.title,
        category: created.category,
        role: created.role,
        status: created.status,
        description: created.description,
        content: created.currentContent,
        contentFormat: created.contentFormat,
        editedById: session.user.id,
        changeNote: "Tạo mới",
      },
    });
  });

  await logAudit({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "Document",
    entityId: newDocId,
    projectId,
    metadata: { title, parentDocumentId: rootId },
  });

  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath(`/projects/${projectId}/overview`);
  revalidatePath(`/projects/${projectId}/modules/${moduleId}/documents`);
  redirect(`/projects/${projectId}/modules/${moduleId}/documents/${newDocId}`);
}

async function assertCanEdit(userId: string, systemRole: string, projectId: string) {
  const projectRole = await getProjectRole(userId, projectId);
  return await canAccess({ systemRole: systemRole as never }, "document.edit", projectRole);
}

async function assertCanAccessRouteModule({
  userId,
  systemRole,
  projectId,
  moduleId,
}: {
  userId: string;
  systemRole: string;
  projectId: string;
  moduleId: string;
}) {
  const projectRole = await getProjectRole(userId, projectId);
  const assignedModuleIds = await getAssignedModuleIdsForUser({
    projectId,
    userId,
    systemRole: systemRole as never,
    projectRole,
  });
  if (!canAccessModule(assignedModuleIds, moduleId)) return false;

  const module_ = await prisma.module.findFirst({
    where: { id: moduleId, projectId, deletedAt: null },
    select: { id: true },
  });
  return Boolean(module_);
}

async function getRouteDocument(projectId: string, moduleId: string, docId: string) {
  return prisma.document.findFirst({
    where: { id: docId, projectId, moduleId, deletedAt: null, module: { deletedAt: null } },
  });
}

const documentImportSchema = z.object({
  kind: z.literal("PMS_DOCUMENT_EXPORT"),
  version: z.literal(1),
  document: documentFormSchema.extend({
    contentFormat: z.enum(["MARKDOWN", "HTML"]).default("HTML"),
    diagramUrl: z.string().url().nullable().optional(),
    diagramTitle: z.string().trim().max(200).nullable().optional(),
  }),
});

export interface ExportDocumentState extends ActionState {
  fileName?: string;
  content?: string;
}

function safeExportFileName(prefix: string, title: string) {
  const slug = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${prefix}-${slug || "export"}.doc`;
}

function normalizeImportedDocumentContent(content: string, contentFormat: "MARKDOWN" | "HTML") {
  if (contentFormat === "MARKDOWN") return content;
  if (content.trimStart().startsWith(HTML_MOCKUP_MARKER)) return content;
  return sanitizeDocumentHtml(content);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function stripHtml(value: string) {
  return decodeHtmlEntities(value.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function documentField(field: string, label: string, value: string, multiline = false) {
  const body = multiline
    ? `<div class="pms-value">${escapeHtml(value).replace(/\n/g, "<br>") || "&nbsp;"}</div>`
    : `<div class="pms-value">${escapeHtml(value) || "&nbsp;"}</div>`;
  return `
    <section class="pms-field">
      <h2>${escapeHtml(label)}</h2>
      <!-- PMS_FIELD:${field} -->
      ${body}
      <!-- /PMS_FIELD:${field} -->
    </section>`;
}

function extractDocumentField(rawContent: string, field: string) {
  const pattern = new RegExp(`<!--\\s*PMS_FIELD:${field}\\s*-->([\\s\\S]*?)<!--\\s*/PMS_FIELD:${field}\\s*-->`, "i");
  const match = rawContent.match(pattern);
  return match?.[1]?.trim() ?? "";
}

function parseWordDocumentExport(rawContent: string) {
  const contentFormat = stripHtml(extractDocumentField(rawContent, "contentFormat")) === "MARKDOWN" ? "MARKDOWN" : "HTML";
  const diagramUrl = stripHtml(extractDocumentField(rawContent, "diagramUrl"));
  const diagramTitle = stripHtml(extractDocumentField(rawContent, "diagramTitle"));
  const content = extractDocumentField(rawContent, "content");

  const values = {
    title: stripHtml(extractDocumentField(rawContent, "title")),
    category: stripHtml(extractDocumentField(rawContent, "category")),
    role: stripHtml(extractDocumentField(rawContent, "role")),
    description: stripHtml(extractDocumentField(rawContent, "description")),
    content: contentFormat === "MARKDOWN" ? stripHtml(content) : content,
    contentFormat,
    diagramUrl: diagramUrl || null,
    diagramTitle: diagramTitle || null,
  };

  return documentImportSchema.safeParse({
    kind: "PMS_DOCUMENT_EXPORT",
    version: 1,
    document: values,
  });
}

function buildWordDocumentExport({
  title,
  category,
  role,
  description,
  content,
  contentFormat,
  diagramUrl,
  diagramTitle,
}: {
  title: string;
  category: string;
  role: string;
  description: string;
  content: string;
  contentFormat: string;
  diagramUrl: string;
  diagramTitle: string;
}) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111; line-height: 1.45; }
    .pms-note { border: 1px solid #ddd; padding: 10px; margin-bottom: 16px; background: #f7f7f7; }
    .pms-field { border: 1px solid #ddd; padding: 12px; margin: 12px 0; }
    .pms-field h2 { font-size: 14px; margin: 0 0 8px; color: #555; }
    .pms-value { min-height: 20px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #bbb; padding: 4px 6px; }
  </style>
</head>
<body>
  <div class="pms-note">
    <strong>Hướng dẫn:</strong> Có thể mở file này bằng Microsoft Word hoặc Google Docs để chỉnh sửa.
    Khi import lại PMS, hãy giữ các tiêu đề trường bên dưới và chỉ sửa nội dung trong từng box.
  </div>
  ${documentField("title", "Tiêu đề", title)}
  ${documentField("category", "Danh mục PMS (không đổi nếu không chắc)", category)}
  ${documentField("role", "Vai trò phụ trách PMS (không đổi nếu không chắc)", role)}
  ${documentField("description", "Mô tả", description, true)}
  ${documentField("contentFormat", "Định dạng nội dung PMS (MARKDOWN hoặc HTML)", contentFormat)}
  ${documentField("diagramUrl", "URL sơ đồ / mockup", diagramUrl)}
  ${documentField("diagramTitle", "Tên sơ đồ / mockup", diagramTitle)}
  <section class="pms-field">
    <h2>Nội dung tài liệu</h2>
    <!-- PMS_FIELD:content -->
    <div class="pms-value">${contentFormat === "HTML" ? content : escapeHtml(content).replace(/\n/g, "<br>")}</div>
    <!-- /PMS_FIELD:content -->
  </section>
</body>
</html>`;
}

export async function exportDocumentForEditingAction(
  projectId: string,
  moduleId: string,
  docId: string,
): Promise<ExportDocumentState> {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." };

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!(await canAccess({ systemRole: session.user.systemRole }, "document.view", projectRole))) {
    return { error: "Bạn không có quyền xem tài liệu này." };
  }
  if (
    !(await assertCanAccessRouteModule({
      userId: session.user.id,
      systemRole: session.user.systemRole,
      projectId,
      moduleId,
    }))
  ) {
    return { error: "Bạn không có quyền truy cập phân hệ này." };
  }

  const doc = await getRouteDocument(projectId, moduleId, docId);
  if (!doc) return { error: "Không tìm thấy tài liệu." };

  const content = buildWordDocumentExport({
    title: doc.title,
    category: doc.category,
    role: doc.role,
    description: doc.description ?? "",
    content: doc.currentContent,
    contentFormat: doc.contentFormat,
    diagramUrl: doc.diagramUrl ?? "",
    diagramTitle: doc.diagramTitle ?? "",
  });

  await logAudit({
    actorId: session.user.id,
    action: "EXPORT",
    entityType: "Document",
    entityId: docId,
    projectId,
    metadata: { mode: "offline_edit_word_doc" },
  });

  return {
    success: "Đã chuẩn bị file Word để chỉnh sửa tài liệu.",
    fileName: safeExportFileName("document", doc.title),
    content,
  };
}

export async function importDocumentFromFileAction(
  projectId: string,
  moduleId: string,
  docId: string,
  rawContent: string,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." };

  if (!(await assertCanEdit(session.user.id, session.user.systemRole, projectId))) {
    return { error: "Bạn không có quyền chỉnh sửa tài liệu này." };
  }
  if (
    !(await assertCanAccessRouteModule({
      userId: session.user.id,
      systemRole: session.user.systemRole,
      projectId,
      moduleId,
    }))
  ) {
    return { error: "Bạn không có quyền truy cập phân hệ này." };
  }

  let parsed = parseWordDocumentExport(rawContent);
  if (!parsed.success) {
    try {
      parsed = documentImportSchema.safeParse(JSON.parse(rawContent));
    } catch {
      return { error: "File import không đúng định dạng Word/HTML tài liệu PMS." };
    }
  }
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "File import không đúng định dạng tài liệu PMS." };
  }

  const doc = await getRouteDocument(projectId, moduleId, docId);
  if (!doc) return { error: "Không tìm thấy tài liệu." };

  const values = parsed.data.document;
  const content = normalizeImportedDocumentContent(values.content || "", values.contentFormat);
  const nextVersionNo = doc.currentVersionNo + 1;

  await prisma.$transaction([
    prisma.document.update({
      where: { id: docId },
      data: {
        title: values.title,
        category: values.category,
        role: values.role,
        description: values.description || null,
        currentContent: content,
        contentFormat: values.contentFormat,
        currentVersionNo: nextVersionNo,
        diagramUrl: values.diagramUrl ?? null,
        diagramTitle: values.diagramTitle ?? null,
      },
    }),
    prisma.documentVersion.create({
      data: {
        documentId: docId,
        versionNo: nextVersionNo,
        title: values.title,
        category: values.category,
        role: values.role,
        status: doc.status,
        description: values.description || null,
        content,
        contentFormat: values.contentFormat,
        editedById: session.user.id,
        changeNote: "Import từ file chỉnh sửa offline",
      },
    }),
  ]);

  await logAudit({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "Document",
    entityId: docId,
    projectId,
    metadata: { mode: "offline_import_word_doc", versionNo: nextVersionNo },
  });

  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath(`/projects/${projectId}/overview`);
  revalidatePath(`/projects/${projectId}/modules/${moduleId}/documents`);
  revalidatePath(`/projects/${projectId}/modules/${moduleId}/documents/${docId}`);
  return { success: `Đã import tài liệu và tạo phiên bản v${nextVersionNo}.` };
}

export async function saveDocumentEditAction(
  projectId: string,
  moduleId: string,
  docId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." };

  if (!(await assertCanEdit(session.user.id, session.user.systemRole, projectId))) {
    return { error: "Bạn không có quyền chỉnh sửa tài liệu này." };
  }

  const parsed = documentFormSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    role: formData.get("role"),
    description: formData.get("description") ?? "",
    content: formData.get("content") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }
  const values = parsed.data;
  const content = sanitizeDocumentHtml(values.content || "");

  const doc = await getRouteDocument(projectId, moduleId, docId);
  if (!doc) return { error: "Không tìm thấy tài liệu." };
  const nextVersionNo = doc.currentVersionNo + 1;

  await prisma.$transaction([
    prisma.document.update({
      where: { id: docId },
      data: {
        title: values.title,
        category: values.category,
        role: values.role,
        description: values.description || null,
        currentContent: content,
        contentFormat: "HTML",
        currentVersionNo: nextVersionNo,
      },
    }),
    prisma.documentVersion.create({
      data: {
        documentId: docId,
        versionNo: nextVersionNo,
        title: values.title,
        category: values.category,
        role: values.role,
        status: doc.status,
        description: values.description || null,
        content,
        contentFormat: "HTML",
        editedById: session.user.id,
        changeNote: "Chỉnh sửa",
      },
    }),
  ]);

  await logAudit({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "Document",
    entityId: docId,
    projectId,
    metadata: { versionNo: nextVersionNo },
  });

  revalidatePath(`/projects/${projectId}/modules/${moduleId}/documents/${docId}`);
  redirect(`/projects/${projectId}/modules/${moduleId}/documents/${docId}`);
}

/** Lightweight autosave: updates currentContent only, no new version row. */
export async function autosaveDocumentAction(docId: string, content: string) {
  const session = await auth();
  if (!session?.user) return { ok: false };

  const doc = await prisma.document.findFirst({
    where: { id: docId, deletedAt: null, module: { deletedAt: null } },
  });
  if (!doc) return { ok: false };

  if (!(await assertCanEdit(session.user.id, session.user.systemRole, doc.projectId))) {
    return { ok: false };
  }
  if (
    !(await assertCanAccessRouteModule({
      userId: session.user.id,
      systemRole: session.user.systemRole,
      projectId: doc.projectId,
      moduleId: doc.moduleId,
    }))
  ) {
    return { ok: false };
  }

  await prisma.document.update({
    where: { id: docId },
    data: { currentContent: sanitizeDocumentHtml(content), contentFormat: "HTML" },
  });

  return { ok: true };
}

export async function setDocumentDiagramUrlAction(
  projectId: string,
  moduleId: string,
  docId: string,
  url: string | null,
  title?: string | null,
) {
  const session = await auth();
  if (!session?.user) return;

  if (!(await assertCanEdit(session.user.id, session.user.systemRole, projectId))) return;
  const doc = await getRouteDocument(projectId, moduleId, docId);
  if (!doc) return;

  await prisma.document.update({
    where: { id: docId },
    data: { diagramUrl: url, ...(title !== undefined ? { diagramTitle: title } : {}) },
  });

  await logAudit({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "Document",
    entityId: docId,
    projectId,
    metadata: { field: "diagramUrl" },
  });

  revalidatePath(`/projects/${projectId}/modules/${moduleId}/documents/${docId}`);
}

const STATUS_TRANSITIONS: Record<DocStatus, DocStatus[]> = {
  DRAFT: ["REVIEW"],
  REVIEW: ["APPROVED", "DRAFT"],
  APPROVED: ["ARCHIVED", "DRAFT"],
  ARCHIVED: ["DRAFT"],
};

function actionForTransition(from: DocStatus, to: DocStatus): "document.submitReview" | "document.approve" | "document.archive" {
  if (to === "REVIEW") return "document.submitReview";
  if (to === "APPROVED") return "document.approve";
  if (to === "ARCHIVED") return "document.archive";
  return "document.submitReview";
}

export async function changeDocumentStatusAction(
  projectId: string,
  moduleId: string,
  docId: string,
  newStatus: DocStatus,
) {
  const session = await auth();
  if (!session?.user) return;

  const doc = await getRouteDocument(projectId, moduleId, docId);
  if (!doc) return;

  if (!STATUS_TRANSITIONS[doc.status].includes(newStatus)) return;

  const projectRole = await getProjectRole(session.user.id, projectId);
  const requiredAction = actionForTransition(doc.status, newStatus);
  if (!(await canAccess({ systemRole: session.user.systemRole }, requiredAction, projectRole))) {
    return;
  }

  await prisma.document.update({ where: { id: docId }, data: { status: newStatus } });

  await logAudit({
    actorId: session.user.id,
    action: newStatus === "APPROVED" ? "APPROVE" : "STATUS_CHANGE",
    entityType: "Document",
    entityId: docId,
    projectId,
    metadata: { from: doc.status, to: newStatus },
  });

  revalidatePath(`/projects/${projectId}/modules/${moduleId}/documents/${docId}`);
  revalidatePath(`/projects/${projectId}/modules/${moduleId}/documents`);
}

/** Submits a DRAFT document for review, assigning it to a chosen approver
 * via a Task so it surfaces in their "Nhiệm vụ của tôi" list. */
export async function submitDocumentForReviewAction(
  projectId: string,
  moduleId: string,
  docId: string,
  reviewerId: string,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." };

  const doc = await getRouteDocument(projectId, moduleId, docId);
  if (!doc) return { error: "Không tìm thấy tài liệu." };
  if (doc.status !== "DRAFT") return { error: "Tài liệu không ở trạng thái nháp." };

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!(await canAccess({ systemRole: session.user.systemRole }, "document.submitReview", projectRole))) {
    return { error: "Bạn không có quyền gửi duyệt tài liệu này." };
  }

  const reviewer = await prisma.user.findUnique({ where: { id: reviewerId } });
  if (!reviewer) return { error: "Không tìm thấy người được chọn." };
  const reviewerRole = await getProjectRole(reviewerId, projectId);
  if (!(await canAccess({ systemRole: reviewer.systemRole }, "document.approve", reviewerRole))) {
    return { error: "Người được chọn không có quyền phê duyệt." };
  }

  await prisma.$transaction([
    prisma.document.update({ where: { id: docId }, data: { status: "REVIEW" } }),
    prisma.task.create({
      data: {
        projectId,
        moduleId,
        title: `Phê duyệt tài liệu: ${doc.title}`,
        status: "TODO",
        priority: "HIGH",
        assigneeId: reviewerId,
        createdById: session.user.id,
        relatedDocumentId: docId,
        isReviewRequest: true,
      },
    }),
  ]);

  await logAudit({
    actorId: session.user.id,
    action: "STATUS_CHANGE",
    entityType: "Document",
    entityId: docId,
    projectId,
    metadata: { from: "DRAFT", to: "REVIEW", reviewerId },
  });

  revalidatePath(`/projects/${projectId}/modules/${moduleId}/documents/${docId}`);
  revalidatePath(`/projects/${projectId}/modules/${moduleId}/documents`);
  revalidatePath(`/dashboard/my-tasks`);
  return { success: "Đã gửi duyệt tài liệu." };
}

export async function deleteDocumentAction(
  projectId: string,
  moduleId: string,
  docId: string,
) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!(await canAccess({ systemRole: session.user.systemRole }, "document.delete", projectRole))) {
    return;
  }

  const doc = await prisma.document.findFirst({
    where: { id: docId, projectId, moduleId },
    select: { id: true, title: true, parentDocumentId: true },
  });
  if (!doc) return;

  await logAudit({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "Document",
    entityId: docId,
    projectId,
    metadata: { title: doc.title, permanent: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.document.updateMany({
      where: { parentDocumentId: docId },
      data: { parentDocumentId: null },
    });
    await tx.document.delete({ where: { id: docId } });
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/modules/${moduleId}/documents`);
  redirect(`/projects/${projectId}/modules/${moduleId}/documents`);
}

export async function addLinkAttachmentAction(
  projectId: string,
  moduleId: string,
  docId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." };

  if (!(await assertCanEdit(session.user.id, session.user.systemRole, projectId))) {
    return { error: "Bạn không có quyền thêm đính kèm." };
  }
  const doc = await getRouteDocument(projectId, moduleId, docId);
  if (!doc) return { error: "Không tìm thấy tài liệu." };

  const url = String(formData.get("url") ?? "").trim();
  const fileName = String(formData.get("fileName") ?? "").trim();
  if (!url) return { error: "Vui lòng nhập URL." };

  await prisma.attachment.create({
    data: {
      documentId: docId,
      kind: "LINK",
      url,
      fileName: fileName || null,
      uploadedById: session.user.id,
    },
  });

  revalidatePath(`/projects/${projectId}/modules/${moduleId}/documents/${docId}`);
  return { success: "Đã thêm liên kết." };
}

export async function recordUploadedAttachmentAction(
  projectId: string,
  moduleId: string,
  docId: string,
  input: { kind: "IMAGE" | "PDF" | "EXCEL"; url: string; fileName: string; mimeType?: string; sizeBytes?: number },
) {
  const session = await auth();
  if (!session?.user) return;

  if (!(await assertCanEdit(session.user.id, session.user.systemRole, projectId))) return;
  const doc = await getRouteDocument(projectId, moduleId, docId);
  if (!doc) return;

  await prisma.attachment.create({
    data: {
      documentId: docId,
      kind: input.kind,
      url: input.url,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      uploadedById: session.user.id,
    },
  });

  revalidatePath(`/projects/${projectId}/modules/${moduleId}/documents/${docId}`);
}

export async function deleteAttachmentAction(
  projectId: string,
  moduleId: string,
  docId: string,
  attachmentId: string,
) {
  const session = await auth();
  if (!session?.user) return;
  if (!(await assertCanEdit(session.user.id, session.user.systemRole, projectId))) return;

  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, document: { id: docId, projectId, moduleId, deletedAt: null } },
    select: { id: true },
  });
  if (!attachment) return;

  await prisma.attachment.delete({ where: { id: attachmentId } });
  revalidatePath(`/projects/${projectId}/modules/${moduleId}/documents/${docId}`);
}
