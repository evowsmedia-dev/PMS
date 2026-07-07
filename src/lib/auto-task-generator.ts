import type { ContentFormat, TaskType } from "@/generated/prisma/enums";

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
  // Hybrid hook: keep the shape stable so an AI provider can be added later
  // without changing the batch-create action or overview UI.
  return generateTaskCandidatesFromDocuments(documents);
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
  return `${value.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
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
