"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { logAudit } from "@/lib/audit";
import { epicFormSchema, sprintFormSchema, milestoneFormSchema } from "@/lib/validation/planning";
import type { ActionState } from "@/lib/actions/profile";

async function requirePlanningAccess(userId: string, systemRole: string, projectId: string) {
  const projectRole = await getProjectRole(userId, projectId);
  return await canAccess({ systemRole: systemRole as never }, "task.managePlanning", projectRole);
}

// ---------------------------------------------------------------- Epics

export async function createEpicAction(
  projectId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." };
  if (!(await requirePlanningAccess(session.user.id, session.user.systemRole, projectId))) {
    return { error: "Bạn không có quyền quản lý Epic." };
  }

  const parsed = epicFormSchema.safeParse({
    name: formData.get("name"),
    epicCode: formData.get("epicCode") ?? "",
    description: formData.get("description") ?? "",
    status: formData.get("status") || "OPEN",
    startDate: formData.get("startDate") ?? "",
    dueDate: formData.get("dueDate") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  const v = parsed.data;

  const count = await prisma.epic.count({ where: { projectId } });
  const epicCode = v.epicCode || `EPIC-${count + 1}`;

  const epic = await prisma.epic.create({
    data: {
      projectId,
      epicCode,
      name: v.name,
      description: v.description || null,
      status: v.status,
      startDate: v.startDate ? new Date(v.startDate) : null,
      dueDate: v.dueDate ? new Date(v.dueDate) : null,
      createdById: session.user.id,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "Epic",
    entityId: epic.id,
    projectId,
    metadata: { name: v.name },
  });

  revalidatePath(`/projects/${projectId}/epics`);
  return { success: "Đã tạo epic." };
}

export async function deleteEpicAction(projectId: string, epicId: string) {
  const session = await auth();
  if (!session?.user) return;
  if (!(await requirePlanningAccess(session.user.id, session.user.systemRole, projectId))) return;

  await prisma.epic.update({ where: { id: epicId }, data: { deletedAt: new Date() } });
  await logAudit({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "Epic",
    entityId: epicId,
    projectId,
  });
  revalidatePath(`/projects/${projectId}/epics`);
}

// ---------------------------------------------------------------- Sprints

export async function createSprintAction(
  projectId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." };
  if (!(await requirePlanningAccess(session.user.id, session.user.systemRole, projectId))) {
    return { error: "Bạn không có quyền quản lý Sprint." };
  }

  const parsed = sprintFormSchema.safeParse({
    name: formData.get("name"),
    goal: formData.get("goal") ?? "",
    status: formData.get("status") || "PLANNED",
    startDate: formData.get("startDate") ?? "",
    endDate: formData.get("endDate") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  const v = parsed.data;

  const sprint = await prisma.sprint.create({
    data: {
      projectId,
      name: v.name,
      goal: v.goal || null,
      status: v.status,
      startDate: new Date(v.startDate),
      endDate: new Date(v.endDate),
      createdById: session.user.id,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "Sprint",
    entityId: sprint.id,
    projectId,
    metadata: { name: v.name },
  });

  revalidatePath(`/projects/${projectId}/sprints`);
  return { success: "Đã tạo sprint." };
}

export async function deleteSprintAction(projectId: string, sprintId: string) {
  const session = await auth();
  if (!session?.user) return;
  if (!(await requirePlanningAccess(session.user.id, session.user.systemRole, projectId))) return;

  await prisma.sprint.update({ where: { id: sprintId }, data: { deletedAt: new Date() } });
  await logAudit({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "Sprint",
    entityId: sprintId,
    projectId,
  });
  revalidatePath(`/projects/${projectId}/sprints`);
}

// ---------------------------------------------------------------- Milestones

export async function createMilestoneAction(
  projectId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." };
  if (!(await requirePlanningAccess(session.user.id, session.user.systemRole, projectId))) {
    return { error: "Bạn không có quyền quản lý Milestone." };
  }

  const parsed = milestoneFormSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    status: formData.get("status") || "PLANNED",
    dueDate: formData.get("dueDate") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  const v = parsed.data;

  const milestone = await prisma.milestone.create({
    data: {
      projectId,
      name: v.name,
      description: v.description || null,
      status: v.status,
      dueDate: new Date(v.dueDate),
      completedAt: v.status === "COMPLETED" ? new Date() : null,
      createdById: session.user.id,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "Milestone",
    entityId: milestone.id,
    projectId,
    metadata: { name: v.name },
  });

  revalidatePath(`/projects/${projectId}/milestones`);
  return { success: "Đã tạo milestone." };
}

export async function deleteMilestoneAction(projectId: string, milestoneId: string) {
  const session = await auth();
  if (!session?.user) return;
  if (!(await requirePlanningAccess(session.user.id, session.user.systemRole, projectId))) return;

  await prisma.milestone.update({ where: { id: milestoneId }, data: { deletedAt: new Date() } });
  await logAudit({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "Milestone",
    entityId: milestoneId,
    projectId,
  });
  revalidatePath(`/projects/${projectId}/milestones`);
}
