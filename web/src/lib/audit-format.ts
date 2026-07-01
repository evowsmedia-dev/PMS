import type { AuditAction } from "@/generated/prisma/enums";

const ACTION_LABEL: Record<AuditAction, string> = {
  CREATE: "đã tạo",
  UPDATE: "đã cập nhật",
  DELETE: "đã xóa",
  STATUS_CHANGE: "đã đổi trạng thái",
  APPROVE: "đã phê duyệt",
  ARCHIVE: "đã lưu trữ",
  RESTORE: "đã khôi phục",
  LOGIN: "đã đăng nhập",
  LOGIN_FAILED: "đăng nhập thất bại",
  ROLE_CHANGE: "đã đổi vai trò",
  MEMBER_ADD: "đã thêm thành viên",
  MEMBER_REMOVE: "đã xóa thành viên",
  ASSIGN: "đã gán",
  COMMENT: "đã bình luận trên",
  EXPORT: "đã export",
};

const ENTITY_LABEL: Record<string, string> = {
  Document: "tài liệu",
  Task: "task",
  Project: "dự án",
  Module: "phân hệ",
  User: "người dùng",
  ProjectMember: "thành viên",
};

export function formatAuditEntry(entry: {
  action: AuditAction;
  entityType: string;
  metadata: unknown;
}): string {
  const entityLabel = ENTITY_LABEL[entry.entityType] ?? entry.entityType.toLowerCase();
  const meta = (entry.metadata ?? {}) as Record<string, unknown>;
  const name = typeof meta.title === "string" ? ` "${meta.title}"` : typeof meta.name === "string" ? ` "${meta.name}"` : "";
  return `${ACTION_LABEL[entry.action]} ${entityLabel}${name}`;
}
