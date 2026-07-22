export type SemanticTone = "neutral" | "info" | "success" | "warning" | "danger";

const toneClass: Record<SemanticTone, string> = {
  neutral: "border-[var(--status-neutral-border)] bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]",
  info: "border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
  success: "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]",
  warning: "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]",
  danger: "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
};

export function semanticToneClass(tone: SemanticTone) {
  return toneClass[tone];
}

export function taskStatusTone(status: string): SemanticTone {
  if (status === "DONE") return "success";
  if (status === "BLOCKED" || status === "REOPENED") return "danger";
  if (status === "BUG_FIXING" || status === "READY_FOR_QA" || status === "TESTING") return "warning";
  if (status === "IN_PROGRESS" || status === "CODE_REVIEW" || status === "READY_FOR_UAT") return "info";
  return "neutral";
}

export function taskPriorityTone(priority: string): SemanticTone {
  if (priority === "CRITICAL") return "danger";
  if (priority === "HIGH") return "warning";
  if (priority === "MEDIUM") return "info";
  return "neutral";
}

export function documentStatusTone(status: string): SemanticTone {
  if (status === "APPROVED") return "success";
  if (status === "REVIEW") return "info";
  if (status === "ARCHIVED") return "neutral";
  return "warning";
}

export function bugStatusTone(status: string): SemanticTone {
  if (status === "CLOSED" || status === "VERIFIED" || status === "FIXED") return "success";
  if (status === "IN_PROGRESS") return "info";
  if (status === "REOPENED") return "danger";
  return "warning";
}

export function bugSeverityTone(severity: string): SemanticTone {
  if (severity === "BLOCKER" || severity === "CRITICAL") return "danger";
  if (severity === "MAJOR") return "warning";
  if (severity === "MEDIUM") return "info";
  return "neutral";
}

export function testResultTone(result: string): SemanticTone {
  if (result === "PASS") return "success";
  if (result === "FAIL" || result === "BLOCKED") return "danger";
  if (result === "SKIPPED") return "warning";
  return "neutral";
}

export function planningStatusTone(status: string): SemanticTone {
  if (status === "DONE" || status === "COMPLETED") return "success";
  if (status === "IN_PROGRESS" || status === "ACTIVE") return "info";
  if (status === "CANCELLED" || status === "DEPRECATED") return "neutral";
  return "warning";
}

export function warningToneClass() {
  return semanticToneClass("danger");
}
