import type { DocCategory, DocRole, DocStatus } from "@/generated/prisma/enums";

export interface TemplateDocDef {
  title: string;
  category: DocCategory;
  role: DocRole;
  status: DocStatus;
  description: string;
  content: string;
}

export interface TemplateStructure {
  docs: TemplateDocDef[];
}

export function interpolateTemplate(text: string, projectName: string): string {
  return text.replaceAll("{{projectName}}", projectName);
}
