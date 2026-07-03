"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { ActionState } from "@/lib/actions/profile";
import type { Prisma } from "@/generated/prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.systemRole !== "ADMIN") return null;
  return session;
}

export async function createTemplateAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin();
  if (!session) return { error: "Bạn không có quyền quản lý template." };

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) return { error: "Tên template không được để trống." };

  const template = await prisma.template.create({
    data: {
      name,
      description: description || null,
      structure: { docs: [] } as unknown as Prisma.InputJsonValue,
      createdById: session.user.id,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "Template",
    entityId: template.id,
    metadata: { name },
  });

  revalidatePath("/settings/templates");
  redirect(`/settings/templates/${template.id}`);
}

export async function updateTemplateAction(
  templateId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin();
  if (!session) return { error: "Bạn không có quyền quản lý template." };

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const structureRaw = String(formData.get("structure") ?? "{}");

  let structure: unknown;
  try {
    structure = JSON.parse(structureRaw);
  } catch {
    return { error: "Cấu trúc JSON không hợp lệ." };
  }

  if (!name) return { error: "Tên template không được để trống." };

  await prisma.template.update({
    where: { id: templateId },
    data: { name, description: description || null, structure: structure as Prisma.InputJsonValue },
  });

  await logAudit({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "Template",
    entityId: templateId,
  });

  revalidatePath(`/settings/templates/${templateId}`);
  return { success: "Đã lưu template." };
}

export async function deleteTemplateAction(templateId: string) {
  const session = await requireAdmin();
  if (!session) return;

  const template = await prisma.template.findUnique({
    where: { id: templateId },
    select: { id: true, name: true },
  });
  if (!template) return;

  await logAudit({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "Template",
    entityId: templateId,
    metadata: { name: template.name, permanent: true },
  });

  await prisma.$transaction([
    prisma.project.updateMany({
      where: { templateId },
      data: { templateId: null },
    }),
    prisma.template.delete({ where: { id: templateId } }),
  ]);

  revalidatePath("/settings/templates");
  redirect("/settings/templates");
}
