import { z } from "zod";

export const PROJECT_ICONS = [
  "FolderKanban",
  "Briefcase",
  "Package",
  "Users",
  "Factory",
  "ShoppingCart",
  "Boxes",
  "ClipboardList",
] as const;

export const projectFormSchema = z.object({
  name: z.string().trim().min(1, "Tên dự án không được để trống").max(200),
  code: z
    .string()
    .trim()
    .min(1, "Mã dự án không được để trống")
    .max(30)
    .regex(/^[A-Za-z0-9_-]+$/, "Mã dự án chỉ gồm chữ, số, - và _"),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  icon: z.enum(PROJECT_ICONS).default("FolderKanban"),
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
});

export type ProjectFormValues = z.infer<typeof projectFormSchema>;
