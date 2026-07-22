import { z } from "zod";

// ------------------------------------------------------------------
// Task status / type / priority constants
// ------------------------------------------------------------------

export const TASK_STATUS_ORDER = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "CODE_REVIEW",
  "READY_FOR_QA",
  "TESTING",
  "BUG_FIXING",
  "REOPENED",
  "READY_FOR_UAT",
  "DONE",
  "CANCELLED",
  "BLOCKED",
] as const;

export type TaskStatusValue = (typeof TASK_STATUS_ORDER)[number];

export const TASK_STATUS_LABEL: Record<string, string> = {
  BACKLOG: "Backlog",
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  CODE_REVIEW: "Code Review",
  READY_FOR_QA: "Ready for QA",
  TESTING: "Testing",
  BUG_FIXING: "Bug Fixing",
  REOPENED: "Reopened",
  READY_FOR_UAT: "Ready for UAT",
  DONE: "Done",
  CANCELLED: "Cancelled",
  BLOCKED: "Blocked",
};

/** Columns shown on the Kanban board, in order. CANCELLED/BLOCKED are states
 * a task can hold but are not primary flow columns; they still render if a task
 * is in them. */
export const KANBAN_COLUMNS: TaskStatusValue[] = [...TASK_STATUS_ORDER];

/** Statuses that count as "completed" for reporting. */
export const DONE_STATUSES = ["DONE", "CANCELLED"] as const;

export const TASK_TYPE_ORDER = [
  "EPIC",
  "STORY",
  "TASK",
  "SUBTASK",
  "BUG",
  "IMPROVEMENT",
  "RESEARCH",
  "DOCUMENTATION",
  "TEST",
  "UAT",
] as const;

export const TASK_TYPE_LABEL: Record<string, string> = {
  EPIC: "Epic",
  STORY: "Story",
  TASK: "Task",
  SUBTASK: "Subtask",
  BUG: "Bug",
  IMPROVEMENT: "Improvement",
  RESEARCH: "Research",
  DOCUMENTATION: "Documentation",
  TEST: "Test",
  UAT: "UAT",
};

export const TASK_PRIORITY_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const TASK_PRIORITY_LABEL: Record<string, string> = {
  LOW: "Thấp",
  MEDIUM: "Trung bình",
  HIGH: "Cao",
  CRITICAL: "Khẩn cấp",
};

export const TEST_ESTIMATE_SOURCE_LABEL: Record<string, string> = {
  AUTO: "Tự động",
  MANUAL: "Thủ công",
};

export const TASK_WORK_TYPE_ORDER = ["DEV", "TEST", "BA", "PM", "REVIEW", "OTHER"] as const;

export const TASK_WORK_TYPE_LABEL: Record<string, string> = {
  DEV: "Dev",
  TEST: "Test",
  BA: "BA",
  PM: "PM",
  REVIEW: "Review",
  OTHER: "Khác",
};

export const TASK_WARNING_LABEL: Record<string, string> = {
  DEV_OVER_STANDARD: "Dev estimate vượt chuẩn",
  TEST_GREATER_THAN_DEV: "Test estimate lớn hơn Dev",
};

export const BUG_SEVERITY_ORDER = ["MINOR", "MEDIUM", "MAJOR", "CRITICAL", "BLOCKER"] as const;

export const BUG_SEVERITY_LABEL: Record<string, string> = {
  MINOR: "Nhẹ",
  MEDIUM: "Trung bình",
  MAJOR: "Nghiêm trọng",
  CRITICAL: "Rất nghiêm trọng",
  BLOCKER: "Chặn",
};

export const BUG_STATUS_ORDER = [
  "OPEN",
  "IN_PROGRESS",
  "FIXED",
  "VERIFIED",
  "CLOSED",
  "REOPENED",
] as const;

export const BUG_STATUS_LABEL: Record<string, string> = {
  OPEN: "Mở",
  IN_PROGRESS: "Đang xử lý",
  FIXED: "Đã sửa",
  VERIFIED: "Đã kiểm chứng",
  CLOSED: "Đã đóng",
  REOPENED: "Mở lại",
};

export const TEST_CASE_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  ACTIVE: "Hoạt động",
  DEPRECATED: "Ngừng dùng",
};

export const TEST_RUN_STATUS_LABEL: Record<string, string> = {
  PLANNED: "Đã lên kế hoạch",
  IN_PROGRESS: "Đang chạy",
  COMPLETED: "Hoàn thành",
};

export const TEST_RESULT_ORDER = ["PASS", "FAIL", "BLOCKED", "SKIPPED"] as const;

export const TEST_RESULT_LABEL: Record<string, string> = {
  PASS: "Đạt",
  FAIL: "Không đạt",
  BLOCKED: "Bị chặn",
  SKIPPED: "Bỏ qua",
};

export const EPIC_STATUS_LABEL: Record<string, string> = {
  OPEN: "Mở",
  IN_PROGRESS: "Đang thực hiện",
  DONE: "Hoàn thành",
  CANCELLED: "Đã hủy",
};

export const SPRINT_STATUS_LABEL: Record<string, string> = {
  PLANNED: "Đã lên kế hoạch",
  ACTIVE: "Đang chạy",
  COMPLETED: "Hoàn thành",
};

export const MILESTONE_STATUS_LABEL: Record<string, string> = {
  PLANNED: "Đã lên kế hoạch",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Hoàn thành",
};

// ------------------------------------------------------------------
// Zod schemas
// ------------------------------------------------------------------

export const taskFormSchema = z.object({
  title: z.string().trim().min(1, "Tiêu đề không được để trống").max(200),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  status: z.enum(TASK_STATUS_ORDER).default("BACKLOG"),
  type: z.enum(TASK_TYPE_ORDER).default("TASK"),
  assigneeId: z.string().optional().or(z.literal("")),
  reviewerId: z.string().optional().or(z.literal("")),
  testerId: z.string().optional().or(z.literal("")),
  priority: z.enum(TASK_PRIORITY_ORDER).default("MEDIUM"),
  epicId: z.string().optional().or(z.literal("")),
  sprintId: z.string().optional().or(z.literal("")),
  milestoneId: z.string().optional().or(z.literal("")),
  parentTaskId: z.string().optional().or(z.literal("")),
  startDate: z.string().optional().or(z.literal("")),
  plannedStartAt: z.string().optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")),
  devDueAt: z.string().optional().or(z.literal("")),
  testDueAt: z.string().optional().or(z.literal("")),
  estimateHours: z.coerce.number().min(0).max(100000).optional(),
  devEstimateHours: z.coerce.number().min(0).max(100000).optional(),
  testEstimateHours: z.coerce.number().min(0).max(100000).optional(),
  testEstimateSource: z.enum(["AUTO", "MANUAL"]).default("AUTO"),
  standardEstimateMandays: z.coerce.number().min(0).max(100000).optional(),
  taskMandays: z.coerce.number().min(0).max(100000).optional(),
  devContractMandays: z.coerce.number().min(0).max(100000).optional(),
  testerContractMandays: z.coerce.number().min(0).max(100000).optional(),
  reviewerContractMandays: z.coerce.number().min(0).max(100000).optional(),
  storyPoint: z.coerce.number().min(0).max(1000).optional(),
  acceptanceCriteria: z.string().trim().max(5000).optional().or(z.literal("")),
  relatedDocumentId: z.string().optional().or(z.literal("")),
  sourceHighlight: z.string().optional().or(z.literal("")),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

export const taskTimeLogSchema = z.object({
  workType: z.enum(TASK_WORK_TYPE_ORDER).default("DEV"),
  workDate: z.string().min(1, "Ngày làm việc không được để trống"),
  hours: z.coerce.number().positive("Số giờ phải lớn hơn 0").max(24),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type TaskTimeLogValues = z.infer<typeof taskTimeLogSchema>;

export const bugFormSchema = z.object({
  title: z.string().trim().min(1, "Tiêu đề không được để trống").max(200),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  severity: z.enum(BUG_SEVERITY_ORDER).default("MEDIUM"),
  priority: z.enum(TASK_PRIORITY_ORDER).default("MEDIUM"),
  taskId: z.string().optional().or(z.literal("")),
  environment: z.string().trim().max(200).optional().or(z.literal("")),
  stepsToReproduce: z.string().trim().max(5000).optional().or(z.literal("")),
  expectedResult: z.string().trim().max(5000).optional().or(z.literal("")),
  actualResult: z.string().trim().max(5000).optional().or(z.literal("")),
  assignedToId: z.string().optional().or(z.literal("")),
});

export type BugFormValues = z.infer<typeof bugFormSchema>;

export const testCaseFormSchema = z.object({
  title: z.string().trim().min(1, "Tiêu đề không được để trống").max(200),
  taskId: z.string().optional().or(z.literal("")),
  precondition: z.string().trim().max(5000).optional().or(z.literal("")),
  steps: z.string().trim().max(10000).optional().or(z.literal("")),
  expectedResult: z.string().trim().max(5000).optional().or(z.literal("")),
  priority: z.enum(TASK_PRIORITY_ORDER).default("MEDIUM"),
});

export type TestCaseFormValues = z.infer<typeof testCaseFormSchema>;
