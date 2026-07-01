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

/**
 * Project-scoped actions, keyed to the ProjectRole values allowed to perform them.
 * ADMIN (systemRole) always passes regardless of this table - checked separately in can().
 */
const PROJECT_ROLE_MATRIX: Record<Action, ProjectRole[]> = {
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

  return PROJECT_ROLE_MATRIX[action].includes(projectRole);
}
