import { generateObject, type LanguageModelUsage } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import type { ContentFormat, TaskPriority, TaskType } from "@/generated/prisma/enums";

export interface AutoTaskSourceDocument {
  id: string;
  title: string;
  description: string | null;
  currentContent: string;
  contentFormat: ContentFormat;
  moduleId: string;
  module?: { name: string } | null;
}

export interface AutoTaskCandidate {
  documentId: string;
  moduleId: string;
  sourceKey: string;
  sourceLabel: string;
  title: string;
  description: string;
  acceptanceCriteria: string;
  type: TaskType;
  priority: TaskPriority;
  sourceEvidence: string;
  confidence: number;
  needsClarification: boolean;
}

interface FunctionalRow {
  featureId: string;
  preconditions: string;
  mainFlow: string;
  businessRules: string;
  exceptions: string;
  acceptanceCriteria: string;
}

const MAX_CANDIDATES = 100;
const MIN_SECTION_TEXT_LENGTH = 120;
const AI_CONFIDENCE_THRESHOLD = 0.65;
const MAX_AI_DOCUMENTS = 60;
const MAX_CONTEXT_CHARS_PER_DOCUMENT = 12000;
const MAX_TOTAL_CONTEXT_CHARS = 90000;
const DEFAULT_AI_TASK_MODEL = "gpt-5.4-mini";

const aiTaskProposalSchema = z.object({
  tasks: z.array(
    z.object({
      title: z.string().min(1).max(180),
      type: z.enum(["STORY", "TASK", "TEST"]),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
      sourceDocumentId: z.string().min(1),
      sourceKey: z.string().min(1).max(180),
      sourceEvidence: z.string().min(1).max(500),
      systemNeed: z.string().min(1).max(1500),
      userGoal: z.string().min(1).max(1500),
      correctnessConditions: z.array(z.string().min(1).max(400)).max(12),
      devChecklist: z.array(z.string().min(1).max(400)).max(12),
      testChecklist: z.array(z.string().min(1).max(400)).max(12),
      acceptanceCriteria: z.array(z.string().min(1).max(400)).max(12),
      confidence: z.number().min(0).max(1),
      needsClarification: z.boolean(),
    }),
  ).max(MAX_CANDIDATES),
});

type AiTaskProposalResult = z.infer<typeof aiTaskProposalSchema>;
type AiTaskProposal = AiTaskProposalResult["tasks"][number];

export interface AiTaskGenerationResult {
  candidates: AutoTaskCandidate[];
  usage: LanguageModelUsage;
  model: string;
}

export function isAiTaskGenerationConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function generateAiTaskCandidatesFromDocuments(
  documents: AutoTaskSourceDocument[],
): Promise<AutoTaskCandidate[]> {
  const result = await generateAiTaskCandidateResult(documents);
  return result.candidates;
}

export async function generateAiTaskCandidateResult(
  documents: AutoTaskSourceDocument[],
): Promise<AiTaskGenerationResult> {
  if (!isAiTaskGenerationConfigured()) {
    throw new Error("AI_TASK_NOT_CONFIGURED");
  }

  const contextDocuments = buildAiDocumentContext(documents);
  if (contextDocuments.length === 0) {
    return {
      candidates: [],
      usage: emptyUsage(),
      model: process.env.AI_TASK_MODEL || DEFAULT_AI_TASK_MODEL,
    };
  }

  const model = process.env.AI_TASK_MODEL || DEFAULT_AI_TASK_MODEL;
  const { object, usage } = await generateObject({
    model: openai(model),
    schema: aiTaskProposalSchema,
    schemaName: "ProjectTaskProposalList",
    schemaDescription: "Danh sách task dev/test được suy luận từ logic tài liệu dự án.",
    system: [
      "Bạn là BA/PO kỹ thuật của một hệ thống PMS.",
      "Nhiệm vụ: đọc logic trong tài liệu dự án và đề xuất task thực thi cho dev/test.",
      "Chỉ tạo task khi tài liệu có logic nghiệp vụ, luồng người dùng, rule, validation, exception hoặc acceptance criteria đủ rõ.",
      "Không tạo task chỉ vì nhìn thấy tên loại tài liệu, tên module, heading rỗng hoặc danh sách mục lục.",
      "Không bịa API, field, rule hoặc permission nếu tài liệu không nêu. Nếu thiếu thông tin, ghi rõ cần xác nhận trong checklist và đặt needsClarification=true.",
      "Gom nội dung trùng lặp thành một task nếu cùng feature/luồng nghiệp vụ.",
      "Mỗi task phải đủ 4 ý: hệ thống cần làm gì, người dùng muốn làm gì, điều kiện đúng, dev/test cần làm gì.",
      "Ưu tiên task ở mức Feature/User Story. Không tạo task quá nhỏ như 'đọc tài liệu' hoặc 'tạo màn hình' nếu thiếu logic hoàn thành.",
      "Trả về tiếng Việt, ngắn gọn, có thể giao việc trực tiếp.",
    ].join("\n"),
    prompt: [
      "Hãy phân tích các tài liệu active sau và tạo task proposal theo schema.",
      "Quy tắc title: `[Feature ID hoặc module] - [hành động nghiệp vụ cụ thể]`; không dùng tên tài liệu chung làm title.",
      "Quy tắc sourceKey: dùng Feature ID nếu có; nếu không có dùng slug ngắn của luồng/heading chính. Không đưa documentId vào sourceKey.",
      "Quy tắc confidence: >=0.65 khi task đủ rõ để tạo; thấp hơn nếu còn mơ hồ.",
      "",
      contextDocuments.join("\n\n---DOCUMENT---\n\n"),
    ].join("\n"),
  });

  const docsById = new Map(documents.map((doc) => [doc.id, doc]));
  const seen = new Set<string>();
  const candidates: AutoTaskCandidate[] = [];

  for (const proposal of object.tasks) {
    if (proposal.confidence < AI_CONFIDENCE_THRESHOLD) continue;
    const doc = docsById.get(proposal.sourceDocumentId);
    if (!doc) continue;
    const candidate = candidateFromAiProposal(doc, proposal);
    const key = `${candidate.documentId}:${candidate.sourceKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(candidate);
  }

  return { candidates: candidates.slice(0, MAX_CANDIDATES), usage, model };
}

function emptyUsage(): LanguageModelUsage {
  return {
    inputTokens: 0,
    inputTokenDetails: {
      noCacheTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
    outputTokens: 0,
    outputTokenDetails: {
      textTokens: 0,
      reasoningTokens: 0,
    },
    totalTokens: 0,
  };
}

export function generateTaskCandidatesFromDocuments(
  documents: AutoTaskSourceDocument[],
): AutoTaskCandidate[] {
  const candidates: AutoTaskCandidate[] = [];
  const seen = new Set<string>();

  for (const doc of documents) {
    const functionalRows = parseFunctionalRows(doc);
    const nextCandidates =
      functionalRows.length > 0 ? functionalRows.map((row) => candidateFromFunctionalRow(doc, row)) : parseSections(doc);

    for (const candidate of nextCandidates) {
      const key = `${candidate.documentId}:${candidate.sourceKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(candidate);
      if (candidates.length >= MAX_CANDIDATES) return candidates;
    }
  }

  return candidates;
}

export async function generateTaskCandidatesWithAiFallback(
  documents: AutoTaskSourceDocument[],
): Promise<AutoTaskCandidate[]> {
  try {
    return await generateAiTaskCandidatesFromDocuments(documents);
  } catch {
    return generateTaskCandidatesFromDocuments(documents);
  }
}

function buildAiDocumentContext(documents: AutoTaskSourceDocument[]) {
  const chunks: string[] = [];
  let totalLength = 0;

  for (const doc of documents.slice(0, MAX_AI_DOCUMENTS)) {
    const text = normalizeDocumentForAi(doc);
    if (text.length < 160) continue;
    const chunk = [
      `Document ID: ${doc.id}`,
      `Module ID: ${doc.moduleId}`,
      `Module: ${doc.module?.name ?? "Không rõ"}`,
      `Title: ${doc.title}`,
      doc.description ? `Description: ${doc.description}` : "",
      "Content:",
      truncate(text, MAX_CONTEXT_CHARS_PER_DOCUMENT),
    ]
      .filter(Boolean)
      .join("\n");
    if (totalLength + chunk.length > MAX_TOTAL_CONTEXT_CHARS) break;
    chunks.push(chunk);
    totalLength += chunk.length;
  }

  return chunks;
}

function normalizeDocumentForAi(doc: AutoTaskSourceDocument) {
  const content =
    doc.contentFormat === "HTML"
      ? htmlToStructuredPlainText(doc.currentContent)
      : markdownToStructuredPlainText(doc.currentContent);
  return content.replace(/\n{3,}/g, "\n\n").trim();
}

function candidateFromAiProposal(
  doc: AutoTaskSourceDocument,
  proposal: AiTaskProposal,
): AutoTaskCandidate {
  const sourceSlug = slugify(proposal.sourceKey || proposal.title || proposal.sourceEvidence);
  const sourceKey = `AI_TASK:${doc.id}:${sourceSlug}`;
  const correctness = proposal.correctnessConditions.map((item) => `- ${item}`).join("\n");
  const devTestWork = [
    "Dev:",
    ...proposal.devChecklist.map((item) => `- ${item}`),
    "Test:",
    ...proposal.testChecklist.map((item) => `- ${item}`),
  ].join("\n");

  return normalizeCandidate({
    documentId: doc.id,
    moduleId: doc.moduleId,
    sourceKey,
    sourceLabel: `AI task từ ${doc.title}`,
    title: proposal.title,
    description: formatTaskDescription({
      systemNeed: proposal.systemNeed,
      userGoal: proposal.userGoal,
      doneCondition: correctness,
      devTestWork,
    }),
    acceptanceCriteria: proposal.acceptanceCriteria.map((item) => `- ${item}`).join("\n"),
    type: proposal.type,
    priority: proposal.priority,
    sourceEvidence: proposal.sourceEvidence,
    confidence: proposal.confidence,
    needsClarification: proposal.needsClarification,
  });
}

function parseFunctionalRows(doc: AutoTaskSourceDocument): FunctionalRow[] {
  return doc.contentFormat === "HTML"
    ? parseHtmlFunctionalRows(doc.currentContent)
    : parseMarkdownFunctionalRows(doc.currentContent);
}

function parseMarkdownFunctionalRows(content: string): FunctionalRow[] {
  const lines = content.split(/\r?\n/);
  const rows: FunctionalRow[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.includes("|") || !/feature\s*id/i.test(line) || !/acceptance\s*criteria/i.test(line)) {
      continue;
    }

    const headers = splitMarkdownTableRow(line).map(normalizeHeader);
    const delimiter = lines[index + 1] ?? "";
    if (!/^\s*\|?\s*:?-{3,}/.test(delimiter)) continue;

    for (let rowIndex = index + 2; rowIndex < lines.length; rowIndex += 1) {
      const rowLine = lines[rowIndex];
      if (!rowLine.includes("|")) break;
      const cells = splitMarkdownTableRow(rowLine);
      const row = rowFromCells(headers, cells);
      if (row) rows.push(row);
    }
  }

  return rows;
}

function parseHtmlFunctionalRows(content: string): FunctionalRow[] {
  const tableMatches = content.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  const rows: FunctionalRow[] = [];

  for (const table of tableMatches) {
    const trMatches = table.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
    const parsedRows = trMatches.map((row) =>
      (row.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []).map((cell) => htmlToPlainText(cell)),
    );
    const headerRowIndex = parsedRows.findIndex((cells) => {
      const text = cells.join(" ");
      return /feature\s*id/i.test(text) && /acceptance\s*criteria/i.test(text);
    });
    if (headerRowIndex < 0) continue;

    const headers = parsedRows[headerRowIndex].map(normalizeHeader);
    for (const cells of parsedRows.slice(headerRowIndex + 1)) {
      const row = rowFromCells(headers, cells);
      if (row) rows.push(row);
    }
  }

  return rows;
}

function rowFromCells(headers: string[], cells: string[]): FunctionalRow | null {
  const value = (name: string) => cells[headers.indexOf(name)]?.trim() ?? "";
  const featureId = value("featureId");
  const mainFlow = value("mainFlow");
  const acceptanceCriteria = value("acceptanceCriteria");

  if (!featureId || (!mainFlow && !acceptanceCriteria)) return null;

  return {
    featureId,
    preconditions: value("preconditions"),
    mainFlow,
    businessRules: value("businessRules"),
    exceptions: value("exceptions"),
    acceptanceCriteria,
  };
}

function candidateFromFunctionalRow(
  doc: AutoTaskSourceDocument,
  row: FunctionalRow,
): AutoTaskCandidate {
  const userGoal = summarizeText(row.mainFlow || row.acceptanceCriteria || doc.description || doc.title, 180);
  const systemNeed = summarizeText(row.businessRules || row.preconditions || row.mainFlow, 220);
  const doneCondition = summarizeText(row.acceptanceCriteria || row.businessRules || row.mainFlow, 300);
  const devTestWork = [
    row.mainFlow ? `- Dev triển khai flow: ${row.mainFlow}` : "- Dev phân tích tài liệu nguồn và triển khai đúng phạm vi.",
    row.businessRules ? `- Dev bảo đảm business rules: ${row.businessRules}` : "- Dev kiểm tra ràng buộc dữ liệu và trạng thái liên quan.",
    row.acceptanceCriteria ? `- Test viết/chạy test theo acceptance criteria: ${row.acceptanceCriteria}` : "- Test xác nhận happy path, validation và exception chính.",
    row.exceptions ? `- Test bổ sung exception: ${row.exceptions}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return normalizeCandidate({
    documentId: doc.id,
    moduleId: doc.moduleId,
    sourceKey: `${doc.id}:functional:${slugify(row.featureId)}`,
    sourceLabel: `Auto task từ ${row.featureId} - ${doc.title}`,
    title: `${row.featureId} - ${summarizeTitle(userGoal || doc.title)}`,
    description: formatTaskDescription({
      systemNeed,
      userGoal,
      doneCondition,
      devTestWork,
    }),
    acceptanceCriteria: formatAcceptanceCriteria(doneCondition, row.exceptions),
    type: isUserFacing(row.mainFlow, row.acceptanceCriteria) ? "STORY" : "TASK",
    priority: "MEDIUM",
    sourceEvidence: row.featureId,
    confidence: 0.75,
    needsClarification: false,
  });
}

function parseSections(doc: AutoTaskSourceDocument): AutoTaskCandidate[] {
  const sections = doc.contentFormat === "HTML" ? parseHtmlSections(doc.currentContent) : parseMarkdownSections(doc.currentContent);

  return sections
    .filter((section) => section.body.length >= MIN_SECTION_TEXT_LENGTH)
    .slice(0, 12)
    .map((section, index) =>
      normalizeCandidate({
        documentId: doc.id,
        moduleId: doc.moduleId,
        sourceKey: `${doc.id}:section:${slugify(section.heading || `section-${index + 1}`)}`,
        sourceLabel: `Auto task từ mục "${section.heading || doc.title}" - ${doc.title}`,
        title: summarizeTitle(section.heading || doc.title),
        description: formatTaskDescription({
          systemNeed: summarizeText(section.body, 260),
          userGoal: summarizeText(section.heading || doc.description || doc.title, 180),
          doneCondition: summarizeText(findAcceptanceLikeText(section.body) || section.body, 300),
          devTestWork: [
            `- Dev đọc mục "${section.heading || doc.title}" và triển khai đúng nội dung được mô tả.`,
            "- Dev liên kết thay đổi với dữ liệu/API/UI liên quan trong hệ thống.",
            "- Test xác nhận happy path, dữ liệu bắt buộc, lỗi validation và quyền truy cập liên quan.",
          ].join("\n"),
        }),
        acceptanceCriteria: formatAcceptanceCriteria(findAcceptanceLikeText(section.body) || section.body),
        type: isUserFacing(section.heading, section.body) ? "STORY" : "TASK",
        priority: "MEDIUM",
        sourceEvidence: section.heading || doc.title,
        confidence: 0.65,
        needsClarification: true,
      }),
    );
}

function parseMarkdownSections(content: string) {
  const sections: { heading: string; body: string }[] = [];
  const lines = content.split(/\r?\n/);
  let currentHeading = "";
  let currentBody: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,4}\s+(.+)$/);
    if (headingMatch) {
      pushSection();
      currentHeading = headingMatch[1].trim();
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }
  pushSection();

  return sections;

  function pushSection() {
    const body = markdownToPlainText(currentBody.join("\n"));
    if (currentHeading || body) sections.push({ heading: currentHeading, body });
  }
}

function parseHtmlSections(content: string) {
  const normalized = content.replace(/<h([1-4])[^>]*>/gi, "\n<h$1>").replace(/<\/h[1-4]>/gi, (tag) => `${tag}\n`);
  const parts = normalized.split(/(?=<h[1-4]>)/i);
  return parts
    .map((part, index) => {
      const heading = htmlToPlainText(part.match(/<h[1-4]>[\s\S]*?<\/h[1-4]>/i)?.[0] ?? "");
      const body = htmlToPlainText(index === 0 && !heading ? part : part.replace(/<h[1-4]>[\s\S]*?<\/h[1-4]>/i, ""));
      return { heading, body };
    })
    .filter((section) => section.heading || section.body);
}

function formatTaskDescription({
  systemNeed,
  userGoal,
  doneCondition,
  devTestWork,
}: {
  systemNeed: string;
  userGoal: string;
  doneCondition: string;
  devTestWork: string;
}) {
  return [
    `## Hệ thống cần làm gì\n${systemNeed || "Hệ thống cần triển khai đúng yêu cầu trong tài liệu nguồn."}`,
    `## Người dùng muốn làm gì\n${userGoal || "Người dùng muốn hoàn thành nghiệp vụ được mô tả trong tài liệu."}`,
    `## Điều kiện thế nào là đúng\n${doneCondition || "Kết quả đúng khi flow, dữ liệu, quyền và trạng thái khớp tài liệu."}`,
    `## Dev/Test cần làm gì để hoàn thành\n${devTestWork}`,
  ].join("\n\n");
}

function formatAcceptanceCriteria(doneCondition: string, exceptions = "") {
  return [
    `- Hoàn thành đúng điều kiện: ${summarizeText(doneCondition, 500) || "khớp tài liệu nguồn."}`,
    "- Không phá vỡ quyền truy cập, dữ liệu hiện có và luồng liên quan.",
    "- Có kiểm tra happy path, validation và trạng thái lỗi chính.",
    exceptions ? `- Xử lý exception: ${summarizeText(exceptions, 300)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeCandidate(candidate: AutoTaskCandidate): AutoTaskCandidate {
  return {
    ...candidate,
    title: truncate(candidate.title.replace(/\s+/g, " ").trim(), 200),
    description: truncate(candidate.description.trim(), 5000),
    acceptanceCriteria: truncate(candidate.acceptanceCriteria.trim(), 5000),
    sourceEvidence: truncate(candidate.sourceEvidence.replace(/\s+/g, " ").trim(), 500),
    confidence: Math.max(0, Math.min(1, candidate.confidence)),
  };
}

function splitMarkdownTableRow(row: string) {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => markdownToPlainText(cell.trim()));
}

function normalizeHeader(header: string) {
  const key = header.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (key.includes("featureid")) return "featureId";
  if (key.includes("precondition")) return "preconditions";
  if (key.includes("mainflow")) return "mainFlow";
  if (key.includes("businessrule")) return "businessRules";
  if (key.includes("exception")) return "exceptions";
  if (key.includes("acceptancecriteria")) return "acceptanceCriteria";
  return key;
}

function markdownToPlainText(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
      .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[#>*_~\-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function markdownToStructuredPlainText(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!\[([^\]]*)]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n"),
  );
}

function htmlToPlainText(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function htmlToStructuredPlainText(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(h[1-6])>/gi, "\n")
      .replace(/<h([1-6])[^>]*>/gi, "\n# ")
      .replace(/<\/(p|div|li)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<\/t[dh]>/gi, " | ")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n"),
  );
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function findAcceptanceLikeText(value: string) {
  const match = value.match(/(?:acceptance criteria|tiêu chí nghiệm thu|điều kiện đúng)[:\s]+(.{20,700})/i);
  return match?.[1]?.trim() ?? "";
}

function isUserFacing(...values: string[]) {
  return /\b(user|người dùng|khách hàng|admin|po|ba|dev|tester|đăng nhập|xem|tạo|sửa|xóa|chọn|nhập)\b/i.test(
    values.join(" "),
  );
}

function summarizeTitle(value: string) {
  return truncate(value.replace(/^\d+[\).]\s*/, "").trim() || "Triển khai yêu cầu từ tài liệu", 120);
}

function summarizeText(value: string, maxLength: number) {
  return truncate(value.replace(/\s+/g, " ").trim(), maxLength);
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "section"
  );
}
