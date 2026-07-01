import { z } from "zod";

export const taskFormSchema = z.object({
  title: z.string().trim().min(1, "Tiêu đề không được để trống").max(200),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  assigneeId: z.string().optional().or(z.literal("")),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  dueDate: z.string().optional().or(z.literal("")),
  relatedDocumentId: z.string().optional().or(z.literal("")),
  sourceHighlight: z.string().optional().or(z.literal("")),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

export const TASK_STATUS_LABEL: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  REVIEW: "Review",
  DONE: "Done",
};

export const TASK_STATUS_ORDER = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const;

export const TASK_PRIORITY_LABEL: Record<string, string> = {
  LOW: "Thấp",
  MEDIUM: "Trung bình",
  HIGH: "Cao",
  CRITICAL: "Khẩn cấp",
};
