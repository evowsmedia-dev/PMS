"use server";

import { refresh, revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { logAudit } from "@/lib/audit";
import type { ActionState } from "@/lib/actions/profile";

export async function createModuleAction(
  projectId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." };

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!can({ systemRole: session.user.systemRole }, "module.manage", projectRole)) {
    return { error: "Bạn không có quyền tạo phân hệ." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Tên phân hệ không được để trống." };

  const maxOrder = await prisma.module.aggregate({
    where: { projectId, deletedAt: null },
    _max: { sortOrder: true },
  });

  const module_ = await prisma.module.create({
    data: {
      projectId,
      name,
      icon: "FolderOpen",
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "Module",
    entityId: module_.id,
    projectId,
    metadata: { name },
  });

  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath(`/projects/${projectId}/overview`);
  refresh();
  return { success: `Đã tạo phân hệ "${name}".` };
}

export async function renameModuleAction(
  projectId: string,
  moduleId: string,
  name: string,
) {
  const session = await auth();
  if (!session?.user) return;

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!can({ systemRole: session.user.systemRole }, "module.manage", projectRole)) {
    return;
  }
  if (!name.trim()) return;

  await prisma.module.update({
    where: { id: moduleId },
    data: { name: name.trim() },
  });

  await logAudit({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "Module",
    entityId: moduleId,
    projectId,
    metadata: { name },
  });

  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath(`/projects/${projectId}/overview`);
  refresh();
}

export async function deleteModuleAction(projectId: string, moduleId: string) {
  const session = await auth();
  if (!session?.user) return;

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!can({ systemRole: session.user.systemRole }, "module.manage", projectRole)) {
    return;
  }

  const module_ = await prisma.module.findFirst({
    where: { id: moduleId, projectId },
    select: { id: true, name: true },
  });
  if (!module_) return;

  await logAudit({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "Module",
    entityId: moduleId,
    projectId,
    metadata: { name: module_.name, permanent: true },
  });

  await prisma.module.delete({ where: { id: moduleId } });

  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath(`/projects/${projectId}/overview`);
  refresh();
}

export async function reorderModulesAction(
  projectId: string,
  orderedModuleIds: string[],
) {
  const session = await auth();
  if (!session?.user) return;

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!can({ systemRole: session.user.systemRole }, "module.manage", projectRole)) {
    return;
  }

  await prisma.$transaction(
    orderedModuleIds.map((id, index) =>
      prisma.module.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );

  revalidatePath(`/projects/${projectId}`, "layout");
  refresh();
}
