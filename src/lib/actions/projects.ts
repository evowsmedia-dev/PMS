"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { getProjectRole } from "@/lib/project-role";
import { logAudit } from "@/lib/audit";
import { projectFormSchema } from "@/lib/validation/project";
import { interpolateTemplate, type TemplateStructure } from "@/lib/templates";
import type { ActionState } from "@/lib/actions/profile";

function parseProjectForm(formData: FormData) {
  return projectFormSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    description: formData.get("description") ?? "",
    icon: formData.get("icon") || "FolderKanban",
    startDate: formData.get("startDate") ?? "",
    endDate: formData.get("endDate") ?? "",
    priority: formData.get("priority") || "MEDIUM",
    templateId: formData.get("templateId") ?? "",
  });
}

export async function createProjectAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." };

  const parsed = parseProjectForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }
  const values = parsed.data;

  const existingCode = await prisma.project.findUnique({
    where: { code: values.code },
  });
  if (existingCode) {
    return { error: "Mã dự án đã tồn tại, vui lòng chọn mã khác." };
  }

  const template = values.templateId
    ? await prisma.template.findUnique({ where: { id: values.templateId } })
    : null;

  let projectId: string;

  await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        name: values.name,
        code: values.code,
        description: values.description || null,
        icon: values.icon,
        startDate: values.startDate ? new Date(values.startDate) : null,
        endDate: values.endDate ? new Date(values.endDate) : null,
        priority: values.priority,
        templateId: template?.id ?? null,
        createdById: session.user.id,
        members: {
          create: { userId: session.user.id, role: "OWNER" },
        },
      },
    });
    projectId = project.id;

    const defaultModule = await tx.module.create({
      data: {
        projectId: project.id,
        name: "Tài liệu chung",
        icon: "FolderOpen",
        sortOrder: 0,
      },
    });

    if (template) {
      const structure = template.structure as unknown as TemplateStructure;
      for (const doc of structure.docs) {
        const content = interpolateTemplate(doc.content, project.name);
        const description = interpolateTemplate(doc.description, project.name);
        const created = await tx.document.create({
          data: {
            projectId: project.id,
            moduleId: defaultModule.id,
            title: doc.title,
            category: doc.category,
            role: doc.role,
            status: doc.status,
            description,
            currentContent: content,
            currentVersionNo: 1,
            authorId: session.user.id,
          },
        });
        await tx.documentVersion.create({
          data: {
            documentId: created.id,
            versionNo: 1,
            title: created.title,
            category: created.category,
            role: created.role,
            status: created.status,
            description: created.description,
            content,
            editedById: session.user.id,
            changeNote: "Khởi tạo từ template",
          },
        });
      }
    }

    await logAudit({
      actorId: session.user.id,
      action: "CREATE",
      entityType: "Project",
      entityId: project.id,
      projectId: project.id,
      metadata: { name: project.name, template: template?.name ?? null },
    });
  });

  revalidatePath("/projects");
  redirect(`/projects/${projectId!}/overview`);
}

export async function updateProjectAction(
  projectId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." };

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!can({ systemRole: session.user.systemRole }, "project.editSettings", projectRole)) {
    return { error: "Bạn không có quyền chỉnh sửa dự án này." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const priority = String(formData.get("priority") ?? "MEDIUM");
  const highlightNote = String(formData.get("highlightNote") ?? "").trim();

  if (!name) return { error: "Tên dự án không được để trống." };

  await prisma.project.update({
    where: { id: projectId },
    data: {
      name,
      description: description || null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      priority: priority as never,
      highlightNote: highlightNote || null,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "Project",
    entityId: projectId,
    projectId,
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: "Đã cập nhật thông tin dự án." };
}

export async function archiveProjectAction(projectId: string) {
  const session = await auth();
  if (!session?.user) return;

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!can({ systemRole: session.user.systemRole }, "project.editSettings", projectRole)) {
    return;
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  const nextStatus = project?.status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED";

  await prisma.project.update({
    where: { id: projectId },
    data: {
      status: nextStatus,
      archivedAt: nextStatus === "ARCHIVED" ? new Date() : null,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "ARCHIVE",
    entityType: "Project",
    entityId: projectId,
    projectId,
    metadata: { status: nextStatus },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

export async function deleteProjectAction(projectId: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!can({ systemRole: session.user.systemRole }, "project.editSettings", projectRole)) {
    return;
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, code: true },
  });
  if (!project) return;

  await logAudit({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "Project",
    entityId: projectId,
    projectId,
    metadata: { name: project.name, code: project.code, permanent: true },
  });

  await prisma.project.delete({ where: { id: projectId } });

  revalidatePath("/projects");
  redirect("/projects");
}

export async function addMemberAction(
  projectId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập." };

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!can({ systemRole: session.user.systemRole }, "project.manageMembers", projectRole)) {
    return { error: "Bạn không có quyền quản lý thành viên." };
  }

  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "DEV");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { error: "Không tìm thấy người dùng với email này." };

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (existing) return { error: "Người dùng đã là thành viên dự án." };

  await prisma.projectMember.create({
    data: { projectId, userId: user.id, role: role as never },
  });

  await logAudit({
    actorId: session.user.id,
    action: "MEMBER_ADD",
    entityType: "Project",
    entityId: projectId,
    projectId,
    metadata: { userId: user.id, role },
  });

  revalidatePath(`/projects/${projectId}/settings/members`);
  return { success: `Đã thêm ${user.fullName} vào dự án.` };
}

export async function removeMemberAction(projectId: string, memberId: string) {
  const session = await auth();
  if (!session?.user) return;

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!can({ systemRole: session.user.systemRole }, "project.manageMembers", projectRole)) {
    return;
  }

  const member = await prisma.projectMember.findUnique({ where: { id: memberId } });
  if (!member) return;

  await prisma.projectMember.delete({ where: { id: memberId } });

  await logAudit({
    actorId: session.user.id,
    action: "MEMBER_REMOVE",
    entityType: "Project",
    entityId: projectId,
    projectId,
    metadata: { userId: member.userId },
  });

  revalidatePath(`/projects/${projectId}/settings/members`);
}

export async function assignMemberDocumentTypeAction(
  projectId: string,
  memberId: string,
  moduleId: string,
) {
  const session = await auth();
  if (!session?.user) return;

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!can({ systemRole: session.user.systemRole }, "project.manageMembers", projectRole)) {
    return;
  }

  const [member, module_] = await Promise.all([
    prisma.projectMember.findFirst({ where: { id: memberId, projectId } }),
    prisma.module.findFirst({ where: { id: moduleId, projectId, deletedAt: null } }),
  ]);
  if (!member || !module_) return;

  await prisma.projectMemberDocumentTypeAssignment.upsert({
    where: { projectMemberId_moduleId: { projectMemberId: memberId, moduleId } },
    create: { projectMemberId: memberId, moduleId },
    update: {},
  });

  await logAudit({
    actorId: session.user.id,
    action: "ASSIGN",
    entityType: "ProjectMember",
    entityId: memberId,
    projectId,
    metadata: { moduleId, assigned: true },
  });

  revalidatePath(`/projects/${projectId}/settings/members`);
  revalidatePath(`/projects/${projectId}`);
}

export async function unassignMemberDocumentTypeAction(
  projectId: string,
  memberId: string,
  moduleId: string,
) {
  const session = await auth();
  if (!session?.user) return;

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!can({ systemRole: session.user.systemRole }, "project.manageMembers", projectRole)) {
    return;
  }

  await prisma.projectMemberDocumentTypeAssignment.deleteMany({
    where: { projectMemberId: memberId, moduleId, projectMember: { projectId } },
  });

  await logAudit({
    actorId: session.user.id,
    action: "ASSIGN",
    entityType: "ProjectMember",
    entityId: memberId,
    projectId,
    metadata: { moduleId, assigned: false },
  });

  revalidatePath(`/projects/${projectId}/settings/members`);
  revalidatePath(`/projects/${projectId}`);
}

export async function changeMemberRoleAction(
  projectId: string,
  memberId: string,
  role: string,
) {
  const session = await auth();
  if (!session?.user) return;

  const projectRole = await getProjectRole(session.user.id, projectId);
  if (!can({ systemRole: session.user.systemRole }, "project.manageMembers", projectRole)) {
    return;
  }

  await prisma.projectMember.update({
    where: { id: memberId },
    data: { role: role as never },
  });

  await logAudit({
    actorId: session.user.id,
    action: "ROLE_CHANGE",
    entityType: "ProjectMember",
    entityId: memberId,
    projectId,
    metadata: { role },
  });

  revalidatePath(`/projects/${projectId}/settings/members`);
}
