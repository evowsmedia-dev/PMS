import { z } from "zod";

export const documentFormSchema = z.object({
  title: z.string().trim().min(1, "Tiêu đề không được để trống").max(300),
  category: z.enum([
    "MANAGEMENT",
    "REQUIREMENTS",
    "TECHNICAL",
    "TESTING",
    "TASKS",
    "KNOWLEDGE",
    "HISTORY",
  ]),
  role: z.enum(["PO", "BA", "DEV", "TESTER", "ALL"]),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  content: z.string().max(200_000).optional().or(z.literal("")),
});

export type DocumentFormValues = z.infer<typeof documentFormSchema>;

export const DOC_CATEGORY_LABEL: Record<string, string> = {
  MANAGEMENT: "01-Quản lý",
  REQUIREMENTS: "02-Yêu cầu",
  TECHNICAL: "03-Kỹ thuật",
  TESTING: "04-Kiểm thử",
  TASKS: "05-Tiến độ",
  KNOWLEDGE: "06-Kiến thức",
  HISTORY: "07-Lịch sử",
};

export const DOC_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  REVIEW: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  ARCHIVED: "Lưu trữ",
};
