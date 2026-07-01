"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { logAudit } from "@/lib/audit";
import type { ActionState } from "@/lib/actions/profile";

export async function addDocumentCommentAction(
  projectId: string,
  moduleId: string,
  docId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." };

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!can({ systemRole: session.user.systemRole }, "comment.create", projectRole)) {
    return { error: "Bạn không có quyền bình luận." };
  }

  const content = String(formData.get("content") ?? "").trim();
  if (!content) return { error: "Nội dung bình luận không được để trống." };

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

  const comment = await prisma.comment.create({
    data: {
      documentId: docId,
      authorId: session.user.id,
      content,
      mentions: {
        create: Array.from(mentionedUserIds).map((userId) => ({ userId })),
      },
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "COMMENT",
    entityType: "Document",
    entityId: docId,
    projectId,
    metadata: { commentId: comment.id },
  });

  revalidatePath(`/projects/${projectId}/modules/${moduleId}/documents/${docId}`);
  return { success: "Đã gửi nhận xét." };
}

export async function resolveCommentAction(
  projectId: string,
  moduleId: string,
  docId: string,
  commentId: string,
  resolved: boolean,
) {
  const session = await auth();
  if (!session?.user) return;

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!can({ systemRole: session.user.systemRole }, "comment.create", projectRole)) return;

  await prisma.comment.update({ where: { id: commentId }, data: { resolved } });
  revalidatePath(`/projects/${projectId}/modules/${moduleId}/documents/${docId}`);
}
