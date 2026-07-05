import { z } from "zod";

export const epicFormSchema = z.object({
  name: z.string().trim().min(1, "Tên epic không được để trống").max(200),
  epicCode: z.string().trim().max(50).optional().or(z.literal("")),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  status: z.enum(["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"]).default("OPEN"),
  startDate: z.string().optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")),
});
export type EpicFormValues = z.infer<typeof epicFormSchema>;

export const sprintFormSchema = z
  .object({
    name: z.string().trim().min(1, "Tên sprint không được để trống").max(200),
    goal: z.string().trim().max(2000).optional().or(z.literal("")),
    status: z.enum(["PLANNED", "ACTIVE", "COMPLETED"]).default("PLANNED"),
    startDate: z.string().min(1, "Ngày bắt đầu là bắt buộc"),
    endDate: z.string().min(1, "Ngày kết thúc là bắt buộc"),
  })
  .refine((v) => new Date(v.endDate) >= new Date(v.startDate), {
    message: "Ngày kết thúc phải sau ngày bắt đầu",
    path: ["endDate"],
  });
export type SprintFormValues = z.infer<typeof sprintFormSchema>;

export const milestoneFormSchema = z.object({
  name: z.string().trim().min(1, "Tên milestone không được để trống").max(200),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED"]).default("PLANNED"),
  dueDate: z.string().min(1, "Ngày đến hạn là bắt buộc"),
});
export type MilestoneFormValues = z.infer<typeof milestoneFormSchema>;
