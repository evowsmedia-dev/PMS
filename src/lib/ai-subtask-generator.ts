import { createHash } from "node:crypto";
import { generateObject, type LanguageModelUsage } from "ai";
import { openai } from "@ai-sdk/openai";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";

export const AI_SUBTASK_PROMPT_VERSION = "2026-07-09.v3";
const DEFAULT_AI_TASK_MODEL = "gpt-5.4-mini";
const MAX_PROPOSALS = 16;
const MAX_CONTEXT_CHARS = 24000;
const AI_TIMEOUT_MS = 45000;

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

export interface AiSubtaskSourceReference {
  id: string;
  label: string;
  text: string;
  mandatory: boolean;
}

export interface AiSubtaskProposal {
  sourceKey: string;
  title: string;
  description: string;
  acceptanceCriteria: string;
  devEstimateHours: number;
  confidence: number;
  dependencies: string[];
  coveredSourceRefs: string[];
  sourceEvidence: string;
}

export interface AiSubtaskCoverageReport {
  complete: boolean;
  mandatorySourceRefs: string[];
  coveredSourceRefs: string[];
  missingSourceRefs: string[];
  invalidSourceRefs: string[];
}

export interface AiSubtaskContextSnapshot {
  task: AiSubtaskParentContext;
  sourceReferences: AiSubtaskSourceReference[];
}

export interface AiSubtaskGenerationResult {
  proposals: AiSubtaskProposal[];
  coverageReport: AiSubtaskCoverageReport;
  contextSnapshot: AiSubtaskContextSnapshot;
  contextHash: string;
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
        dependencies: z.array(z.string().min(1).max(120)).max(10),
        coveredSourceRefs: z.array(z.string().min(1).max(160)).min(1).max(30),
        sourceEvidence: z.string().min(1).max(1000),
      }),
    )
    .max(MAX_PROPOSALS),
});

type RawProposal = z.infer<typeof aiSubtaskSchema>["subtasks"][number];

export function buildAiSubtaskContext(context: AiSubtaskParentContext) {
  const sourceReferences = buildSourceReferences(context);
  const model = process.env.AI_TASK_MODEL || DEFAULT_AI_TASK_MODEL;
  const contextSnapshot: AiSubtaskContextSnapshot = { task: context, sourceReferences };
  const contextHash = createHash("sha256")
    .update(JSON.stringify({ contextSnapshot, model, promptVersion: AI_SUBTASK_PROMPT_VERSION }))
    .digest("hex");
  return { sourceReferences, contextSnapshot, contextHash, model };
}

export async function generateAiSubtaskProposalResult(
  context: AiSubtaskParentContext,
): Promise<AiSubtaskGenerationResult> {
  if (!process.env.OPENAI_API_KEY) throw new Error("AI_TASK_NOT_CONFIGURED");

  const prepared = buildAiSubtaskContext(context);
  const first = await runGeneration(prepared.model, prepared.sourceReferences);
  const proposals = normalizeProposals(first.object.subtasks, prepared.sourceReferences);
  const coverageReport = calculateCoverage(proposals, prepared.sourceReferences);

  return {
    proposals,
    coverageReport,
    contextSnapshot: prepared.contextSnapshot,
    contextHash: prepared.contextHash,
    usage: first.usage,
    model: prepared.model,
  };
}

async function runGeneration(
  model: string,
  sourceReferences: AiSubtaskSourceReference[],
) {
  return generateObject({
    model: openai(model),
    abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS),
    maxRetries: 1,
    schema: aiSubtaskSchema,
    schemaName: "TaskBreakdownProposal",
    schemaDescription: "Danh sách sub-task truy vết được về task cha và không quá 8 giờ Dev.",
    system: [
      "Bạn là Tech Lead và BA đang phân rã công việc cho một middle developer.",
      "Ưu tiên vertical slice có đầu ra kiểm thử được và không chồng chéo.",
      "Mỗi sub-task phải hoàn thành trong 0.5-8 giờ; phần lớn hơn phải chia tiếp.",
      "Không tạo việc đọc tài liệu, tìm hiểu, phân tích chung hoặc phạm vi không có trong nguồn.",
      "Mỗi proposal bắt buộc có đúng format: Mục tiêu; Phạm vi triển khai; Điều kiện và ngoại lệ; Checklist Dev; Checklist Test; Acceptance criteria kiểm chứng được.",
      "Mục tiêu phải là hành vi kỹ thuật hoặc nghiệp vụ cụ thể, không phải hoạt động chung chung.",
      "Không tạo task có mục tiêu đọc tài liệu, phân tích, tìm hiểu hoặc hoàn thiện chức năng.",
      "Mỗi sub-task phải dẫn coveredSourceRefs hợp lệ và sourceEvidence bám sát nguồn.",
      "Tất cả source reference bắt buộc phải được bao phủ.",
      "Trả về tiếng Việt, đủ rõ để Dev làm và Tester nghiệm thu.",
    ].join("\n"),
    prompt: [
      `Phân rã task cha thành tối đa ${MAX_PROPOSALS} sub-task.`,
      "sourceKey phải ngắn, ổn định theo phạm vi và dependencies phải dùng sourceKey.",
      "Acceptance criteria phải mô tả kết quả quan sát/kiểm thử được, không dùng từ mơ hồ như đúng, ổn, hoàn thiện.",
      "Nguồn được phép sử dụng:",
      sourceReferences.map((ref) => `[${ref.id}] ${ref.label}: ${ref.text}`).join("\n"),
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, MAX_CONTEXT_CHARS),
  });
}

function buildSourceReferences(context: AiSubtaskParentContext) {
  const refs: AiSubtaskSourceReference[] = [
    { id: "TITLE", label: "Tiêu đề", text: context.title.trim(), mandatory: true },
  ];
  splitContent(context.description).slice(0, 12).forEach((text, index) =>
    refs.push({
      id: `DESC-${String(index + 1).padStart(2, "0")}`,
      label: "Mô tả",
      text,
      mandatory: true,
    }),
  );
  splitContent(context.acceptanceCriteria).slice(0, 12).forEach((text, index) =>
    refs.push({
      id: `AC-${String(index + 1).padStart(2, "0")}`,
      label: "Tiêu chí nghiệm thu",
      text,
      mandatory: true,
    }),
  );
  let documentChunkCount = 0;
  for (const document of context.documents.slice(0, 8)) {
    splitContent(toPlainText(document.currentContent).slice(0, 8000), 1200).forEach((text, index) =>
      {
        if (documentChunkCount >= 12) return;
        refs.push({
          id: `DOC:${document.id}:${String(index + 1).padStart(2, "0")}`,
          label: `Tài liệu ${document.title}`,
          text,
          mandatory: false,
        });
        documentChunkCount += 1;
      },
    );
  }
  return refs;
}

function splitContent(value: string, maxLength = 800) {
  const cleaned = toPlainText(value);
  if (!cleaned) return [];
  const lines = cleaned.split(/\n+|(?<=[.!?])\s+/).map((line) => line.trim()).filter(Boolean);
  const chunks: string[] = [];
  for (const line of lines) {
    if (line.length <= maxLength) chunks.push(line);
    else for (let index = 0; index < line.length; index += maxLength) chunks.push(line.slice(index, index + maxLength));
  }
  return chunks.slice(0, 30);
}

function normalizeProposals(raw: RawProposal[], refs: AiSubtaskSourceReference[]) {
  const validRefs = new Set(refs.map((ref) => ref.id));
  const seen = new Set<string>();
  const proposals: AiSubtaskProposal[] = [];
  for (const item of raw) {
    const sourceKey = normalizeSourceKey(item.sourceKey);
    if (!sourceKey || seen.has(sourceKey)) continue;
    const coveredSourceRefs = [
      ...new Set(item.coveredSourceRefs.filter((ref) => validRefs.has(ref))),
    ];
    if (coveredSourceRefs.length === 0) continue;
    seen.add(sourceKey);
    proposals.push({
      sourceKey,
      title: item.title.trim(),
      description: formatDescription(item),
      acceptanceCriteria: item.acceptanceCriteria.map((value) => `- ${value}`).join("\n"),
      devEstimateHours: normalizeEstimate(item.devEstimateHours),
      confidence: item.confidence,
      dependencies: item.dependencies.map(normalizeSourceKey).filter(Boolean),
      coveredSourceRefs,
      sourceEvidence: item.sourceEvidence.trim(),
    });
  }
  return proposals;
}

export function calculateAiSubtaskCoverage(
  proposals: AiSubtaskProposal[],
  refs: AiSubtaskSourceReference[],
) {
  return calculateCoverage(proposals, refs);
}

function calculateCoverage(proposals: AiSubtaskProposal[], refs: AiSubtaskSourceReference[]) {
  const valid = new Set(refs.map((ref) => ref.id));
  const mandatory = refs.filter((ref) => ref.mandatory).map((ref) => ref.id);
  const allReported = proposals.flatMap((proposal) => proposal.coveredSourceRefs);
  const covered = [...new Set(allReported.filter((ref) => valid.has(ref)))];
  const invalid = [...new Set(allReported.filter((ref) => !valid.has(ref)))];
  const missing = mandatory.filter((ref) => !covered.includes(ref));
  return {
    complete: missing.length === 0 && invalid.length === 0,
    mandatorySourceRefs: mandatory,
    coveredSourceRefs: covered,
    missingSourceRefs: missing,
    invalidSourceRefs: invalid,
  };
}

function toPlainText(value: string) {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSourceKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
}

function normalizeEstimate(value: number) {
  return Math.min(8, Math.max(0.5, Math.round(value * 2) / 2));
}

function formatDescription(item: RawProposal) {
  return [
    "## Mục tiêu", item.goal, "", "## Phạm vi triển khai",
    ...item.scope.map((value) => `- ${value}`), "", "## Điều kiện và ngoại lệ",
    ...(item.conditions.length > 0 ? item.conditions.map((value) => `- ${value}`) : ["- Không có điều kiện hoặc ngoại lệ bổ sung trong task cha."]),
    "", "## Checklist Dev", ...item.devChecklist.map((value) => `- [ ] ${value}`),
    "", "## Checklist Test", ...item.testChecklist.map((value) => `- [ ] ${value}`),
  ].join("\n");
}
