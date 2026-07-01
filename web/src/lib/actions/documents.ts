"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { logAudit } from "@/lib/audit";
import { documentFormSchema } from "@/lib/validation/document";
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
  if (!can({ systemRole: session.user.systemRole }, "document.create", projectRole)) {
    return { error: "Bạn không có quyền tạo tài liệu." };
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
  let docId = "";

  await prisma.$transaction(async (tx) => {
    const doc = await tx.document.create({
      data: {
        projectId,
        moduleId,
        title: values.title,
        category: values.category,
        role: values.role,
        description: values.description || null,
        currentContent: values.content || "",
        authorId: session.user.id,
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

  revalidatePath(`/projects/${projectId}/modules/${moduleId}/documents`);
  redirect(`/projects/${projectId}/modules/${moduleId}/documents/${docId}`);
}

async function assertCanEdit(userId: string, systemRole: string, projectId: string) {
  const projectRole = await getProjectRole(userId, projectId);
  return can({ systemRole: systemRole as never }, "document.edit", projectRole);
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

  const doc = await prisma.document.findUniqueOrThrow({ where: { id: docId } });
  const nextVersionNo = doc.currentVersionNo + 1;

  await prisma.$transaction([
    prisma.document.update({
      where: { id: docId },
      data: {
        title: values.title,
        category: values.category,
        role: values.role,
        description: values.description || null,
        currentContent: values.content || "",
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
        content: values.content || "",
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

  const doc = await prisma.document.findUnique({ where: { id: docId } });
  if (!doc) return { ok: false };

  if (!(await assertCanEdit(session.user.id, session.user.systemRole, doc.projectId))) {
    return { ok: false };
  }

  await prisma.document.update({
    where: { id: docId },
    data: { currentContent: content },
  });

  return { ok: true };
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

  const doc = await prisma.document.findUnique({ where: { id: docId } });
  if (!doc) return;

  if (!STATUS_TRANSITIONS[doc.status].includes(newStatus)) return;

  const projectRole = await getProjectRole(session.user.id, projectId);
  const requiredAction = actionForTransition(doc.status, newStatus);
  if (!can({ systemRole: session.user.systemRole }, requiredAction, projectRole)) {
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

export async function deleteDocumentAction(
  projectId: string,
  moduleId: string,
  docId: string,
) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!can({ systemRole: session.user.systemRole }, "document.delete", projectRole)) {
    return;
  }

  await prisma.document.update({ where: { id: docId }, data: { deletedAt: new Date() } });

  await logAudit({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "Document",
    entityId: docId,
    projectId,
  });

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

  await prisma.attachment.delete({ where: { id: attachmentId } });
  revalidatePath(`/projects/${projectId}/modules/${moduleId}/documents/${docId}`);
}
