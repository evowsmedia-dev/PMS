import { generateObject, type LanguageModelUsage } from "ai";
import { openai } from "@ai-sdk/openai";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";

const DEFAULT_AI_TASK_MODEL = "gpt-5.4-mini";
const MAX_PROPOSALS = 20;
const MAX_CONTEXT_CHARS = 50000;

export interface AiSubtaskSourceDocument {
  id: string;
  title: string;
  currentContent: string;
}

export interface AiSubtaskParentContext {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string;
  priority: string;
  moduleName: string | null;
  epicName: string | null;
  sprintName: string | null;
  milestoneName: string | null;
  devEstimateHours: number;
  documents: AiSubtaskSourceDocument[];
  externalLinks: string[];
}

export interface AiSubtaskProposal {
  sourceKey: string;
  title: string;
  description: string;
  acceptanceCriteria: string;
  devEstimateHours: number;
  confidence: number;
}

export interface AiSubtaskGenerationResult {
  proposals: AiSubtaskProposal[];
  usage: LanguageModelUsage;
  model: string;
}

const aiSubtaskSchema = z.object({
  subtasks: z
    .array(
      z.object({
        sourceKey: z.string().min(1).max(120),
        title: z.string().min(1).max(180),
        goal: z.string().min(1).max(1200),
        scope: z.array(z.string().min(1).max(400)).min(1).max(10),
        conditions: z.array(z.string().min(1).max(400)).max(10),
        devChecklist: z.array(z.string().min(1).max(400)).min(1).max(12),
        testChecklist: z.array(z.string().min(1).max(400)).min(1).max(12),
        acceptanceCriteria: z.array(z.string().min(1).max(400)).min(1).max(12),
        devEstimateHours: z.number().min(0.5).max(8),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(MAX_PROPOSALS),
});

export async function generateAiSubtaskProposalResult(
  context: AiSubtaskParentContext,
): Promise<AiSubtaskGenerationResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("AI_TASK_NOT_CONFIGURED");
  }

  const model = process.env.AI_TASK_MODEL || DEFAULT_AI_TASK_MODEL;
  const { object, usage } = await generateObject({
    model: openai(model),
    schema: aiSubtaskSchema,
    schemaName: "TaskBreakdownProposal",
    schemaDescription: "Danh sách sub-task độc lập, kiểm thử được và không quá 8 giờ Dev.",
    system: [
      "Bạn là Tech Lead và BA đang phân rã công việc cho một middle developer.",
      "Chỉ tạo sub-task khi nội dung task cha đủ rõ để xác định đầu ra có thể kiểm thử.",
      "Mỗi sub-task phải độc lập, có phạm vi không trùng nhau và hoàn thành trong tối đa 8 giờ Dev.",
      "Nếu một phần việc vượt 8 giờ, bắt buộc chia nhỏ thêm theo lớp, luồng, API, UI hoặc rule nghiệp vụ hợp lý.",
      "Estimate theo bước 0.5 giờ, trong khoảng 0.5 đến 8 giờ.",
      "Không tạo việc chung chung như đọc tài liệu, phân tích, tìm hiểu hoặc hoàn thiện chức năng.",
      "Không bịa yêu cầu. Nội dung chưa rõ phải được ghi thành điều kiện cần xác nhận trong mô tả.",
      "Trả về tiếng Việt, đủ rõ để Dev thực hiện và Tester nghiệm thu.",
    ].join("\n"),
    prompt: [
      "Phân rã task cha dưới đây thành tối đa 20 sub-task.",
      "sourceKey phải ngắn, ổn định theo phạm vi chức năng và không chứa task ID.",
      "Mỗi sub-task cần có mục tiêu, phạm vi, điều kiện/ngoại lệ, checklist Dev, checklist Test và acceptance criteria.",
      "",
      buildParentContext(context),
    ].join("\n"),
  });

  const seen = new Set<string>();
  const proposals: AiSubtaskProposal[] = [];
  for (const item of object.subtasks) {
    const sourceKey = normalizeSourceKey(item.sourceKey);
    if (!sourceKey || seen.has(sourceKey)) continue;
    seen.add(sourceKey);
    proposals.push({
      sourceKey,
      title: item.title.trim(),
      description: formatDescription(item),
      acceptanceCriteria: item.acceptanceCriteria.map((value) => `- ${value}`).join("\n"),
      devEstimateHours: normalizeEstimate(item.devEstimateHours),
      confidence: item.confidence,
    });
  }

  return { proposals, usage, model };
}

function buildParentContext(context: AiSubtaskParentContext) {
  const documentContext = context.documents
    .map((document) => {
      const content = toPlainText(document.currentContent).slice(0, 8000);
      return [`Tài liệu: ${document.title}`, content].filter(Boolean).join("\n");
    })
    .join("\n\n--- TÀI LIỆU LIÊN QUAN ---\n\n");

  return [
    `Tiêu đề: ${context.title}`,
    `Mô tả:\n${context.description || "Không có"}`,
    `Tiêu chí nghiệm thu:\n${context.acceptanceCriteria || "Không có"}`,
    `Ưu tiên: ${context.priority}`,
    `Phân hệ: ${context.moduleName ?? "Không có"}`,
    `Epic: ${context.epicName ?? "Không có"}`,
    `Sprint: ${context.sprintName ?? "Không có"}`,
    `Milestone: ${context.milestoneName ?? "Không có"}`,
    `Dev estimate task cha: ${context.devEstimateHours} giờ`,
    context.externalLinks.length > 0
      ? `External links tham chiếu (không suy diễn nội dung):\n${context.externalLinks.join("\n")}`
      : "",
    documentContext ? `Nội dung tài liệu liên quan:\n${documentContext}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, MAX_CONTEXT_CHARS);
}

function toPlainText(value: string) {
  return sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSourceKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function normalizeEstimate(value: number) {
  return Math.min(8, Math.max(0.5, Math.round(value * 2) / 2));
}

function formatDescription(item: z.infer<typeof aiSubtaskSchema>["subtasks"][number]) {
  return [
    "## Mục tiêu",
    item.goal,
    "",
    "## Phạm vi triển khai",
    ...item.scope.map((value) => `- ${value}`),
    "",
    "## Điều kiện và ngoại lệ",
    ...(item.conditions.length > 0
      ? item.conditions.map((value) => `- ${value}`)
      : ["- Không có điều kiện hoặc ngoại lệ bổ sung trong task cha."]),
    "",
    "## Checklist Dev",
    ...item.devChecklist.map((value) => `- [ ] ${value}`),
    "",
    "## Checklist Test",
    ...item.testChecklist.map((value) => `- [ ] ${value}`),
  ].join("\n");
}
