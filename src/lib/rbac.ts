import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { ProjectRole, SystemRole } from "@/generated/prisma/enums";

export type Action =
  | "document.view"
  | "document.create"
  | "document.edit"
  | "document.submitReview"
  | "document.approve"
  | "document.archive"
  | "document.delete"
  | "comment.create"
  | "task.view"
  | "task.create"
  | "task.edit"
  | "task.reassign"
  | "project.manageMembers"
  | "project.editSettings"
  | "project.export"
  | "module.manage"
  | "template.manage"
  | "admin.access";

export const PROJECT_ROLE_OPTIONS: ProjectRole[] = ["OWNER", "PO", "BA", "DEV", "TESTER", "VIEWER"];

export const RBAC_ACTION_LABELS: Record<Action, string> = {
  "document.view": "Xem tài liệu",
  "document.create": "Tạo tài liệu",
  "document.edit": "Sửa tài liệu",
  "document.submitReview": "Gửi duyệt tài liệu",
  "document.approve": "Phê duyệt tài liệu",
  "document.archive": "Lưu trữ tài liệu",
  "document.delete": "Xóa tài liệu",
  "comment.create": "Bình luận",
  "task.view": "Xem task",
  "task.create": "Tạo task",
  "task.edit": "Sửa task",
  "task.reassign": "Gán lại task",
  "project.manageMembers": "Quản lý thành viên dự án",
  "project.editSettings": "Sửa cài đặt dự án",
  "project.export": "Export dự án",
  "module.manage": "Quản lý phân hệ/loại tài liệu",
  "template.manage": "Quản lý template",
  "admin.access": "Truy cập admin",
};

export const EDITABLE_RBAC_ACTIONS: Action[] = [
  "document.view",
  "document.create",
  "document.edit",
  "document.submitReview",
  "document.approve",
  "document.archive",
  "document.delete",
  "comment.create",
  "task.view",
  "task.create",
  "task.edit",
  "task.reassign",
  "project.manageMembers",
  "project.editSettings",
  "project.export",
  "module.manage",
];

export type PermissionMatrix = Record<Action, ProjectRole[]>;

const PERMISSION_MATRIX_SETTING_KEY = "rolePermissionMatrix";

const DEFAULT_PROJECT_ROLE_MATRIX: PermissionMatrix = {
  "document.view": ["OWNER", "PO", "BA", "DEV", "TESTER", "VIEWER"],
  "document.create": ["OWNER", "PO", "BA", "DEV", "TESTER"],
  "document.edit": ["OWNER", "PO", "BA", "DEV", "TESTER"],
  "document.submitReview": ["OWNER", "PO", "BA", "DEV", "TESTER"],
  "document.approve": ["OWNER", "PO", "BA"],
  "document.archive": ["OWNER", "PO", "BA"],
  "document.delete": ["OWNER", "PO"],
  "comment.create": ["OWNER", "PO", "BA", "DEV", "TESTER", "VIEWER"],
  "task.view": ["OWNER", "PO", "BA", "DEV", "TESTER", "VIEWER"],
  "task.create": ["OWNER", "PO", "BA", "DEV", "TESTER"],
  "task.edit": ["OWNER", "PO", "BA", "DEV", "TESTER"],
  "task.reassign": ["OWNER", "PO", "BA"],
  "project.manageMembers": ["OWNER", "PO"],
  "project.editSettings": ["OWNER", "PO"],
  "project.export": ["OWNER", "PO", "BA"],
  "module.manage": ["OWNER", "PO", "BA"],
  // template.manage and admin.access are ADMIN-only (systemRole), never granted via project role
  "template.manage": [],
  "admin.access": [],
};

export interface RbacUser {
  systemRole: SystemRole;
}

export function getDefaultPermissionMatrix(): PermissionMatrix {
  return Object.fromEntries(
    Object.entries(DEFAULT_PROJECT_ROLE_MATRIX).map(([action, roles]) => [action, [...roles]]),
  ) as PermissionMatrix;
}

export function normalizePermissionMatrix(value: unknown): PermissionMatrix {
  const matrix = getDefaultPermissionMatrix();
  if (!value || typeof value !== "object" || Array.isArray(value)) return matrix;

  const rawMatrix = value as Partial<Record<Action, unknown>>;
  for (const action of EDITABLE_RBAC_ACTIONS) {
    const rawRoles = rawMatrix[action];
    if (!Array.isArray(rawRoles)) continue;

    matrix[action] = rawRoles.filter((role): role is ProjectRole =>
      PROJECT_ROLE_OPTIONS.includes(role as ProjectRole),
    );
  }

  return matrix;
}

export const getPermissionMatrix = cache(async () => {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: PERMISSION_MATRIX_SETTING_KEY },
  });

  return normalizePermissionMatrix(setting?.value);
});

/**
 * Authorizes an action. `projectRole` is the caller's ProjectMember.role for the
 * project the action targets, or null/undefined for actions with no project scope
 * (e.g. admin.access, template.manage) or if the user isn't a member of that project.
 */
export function can(
  user: RbacUser,
  action: Action,
  projectRole?: ProjectRole | null,
): boolean {
  if (user.systemRole === "ADMIN") return true;

  if (action === "admin.access" || action === "template.manage") {
    return false;
  }

  if (!projectRole) return false;

  return DEFAULT_PROJECT_ROLE_MATRIX[action].includes(projectRole);
}

export async function canAccess(
  user: RbacUser,
  action: Action,
  projectRole?: ProjectRole | null,
): Promise<boolean> {
  if (user.systemRole === "ADMIN") return true;

  if (action === "admin.access" || action === "template.manage") {
    return false;
  }

  if (!projectRole) return false;

  const permissionMatrix = await getPermissionMatrix();
  return permissionMatrix[action].includes(projectRole);
}
